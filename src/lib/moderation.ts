import "server-only";

import { clientExploitation, clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Signalement et modération de l'entraide — cahier V5, §7.
 *
 * **Qui modère.** L'administrateur de l'établissement. Pas le professeur du
 * cours : il participe à l'entraide, et lui confier l'arbitrage d'un conflit
 * entre ses propres élèves mélangerait deux rôles. Il garde ce qu'il avait
 * déjà — masquer un contenu de son cours — mais ce geste-là ne clôt aucun
 * signalement.
 *
 * La base reconnaît aussi le rôle `moderateur`, hérité de la première
 * migration, qu'un établissement pourrait confier à un CPE. **Aucun écran ne
 * l'attribue aujourd'hui**, et l'action serveur ne l'accepte donc pas : la
 * modération est, en pratique, celle de l'administrateur.
 *
 * **Ce que le signalement ne fait pas.** Il ne supprime rien, et dix
 * signalements ne suppriment rien non plus. Un contenu ne disparaît que par une
 * décision écrite, prise par une personne nommée, et journalisée. Un produit où
 * le nombre de clics décide est un produit où la majorité fait taire la
 * minorité.
 *
 * **L'identité de celui qui signale.** Elle ne sort jamais du cercle des
 * modérateurs. C'est la condition pour que le bouton serve à quelque chose : un
 * élève qui craint d'être identifié ne l'utilisera pas, et le recours n'aura
 * été que théorique.
 *
 * **Pourquoi la lecture passe par le client privilégié.** Le modérateur n'assiste
 * pas au cours et ne l'enseigne pas : `fils_lecture` ne lui montre donc rien, et
 * c'est voulu — il n'a aucune raison de lire l'entraide en général. Il doit
 * pourtant voir **ce qui a été signalé**, sans quoi il tranche à l'aveugle. La
 * fonction ci-dessous ne rend donc que les contenus visés par un signalement de
 * son propre établissement, jamais le reste.
 */

export type RaisonSignalement = "harcelement" | "contenu_inapproprie" | "hors_sujet" | "autre";
export type EtatSignalement = "ouvert" | "en_examen" | "traite" | "rejete";
export type DecisionModeration = "masquer" | "restaurer" | "classer_sans_suite";

export interface Signalement {
  readonly id: string;
  readonly raison: RaisonSignalement;
  readonly detail: string | null;
  readonly etat: EtatSignalement;
  readonly signaleLe: string;
  /** Le texte visé, tel qu'il est en base. Vide si le contenu a disparu. */
  readonly contenu: string;
  /** « un fil » ou « une réponse » — ce sur quoi porte la décision. */
  readonly cible: "fil" | "reponse";
  readonly masque: boolean;
  /** Combien de personnes distinctes ont signalé ce même contenu. */
  readonly signalements: number;
  readonly auteurContenu: string;
  readonly signalePar: string;
  readonly cours: string;
}

function journaliser(contexte: string, code: string | undefined): void {
  if (code === "42501" || code === "PGRST116") return;
  console.error(JSON.stringify({ niveau: "erreur", contexte, code: code ?? "inconnu" }));
}

/* -------------------------------------------------------------------------- */
/* Signaler                                                                    */
/* -------------------------------------------------------------------------- */

export type ResultatSignalement =
  | { ok: true }
  | { ok: false; message: string; dejaSignale?: true };

/**
 * Signale un fil ou une réponse d'entraide.
 *
 * La cible est passée par son identifiant seul : l'établissement et le cours
 * sont relus en base par la politique `reports_signaler`, qui refuse un contenu
 * que l'appelant n'aurait pas le droit de lire. Rien de ce qui vient du
 * formulaire ne désigne un périmètre.
 *
 * Un second signalement du même contenu par la même personne n'est pas une
 * erreur à corriger mais une information à rendre : elle a déjà été entendue.
 */
export async function signaler(options: {
  jeton: string;
  organisation: string;
  moi: string;
  cible: { genre: "fil" | "reponse"; id: string };
  raison: RaisonSignalement;
  detail: string;
}): Promise<ResultatSignalement> {
  const detail = options.detail.trim().slice(0, 1000);

  const { error } = await clientUtilisateur(options.jeton)
    .from("reports")
    .insert({
      organization_id: options.organisation,
      reporter_id: options.moi,
      [options.cible.genre === "fil" ? "fil_id" : "reponse_id"]: options.cible.id,
      reason: options.raison,
      detail: detail === "" ? null : detail,
    });

  if (error === null) return { ok: true };

  // 23505 : l'index partiel « une fois par personne » a joué.
  if (error.code === "23505") {
    return {
      ok: false,
      dejaSignale: true,
      message:
        "Vous avez déjà signalé ce message. Il a été transmis, et quelqu'un le regardera — le signaler à nouveau n'accélère rien.",
    };
  }

  journaliser("moderation.signaler", error.code);
  return {
    ok: false,
    message: "Le signalement n'a pas pu être enregistré. Réessayez dans un instant.",
  };
}

/** Les identifiants de contenus que cette personne a déjà signalés. */
export async function dejaSignales(jeton: string): Promise<ReadonlySet<string>> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("reports")
    .select("fil_id, reponse_id");

  if (error !== null) {
    journaliser("moderation.deja-signales", error.code);
    return new Set();
  }

  const connus = new Set<string>();
  for (const ligne of (data ?? []) as { fil_id: string | null; reponse_id: string | null }[]) {
    if (ligne.fil_id !== null) connus.add(ligne.fil_id);
    if (ligne.reponse_id !== null) connus.add(ligne.reponse_id);
  }
  return connus;
}

/* -------------------------------------------------------------------------- */
/* Modérer                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Les signalements d'un établissement, contenu visé compris.
 *
 * L'appelant doit avoir été vérifié **avant** cet appel : rôle de modération et
 * second facteur présenté. La vérification vit dans l'action serveur, parce
 * qu'une action s'atteint directement et qu'un écran qui cache un bouton ne
 * protège rien.
 */
export async function signalements(options: {
  organisation: string;
  ouvertsSeulement?: boolean;
}): Promise<Signalement[]> {
  const client = clientExploitation("moderation_des_signalements");

  let requete = client
    .from("reports")
    .select("id, reason, detail, state, created_at, fil_id, reponse_id, reporter_id")
    .eq("organization_id", options.organisation)
    .order("created_at", { ascending: false })
    .limit(100);

  if (options.ouvertsSeulement === true) requete = requete.in("state", ["ouvert", "en_examen"]);

  const { data, error } = await requete;
  if (error !== null) {
    journaliser("moderation.liste", error.code);
    return [];
  }

  const lignes = (data ?? []) as {
    id: string;
    reason: RaisonSignalement;
    detail: string | null;
    state: EtatSignalement;
    created_at: string;
    fil_id: string | null;
    reponse_id: string | null;
    reporter_id: string;
  }[];

  if (lignes.length === 0) return [];

  // Les contenus visés, en deux requêtes bornées aux identifiants signalés.
  const filsVises = [...new Set(lignes.map((l) => l.fil_id).filter(estUnIdentifiant))];
  const reponsesVisees = [...new Set(lignes.map((l) => l.reponse_id).filter(estUnIdentifiant))];

  const [fils, reponses] = await Promise.all([
    filsVises.length === 0
      ? Promise.resolve({ data: [] })
      : client
          .from("fils_entraide")
          .select("id, question, auteur_id, masque_le, teaching_space_id")
          .in("id", filsVises),
    reponsesVisees.length === 0
      ? Promise.resolve({ data: [] })
      : client
          .from("reponses_entraide")
          .select("id, texte, auteur_id, masque_le, fil_id")
          .in("id", reponsesVisees),
  ]);

  const parFil = new Map(
    ((fils.data ?? []) as {
      id: string;
      question: string;
      auteur_id: string;
      masque_le: string | null;
      teaching_space_id: string;
    }[]).map((ligne) => [ligne.id, ligne]),
  );

  const parReponse = new Map(
    ((reponses.data ?? []) as {
      id: string;
      texte: string;
      auteur_id: string;
      masque_le: string | null;
      fil_id: string;
    }[]).map((ligne) => [ligne.id, ligne]),
  );

  // Les noms, en un seul aller-retour : auteurs des contenus et signalants.
  const profils = new Set<string>(lignes.map((l) => l.reporter_id));
  for (const fil of parFil.values()) profils.add(fil.auteur_id);
  for (const reponse of parReponse.values()) profils.add(reponse.auteur_id);

  const { data: personnes } = await client
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [...profils]);

  const noms = new Map(
    ((personnes ?? []) as { id: string; first_name: string; last_name: string }[]).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name}`.trim(),
    ]),
  );

  // Les cours, pour situer le contenu sans ouvrir le fil.
  const espaces = new Set<string>();
  for (const fil of parFil.values()) espaces.add(fil.teaching_space_id);

  const filsDesReponses = [...new Set([...parReponse.values()].map((r) => r.fil_id))];
  const { data: filsPorteurs } =
    filsDesReponses.length === 0
      ? { data: [] }
      : await client.from("fils_entraide").select("id, teaching_space_id").in("id", filsDesReponses);

  const espaceDuFil = new Map(
    ((filsPorteurs ?? []) as { id: string; teaching_space_id: string }[]).map((f) => [
      f.id,
      f.teaching_space_id,
    ]),
  );
  for (const espace of espaceDuFil.values()) espaces.add(espace);

  const { data: cours } =
    espaces.size === 0
      ? { data: [] }
      : await client.from("teaching_spaces").select("id, subject_id").in("id", [...espaces]);

  const matieres = new Set(
    ((cours ?? []) as { id: string; subject_id: string | null }[])
      .map((c) => c.subject_id)
      .filter(estUnIdentifiant),
  );

  const { data: libelles } =
    matieres.size === 0
      ? { data: [] }
      : await client.from("subjects").select("id, label").in("id", [...matieres]);

  const libelleMatiere = new Map(
    ((libelles ?? []) as { id: string; label: string }[]).map((s) => [s.id, s.label]),
  );
  const matiereDuCours = new Map(
    ((cours ?? []) as { id: string; subject_id: string | null }[]).map((c) => [
      c.id,
      c.subject_id === null ? "Cours" : (libelleMatiere.get(c.subject_id) ?? "Cours"),
    ]),
  );

  // Combien de personnes distinctes ont signalé le même contenu. Le nombre
  // n'emporte aucune décision — il dit seulement s'il s'agit d'une personne
  // isolée ou d'une classe qui réagit.
  const compte = new Map<string, number>();
  for (const ligne of lignes) {
    const cle = ligne.fil_id ?? ligne.reponse_id ?? "";
    compte.set(cle, (compte.get(cle) ?? 0) + 1);
  }

  return lignes.map((ligne) => {
    const fil = ligne.fil_id === null ? null : (parFil.get(ligne.fil_id) ?? null);
    const reponse = ligne.reponse_id === null ? null : (parReponse.get(ligne.reponse_id) ?? null);

    const espace =
      fil !== null
        ? fil.teaching_space_id
        : reponse !== null
          ? (espaceDuFil.get(reponse.fil_id) ?? null)
          : null;

    return {
      id: ligne.id,
      raison: ligne.reason,
      detail: ligne.detail,
      etat: ligne.state,
      signaleLe: ligne.created_at,
      contenu: fil?.question ?? reponse?.texte ?? "",
      cible: fil !== null ? ("fil" as const) : ("reponse" as const),
      masque: (fil?.masque_le ?? reponse?.masque_le ?? null) !== null,
      signalements: compte.get(ligne.fil_id ?? ligne.reponse_id ?? "") ?? 1,
      auteurContenu: noms.get(fil?.auteur_id ?? reponse?.auteur_id ?? "") ?? "Compte supprimé",
      signalePar: noms.get(ligne.reporter_id) ?? "Compte supprimé",
      cours: espace === null ? "Cours" : (matiereDuCours.get(espace) ?? "Cours"),
    };
  });
}

function estUnIdentifiant(valeur: string | null): valeur is string {
  return typeof valeur === "string" && valeur.length > 0;
}

/**
 * Applique une décision de modération.
 *
 * Tout est fait en base, dans une transaction : masquer le contenu, classer le
 * signalement, classer les autres signalements du même contenu, écrire la trace.
 * Séparer ces gestes laisserait, à la première erreur réseau, soit un contenu
 * retiré dont personne ne répond, soit un signalement clos sur un contenu
 * toujours en ligne.
 *
 * Le motif écrit est exigé par la base, pas seulement par l'écran.
 */
export async function moderer(options: {
  moderateur: string;
  signalement: string;
  decision: DecisionModeration;
  justification: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const justification = options.justification.trim();

  if (justification.length < 10) {
    return {
      ok: false,
      message:
        "Écrivez en une phrase ce qui motive cette décision. Elle sera conservée, et c'est ce qui permet d'y répondre plus tard.",
    };
  }

  const { error } = await clientExploitation("moderation_des_signalements").rpc(
    "moderer_signalement",
    {
      p_moderateur: options.moderateur,
      p_signalement: options.signalement,
      p_decision: options.decision,
      p_justification: justification.slice(0, 2000),
    },
  );

  if (error !== null) {
    journaliser("moderation.decider", error.code);
    return { ok: false, message: "La décision n'a pas pu être enregistrée." };
  }
  return { ok: true };
}

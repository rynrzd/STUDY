import "server-only";

import { clientExploitation, clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Devoirs, remises et corrections — cahier V5, §2 à §5.
 *
 * Trois principes gouvernent ce module.
 *
 * **L'état d'un devoir est calculé en base.** `study.devoir_etat` en est la
 * seule définition : brouillon, publié, publié en retard, fermé, archivé. Le
 * recalculer ici ferait deux vérités, et elles finiraient par diverger — un
 * élève verrait « ouvert » là où le serveur refuse.
 *
 * **Une copie n'appartient qu'à son auteur et à son professeur.** Aucune
 * lecture de ce fichier n'accepte d'identifiant d'élève venu du navigateur :
 * c'est RLS qui décide, et une requête forgée ne rend pas un refus, elle rend
 * zéro ligne.
 *
 * **Ce qui doit être atomique passe par une fonction en base.** Remettre une
 * copie lie un fichier, une version et un état. À moitié fait, cela donne soit
 * un fichier que rien ne désigne, soit un « remis » qu'on ne peut pas rouvrir.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ModeRemise = "numerique" | "papier" | "mixte" | "aucune";
export type EtatDevoir = "brouillon" | "publie" | "publie_en_retard" | "ferme" | "archive";
export type EtatRemise =
  | "non_commence"
  | "brouillon"
  | "remis"
  | "remis_en_retard"
  | "retour_disponible"
  | "a_reprendre";

export interface Devoir {
  readonly id: string;
  readonly titre: string;
  readonly consigne: string;
  readonly echeance: string | null;
  readonly mode: ModeRemise;
  readonly remplacementAutorise: boolean;
  readonly politiqueRetard: "accepter_avec_retard" | "fermer";
  readonly etat: EtatDevoir;
  readonly cours: string;
  readonly seance: string | null;
  readonly publieLe: string | null;
  readonly archiveLe: string | null;
}

export interface VersionRemise {
  readonly id: string;
  readonly numero: number;
  readonly remisLe: string;
  readonly enRetard: boolean;
  readonly fichier: string | null;
  readonly nomFichier: string | null;
}

export interface Retour {
  readonly id: string;
  readonly commentaire: string | null;
  readonly fichier: string | null;
  readonly nomFichier: string | null;
  readonly publieLe: string | null;
}

export interface MaRemise {
  readonly etat: EtatRemise;
  readonly versions: readonly VersionRemise[];
  readonly retour: Retour | null;
}

export interface LigneSuivi {
  readonly eleve: string;
  readonly prenom: string;
  readonly nom: string;
  readonly etat: EtatRemise;
  readonly derniere: VersionRemise | null;
  readonly nombreVersions: number;
  readonly retour: Retour | null;
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                     */
/* -------------------------------------------------------------------------- */

function journaliser(contexte: string, code: string | undefined): void {
  if (code === "42501" || code === "PGRST116") return;
  console.error(JSON.stringify({ niveau: "erreur", contexte, code: code ?? "inconnu" }));
}

/** Le texte de la consigne, quel que soit le format dans lequel il est rangé. */
function consigneLisible(instructions: unknown): string {
  if (instructions === null || typeof instructions !== "object") return "";
  const contenu = instructions as { consigne?: unknown; blocs?: unknown };

  if (typeof contenu.consigne === "string") return contenu.consigne;

  if (Array.isArray(contenu.blocs)) {
    return contenu.blocs
      .map((bloc) =>
        bloc !== null && typeof bloc === "object" && typeof (bloc as { texte?: unknown }).texte === "string"
          ? (bloc as { texte: string }).texte
          : "",
      )
      .filter((texte) => texte !== "")
      .join("\n\n");
  }

  return "";
}

interface LigneDevoir {
  id: string;
  title: string;
  instructions: unknown;
  due_at: string | null;
  submission_mode: ModeRemise;
  allow_replacement: boolean;
  late_policy: "accepter_avec_retard" | "fermer";
  state: string;
  published_at: string | null;
  archived_at: string | null;
  teaching_space_id: string;
  lesson_id: string | null;
}

const CHAMPS_DEVOIR =
  "id, title, instructions, due_at, submission_mode, allow_replacement, late_policy, " +
  "state, published_at, archived_at, teaching_space_id, lesson_id";

/**
 * L'état métier, calculé exactement comme la base le calcule.
 *
 * Cette fonction est la seule duplication acceptée de `study.devoir_etat`, et
 * elle existe pour une raison précise : l'écran doit pouvoir afficher l'état
 * sans un aller-retour par ligne. Elle est vérifiée contre la base par un test
 * qui compare les deux sur les mêmes cas — si elles divergent, il échoue.
 */
export function etatDuDevoir(ligne: {
  state: string;
  due_at: string | null;
  late_policy: string;
  archived_at: string | null;
}): EtatDevoir {
  if (ligne.archived_at !== null) return "archive";
  if (ligne.state !== "publiee") return "brouillon";
  if (ligne.due_at === null) return "publie";
  if (Date.now() <= Date.parse(ligne.due_at)) return "publie";
  return ligne.late_policy === "fermer" ? "ferme" : "publie_en_retard";
}

function enDevoir(ligne: LigneDevoir): Devoir {
  return {
    id: ligne.id,
    titre: ligne.title,
    consigne: consigneLisible(ligne.instructions),
    echeance: ligne.due_at,
    mode: ligne.submission_mode,
    remplacementAutorise: ligne.allow_replacement,
    politiqueRetard: ligne.late_policy,
    etat: etatDuDevoir(ligne),
    cours: ligne.teaching_space_id,
    seance: ligne.lesson_id,
    publieLe: ligne.published_at,
    archiveLe: ligne.archived_at,
  };
}

/** Les devoirs d'un professeur, tous cours confondus. RLS fait le tri. */
export async function devoirsDuProfesseur(jeton: string): Promise<Devoir[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("assignments")
    .select(CHAMPS_DEVOIR)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error !== null) {
    journaliser("devoirs.professeur", error.code);
    return [];
  }
  return ((data ?? []) as unknown as LigneDevoir[]).map(enDevoir);
}

/** Un devoir précis. `null` si la personne n'a rien à y voir. */
export async function devoir(jeton: string, id: string): Promise<Devoir | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("assignments")
    .select(CHAMPS_DEVOIR)
    .eq("id", id)
    .maybeSingle();

  if (error !== null) {
    journaliser("devoirs.un", error.code);
    return null;
  }
  return data === null ? null : enDevoir(data as unknown as LigneDevoir);
}

/** Les devoirs visibles par un élève : publiés, non archivés. */
export async function devoirsDeLEleve(jeton: string): Promise<Devoir[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("assignments")
    .select(CHAMPS_DEVOIR)
    .eq("state", "publiee")
    .is("archived_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error !== null) {
    journaliser("devoirs.eleve", error.code);
    return [];
  }
  return ((data ?? []) as unknown as LigneDevoir[]).map(enDevoir);
}

interface LigneVersion {
  id: string;
  version_number: number;
  submitted_at: string;
  late: boolean;
  file_id: string | null;
}

/** La remise d'un élève, avec son historique et sa correction si publiée. */
export async function maRemise(jeton: string, devoirId: string): Promise<MaRemise | null> {
  const client = clientUtilisateur(jeton);

  const { data: copie, error } = await client
    .from("submissions")
    .select("id, state")
    .eq("assignment_id", devoirId)
    .maybeSingle();

  if (error !== null) {
    journaliser("devoirs.ma_remise", error.code);
    return null;
  }
  if (copie === null) return { etat: "non_commence", versions: [], retour: null };

  const ligne = copie as unknown as { id: string; state: EtatRemise };

  const { data: versions } = await client
    .from("submission_versions")
    .select("id, version_number, submitted_at, late, file_id")
    .eq("submission_id", ligne.id)
    .order("version_number", { ascending: false });

  const listes = (versions ?? []) as unknown as LigneVersion[];
  const noms = await nomsDeFichiers(client, listes.map((v) => v.file_id));

  const retour = listes.length === 0 ? null : await retourDeLaVersion(client, listes[0]!.id);

  return {
    etat: ligne.state,
    versions: listes.map((version) => ({
      id: version.id,
      numero: version.version_number,
      remisLe: version.submitted_at,
      enRetard: version.late,
      fichier: version.file_id,
      nomFichier: version.file_id === null ? null : (noms.get(version.file_id) ?? null),
    })),
    retour,
  };
}

/** Les noms d'affichage des fichiers, en un seul aller-retour. */
async function nomsDeFichiers(
  client: ReturnType<typeof clientUtilisateur>,
  identifiants: readonly (string | null)[],
): Promise<Map<string, string>> {
  const utiles = [...new Set(identifiants.filter((id): id is string => id !== null))];
  if (utiles.length === 0) return new Map();

  const { data } = await client.from("files").select("id, display_name").in("id", utiles);

  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((f) => [f.id, f.display_name]),
  );
}

async function retourDeLaVersion(
  client: ReturnType<typeof clientUtilisateur>,
  version: string,
): Promise<Retour | null> {
  const { data } = await client
    .from("feedback")
    .select("id, general_comment, file_id, published_at")
    .eq("submission_version_id", version)
    .maybeSingle();

  if (data === null) return null;
  const ligne = data as unknown as {
    id: string;
    general_comment: string | null;
    file_id: string | null;
    published_at: string | null;
  };

  const noms = await nomsDeFichiers(client, [ligne.file_id]);

  return {
    id: ligne.id,
    commentaire: ligne.general_comment,
    fichier: ligne.file_id,
    nomFichier: ligne.file_id === null ? null : (noms.get(ligne.file_id) ?? null),
    publieLe: ligne.published_at,
  };
}

/**
 * Le suivi d'un devoir : un élève par ligne, remis ou non.
 *
 * La liste part des **élèves de la classe**, pas des copies : un élève qui n'a
 * rien rendu doit apparaître, sinon « non remis » se confondrait avec « pas
 * dans la classe ».
 */
export async function suiviDuDevoir(jeton: string, devoirId: string): Promise<LigneSuivi[]> {
  const client = clientUtilisateur(jeton);

  const { data: leDevoir } = await client
    .from("assignments")
    .select("teaching_space_id")
    .eq("id", devoirId)
    .maybeSingle();

  if (leDevoir === null) return [];
  const cours = (leDevoir as { teaching_space_id: string }).teaching_space_id;

  const { data: espace } = await client
    .from("teaching_spaces")
    .select("class_id")
    .eq("id", cours)
    .maybeSingle();

  if (espace === null) return [];
  const classe = (espace as { class_id: string | null }).class_id;
  if (classe === null) return [];

  const { data: inscrits } = await client
    .from("class_enrollments")
    .select("profile_id")
    .eq("class_id", classe)
    .is("ends_on", null)
    .limit(400);

  const identifiants = ((inscrits ?? []) as { profile_id: string }[]).map((l) => l.profile_id);
  if (identifiants.length === 0) return [];

  const { data: profils } = await client
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", identifiants);

  const { data: copies } = await client
    .from("submissions")
    .select("id, profile_id, state")
    .eq("assignment_id", devoirId);

  const parEleve = new Map(
    ((copies ?? []) as { id: string; profile_id: string; state: EtatRemise }[]).map((c) => [
      c.profile_id,
      c,
    ]),
  );

  const { data: versions } = await client
    .from("submission_versions")
    .select("id, submission_id, version_number, submitted_at, late, file_id")
    .in("submission_id", [...parEleve.values()].map((c) => c.id))
    .order("version_number", { ascending: false });

  const listes = (versions ?? []) as unknown as (LigneVersion & { submission_id: string })[];
  const noms = await nomsDeFichiers(client, listes.map((v) => v.file_id));

  const derniereParCopie = new Map<string, (typeof listes)[number]>();
  const compte = new Map<string, number>();
  for (const version of listes) {
    compte.set(version.submission_id, (compte.get(version.submission_id) ?? 0) + 1);
    if (!derniereParCopie.has(version.submission_id)) {
      derniereParCopie.set(version.submission_id, version);
    }
  }

  const lignes: LigneSuivi[] = [];
  for (const profil of (profils ?? []) as { id: string; first_name: string; last_name: string }[]) {
    const copie = parEleve.get(profil.id);
    const derniere = copie === undefined ? undefined : derniereParCopie.get(copie.id);

    lignes.push({
      eleve: profil.id,
      prenom: profil.first_name,
      nom: profil.last_name,
      etat: copie?.state ?? "non_commence",
      nombreVersions: copie === undefined ? 0 : (compte.get(copie.id) ?? 0),
      derniere:
        derniere === undefined
          ? null
          : {
              id: derniere.id,
              numero: derniere.version_number,
              remisLe: derniere.submitted_at,
              enRetard: derniere.late,
              fichier: derniere.file_id,
              nomFichier:
                derniere.file_id === null ? null : (noms.get(derniere.file_id) ?? null),
            },
      retour: derniere === undefined ? null : await retourDeLaVersion(client, derniere.id),
    });
  }

  return lignes.sort(
    (a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"),
  );
}

/* -------------------------------------------------------------------------- */
/* Écriture                                                                    */
/* -------------------------------------------------------------------------- */

/** Remet une copie. Le fichier est déjà déposé ; ceci le relie, en une fois. */
export async function remettre(options: {
  eleve: string;
  devoir: string;
  fichier: string;
  idempotence: string;
}): Promise<
  | { ok: true; reference: string; remisLe: string; enRetard: boolean; numero: number }
  | { ok: false; message: string }
> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc(
    "devoir_remettre",
    {
      p_eleve: options.eleve,
      p_assignment: options.devoir,
      p_file: options.fichier,
      p_idempotence: options.idempotence,
    },
  );

  if (error !== null) {
    journaliser("devoirs.remettre", error.code);
    return { ok: false, message: messageDeRefus(error.message) };
  }

  const ligne = Array.isArray(data) ? data[0] : null;
  if (ligne === null) return { ok: false, message: "La remise n'a pas pu être enregistrée." };

  return {
    ok: true,
    reference: String(ligne.reference),
    remisLe: String(ligne.remis_le),
    enRetard: ligne.en_retard === true,
    numero: Number(ligne.numero),
  };
}

/** Traduit un refus de la base en une phrase pour la personne. */
function messageDeRefus(brut: string | undefined): string {
  const texte = String(brut ?? "");
  if (texte.includes("remise est fermee")) {
    return "La remise est fermée : l'échéance est passée et ce devoir n'accepte pas les retards.";
  }
  if (texte.includes("n est pas ouvert")) return "Ce devoir n'est pas ouvert aux remises.";
  if (texte.includes("n autorise pas le remplacement")) {
    return "Ce devoir n'autorise pas de remplacer une copie déjà remise.";
  }
  if (texte.includes("n attend pas de fichier")) {
    return "Ce devoir n'attend pas de fichier.";
  }
  if (texte.includes("ne suit pas ce cours")) return "Action refusée.";
  return "La remise n'a pas pu être enregistrée. Réessayez dans un instant.";
}

/** Le professeur constate une remise papier. */
export async function marquerPapier(options: {
  professeur: string;
  devoir: string;
  eleve: string;
  etat: "non_commence" | "remis" | "remis_en_retard";
}): Promise<boolean> {
  const { error } = await clientExploitation("administration_des_comptes").rpc(
    "devoir_marquer_papier",
    {
      p_professeur: options.professeur,
      p_assignment: options.devoir,
      p_eleve: options.eleve,
      p_etat: options.etat,
    },
  );

  if (error !== null) {
    journaliser("devoirs.papier", error.code);
    return false;
  }
  return true;
}

/**
 * Crée un devoir, toujours en brouillon.
 *
 * Jamais publié à la création : un devoir paraît quand son auteur le décide,
 * pas quand il commence à l'écrire. C'est le défaut qui a fait apparaître des
 * consignes inachevées chez les élèves.
 */
export async function creerDevoir(options: {
  jeton: string;
  organisation: string;
  cours: string;
  seance: string | null;
  auteur: string;
  titre: string;
  consigne: string;
  echeance: string | null;
  mode: ModeRemise;
  remplacementAutorise: boolean;
  politiqueRetard: "accepter_avec_retard" | "fermer";
}): Promise<string | null> {
  const { data, error } = await clientUtilisateur(options.jeton)
    .from("assignments")
    .insert({
      organization_id: options.organisation,
      teaching_space_id: options.cours,
      lesson_id: options.seance,
      title: options.titre,
      instructions: { consigne: options.consigne },
      due_at: options.echeance,
      submission_mode: options.mode,
      allow_replacement: options.remplacementAutorise,
      late_policy: options.politiqueRetard,
      state: "brouillon",
      published_at: null,
      created_by: options.auteur,
    })
    .select("id")
    .single();

  if (error !== null || data === null) {
    journaliser("devoirs.creer", error?.code);
    return null;
  }
  return (data as { id: string }).id;
}

/** Modifie un devoir. RLS refuse ceux d'un cours qu'on n'enseigne pas. */
export async function majDevoir(options: {
  jeton: string;
  devoir: string;
  titre: string;
  consigne: string;
  echeance: string | null;
  mode: ModeRemise;
  remplacementAutorise: boolean;
  politiqueRetard: "accepter_avec_retard" | "fermer";
}): Promise<boolean> {
  const { error } = await clientUtilisateur(options.jeton)
    .from("assignments")
    .update({
      title: options.titre,
      instructions: { consigne: options.consigne },
      due_at: options.echeance,
      submission_mode: options.mode,
      allow_replacement: options.remplacementAutorise,
      late_policy: options.politiqueRetard,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.devoir);

  if (error !== null) {
    journaliser("devoirs.maj", error.code);
    return false;
  }
  return true;
}

/**
 * Publie ou dépublie un devoir.
 *
 * Dépublier n'est possible que tant que personne n'a rien rendu. Après une
 * première remise, retirer le devoir ferait disparaître le travail d'un élève
 * de son écran alors qu'il l'a bien rendu — et il n'aurait aucun moyen de le
 * prouver.
 */
export async function publierDevoir(options: {
  jeton: string;
  devoir: string;
  publier: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = clientUtilisateur(options.jeton);

  if (!options.publier) {
    const { count } = await client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", options.devoir)
      .in("state", ["remis", "remis_en_retard"]);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message:
          "Ce devoir a déjà reçu des copies : le dépublier les ferait disparaître de l'écran des élèves. Vous pouvez encore le modifier, ou l'archiver.",
      };
    }
  }

  const { error } = await client
    .from("assignments")
    .update({
      state: options.publier ? "publiee" : "brouillon",
      published_at: options.publier ? new Date().toISOString() : null,
    })
    .eq("id", options.devoir);

  if (error !== null) {
    journaliser("devoirs.publier", error.code);
    return { ok: false, message: "L'état du devoir n'a pas pu être changé." };
  }
  return { ok: true };
}

/** Archive un devoir : il sort des listes, les copies restent. */
export async function archiverDevoir(
  jeton: string,
  devoirId: string,
  archiver: boolean,
): Promise<boolean> {
  const { error } = await clientUtilisateur(jeton)
    .from("assignments")
    .update({ archived_at: archiver ? new Date().toISOString() : null })
    .eq("id", devoirId);

  if (error !== null) {
    journaliser("devoirs.archiver", error.code);
    return false;
  }
  return true;
}

/**
 * Enregistre ou met à jour un retour individuel.
 *
 * Le retour naît en brouillon : le professeur écrit, relit, puis publie. Tant
 * qu'il n'a pas publié, l'élève ne sait même pas qu'un retour existe.
 */
export async function enregistrerRetour(options: {
  jeton: string;
  organisation: string;
  version: string;
  auteur: string;
  commentaire: string;
  fichier: string | null;
}): Promise<string | null> {
  const client = clientUtilisateur(options.jeton);

  const { data: existant } = await client
    .from("feedback")
    .select("id")
    .eq("submission_version_id", options.version)
    .maybeSingle();

  if (existant !== null) {
    const id = (existant as { id: string }).id;
    const champs: Record<string, unknown> = {
      general_comment: options.commentaire,
      updated_at: new Date().toISOString(),
    };
    // Un fichier absent de l'envoi ne retire pas celui qui est déjà là : on ne
    // supprime une correction jointe que si on en dépose une autre.
    if (options.fichier !== null) champs.file_id = options.fichier;

    const { error } = await client.from("feedback").update(champs).eq("id", id);
    if (error !== null) {
      journaliser("devoirs.retour.maj", error.code);
      return null;
    }
    return id;
  }

  const { data, error } = await client
    .from("feedback")
    .insert({
      organization_id: options.organisation,
      submission_version_id: options.version,
      general_comment: options.commentaire,
      file_id: options.fichier,
      created_by: options.auteur,
    })
    .select("id")
    .single();

  if (error !== null || data === null) {
    journaliser("devoirs.retour.creer", error?.code);
    return null;
  }
  return (data as { id: string }).id;
}

/** Publie un retour, ou le retire de la vue de l'élève. */
export async function publierRetour(
  jeton: string,
  retour: string,
  publier: boolean,
): Promise<boolean> {
  const { error } = await clientUtilisateur(jeton)
    .from("feedback")
    .update({ published_at: publier ? new Date().toISOString() : null })
    .eq("id", retour);

  if (error !== null) {
    journaliser("devoirs.retour.publier", error.code);
    return false;
  }
  return true;
}

/**
 * Inscrit les destinataires d'un devoir.
 *
 * `assignments_student_read` ne montre un devoir qu'à qui en est destinataire
 * « concerné ». C'est volontaire — un devoir se donne à des personnes, pas à
 * une salle — mais cela veut dire que la liste doit être écrite, sans quoi le
 * devoir n'existe pour personne.
 *
 * Elle est écrite **à la publication**, pas à la création : entre les deux, un
 * élève peut arriver ou partir, et c'est la classe du jour où le devoir paraît
 * qui compte. Les doublons sont ignorés : republier n'inscrit pas deux fois.
 */
export async function inscrireDestinataires(options: {
  jeton: string;
  organisation: string;
  cours: string;
  devoir: string;
}): Promise<number> {
  const client = clientUtilisateur(options.jeton);

  const { data: espace } = await client
    .from("teaching_spaces")
    .select("class_id, group_id")
    .eq("id", options.cours)
    .maybeSingle();

  const cible = espace as { class_id: string | null; group_id: string | null } | null;
  if (cible === null) return 0;

  const eleves =
    cible.class_id !== null
      ? await client
          .from("class_enrollments")
          .select("profile_id")
          .eq("class_id", cible.class_id)
          .is("ends_on", null)
      : await client.from("group_memberships").select("profile_id").eq("group_id", cible.group_id!);

  const profils = ((eleves.data ?? []) as { profile_id: string }[]).map((l) => l.profile_id);
  if (profils.length === 0) return 0;

  // Ceux qui sont déjà inscrits ne le sont pas deux fois : une republication
  // ne doit rien changer pour un élève qui voyait déjà le devoir.
  const { data: dejaLa } = await client
    .from("assignment_recipients")
    .select("profile_id")
    .eq("assignment_id", options.devoir);

  const connus = new Set(((dejaLa ?? []) as { profile_id: string }[]).map((l) => l.profile_id));
  const nouveaux = profils.filter((profil) => !connus.has(profil));
  if (nouveaux.length === 0) return 0;

  const { error } = await client.from("assignment_recipients").insert(
    nouveaux.map((profil) => ({
      organization_id: options.organisation,
      assignment_id: options.devoir,
      profile_id: profil,
      status: "concerne",
    })),
  );

  if (error !== null) {
    journaliser("devoirs.destinataires", error.code);
    return 0;
  }
  return nouveaux.length;
}

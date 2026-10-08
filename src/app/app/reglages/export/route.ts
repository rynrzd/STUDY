import { NextResponse } from "next/server";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

/**
 * « Télécharger mes données » — droit d'accès et portabilité (RGPD art. 15
 * et 20), exercé par la personne elle-même, en un geste. Répond au point
 * ouvert R-08 du dossier de sécurité.
 *
 * Garde-fous :
 * - lecture sous la session de la personne : les politiques de ligne de la
 *   base s'appliquent, et chaque requête filtre en plus sur son propre
 *   identifiant (défense en profondeur) ;
 * - colonnes nommées, jamais `*` : aucune clé d'idempotence, aucun secret,
 *   aucun alias technique d'authentification ;
 * - une section illisible est signalée dans `sections_non_lues`, jamais
 *   omise en silence ;
 * - aucune donnée d'une autre personne n'est exportée, sauf les
 *   appréciations publiées sur ses propres copies et les messages des
 *   demandes qu'elle a ouvertes ou reçues, qui font partie de son dossier.
 * - réponse privée, non mise en cache, en pièce jointe.
 */
export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX = 20_000;

// Un export par personne et par minute (par instance) : l'export enchaîne une
// vingtaine de lectures, il ne doit pas devenir un moyen de charger la base.
const INTERVALLE_MS = 60_000;
const derniersExports = new Map<string, number>();

type Client = ReturnType<typeof clientUtilisateur>;
type Requete = (debut: number, fin: number) => PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>;

/** Lit toutes les pages d'une requête, bornée à MAX lignes. */
async function toutLire(requete: Requete): Promise<{ lignes: unknown[]; erreur: boolean; tronque: boolean }> {
  const lignes: unknown[] = [];
  for (let debut = 0; debut < MAX; debut += PAGE) {
    const { data, error } = await requete(debut, debut + PAGE - 1);
    if (error !== null) return { lignes, erreur: true, tronque: false };
    lignes.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return { lignes, erreur: false, tronque: false };
  }
  return { lignes, erreur: false, tronque: true };
}

export async function GET() {
  const personne = await sessionCourante();
  if (personne === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const moi = personne.profileId;
  const maintenant = Date.now();
  const precedent = derniersExports.get(moi);
  if (precedent !== undefined && maintenant - precedent < INTERVALLE_MS) {
    const attente = Math.ceil((INTERVALLE_MS - (maintenant - precedent)) / 1000);
    return NextResponse.json(
      { error: { code: "TOO_MANY_REQUESTS", message: `Un export vient d'être préparé. Réessaie dans ${attente} s.` } },
      { status: 429, headers: { "retry-after": String(attente), "cache-control": "no-store" } },
    );
  }
  derniersExports.set(moi, maintenant);
  if (derniersExports.size > 5000) {
    for (const [cle, quand] of derniersExports) if (maintenant - quand >= INTERVALLE_MS) derniersExports.delete(cle);
  }
  const c: Client = clientUtilisateur(jeton);

  const sections: Record<string, unknown> = {};
  const nonLues: string[] = [];
  const tronquees: string[] = [];
  const lire = async (nom: string, requete: Requete) => {
    const r = await toutLire(requete);
    if (r.erreur) nonLues.push(nom);
    if (r.tronque) tronquees.push(nom);
    sections[nom] = r.lignes;
    return r.lignes;
  };

  await lire("profil", (a, b) => c.from("profiles").select("first_name, last_name, professional_email, created_at").eq("id", moi).range(a, b));
  await lire("adhesions", (a, b) =>
    c.from("organization_memberships").select("roles, local_login, account_state, state, activated_at, suspended_at, ended_at, created_at").eq("profile_id", moi).range(a, b),
  );
  await lire("inscriptions_de_classe", (a, b) => c.from("class_enrollments").select("is_principal, starts_on, ends_on, classes(label)").eq("profile_id", moi).range(a, b));

  const remises = (await lire("remises", (a, b) =>
    c.from("submissions").select("id, assignment_id, state, draft_body, draft_updated_at, submitted_count, created_at").eq("profile_id", moi).order("created_at").range(a, b),
  )) as { id: string }[];
  const idsRemises = remises.map((r) => r.id);
  const versions = idsRemises.length
    ? ((await lire("versions_remises", (a, b) =>
        c.from("submission_versions").select("id, submission_id, version_number, body, submitted_at, late").in("submission_id", idsRemises).order("submitted_at").range(a, b),
      )) as { id: string }[])
    : [];
  if (versions.length) {
    await lire("appreciations_recues", (a, b) =>
      c
        .from("feedback")
        .select("submission_version_id, general_comment, rubric, requires_rework, rework_due_at, published_at")
        .in(
          "submission_version_id",
          versions.map((v) => v.id),
        )
        .not("published_at", "is", null)
        .range(a, b),
    );
  }

  await lire("notes_personnelles", (a, b) => c.from("personal_notes").select("lesson_id, chapter_id, body, created_at, updated_at").eq("owner_id", moi).range(a, b));
  await lire("messages_ecrits", (a, b) => c.from("messages").select("workgroup_id, teaching_space_id, body, edited_at, hidden_at, created_at").eq("author_id", moi).order("created_at").range(a, b));
  await lire("reponses_entraide_ecrites", (a, b) => c.from("reponses_entraide").select("fil_id, texte, utile, masque_le, created_at").eq("auteur_id", moi).range(a, b));
  await lire("tentatives_exercices", (a, b) =>
    c.from("tentatives").select("exercice_version_id, reponse, correct, aide_utilisee, temps_actif_s, jour, created_at").eq("profile_id", moi).order("created_at").range(a, b),
  );
  const carnet = await c.rpc("carnet_lire", { p_archivees: true });
  if (carnet.error !== null) nonLues.push("carnet_d_erreurs");
  sections.carnet_d_erreurs = carnet.data ?? [];
  await lire("fiches_de_revision", (a, b) =>
    c.from("fiches_revision").select("titre, format, objectif, longueur, etat, sections, cartes, exercices, limites, created_at, updated_at").eq("owner_id", moi).range(a, b),
  );

  await lire("projets_dont_je_suis_responsable", (a, b) =>
    c.from("projets").select("id, titre, description, visibilite, archived_at, created_at, updated_at").eq("owner_id", moi).range(a, b),
  );
  await lire("notes_de_projet_ecrites", (a, b) => c.from("projet_notes").select("projet_id, kind, titre, corps, url, created_at").eq("auteur_id", moi).range(a, b));
  await lire("taches_de_projet_creees", (a, b) => c.from("projet_taches").select("projet_id, titre, statut, echeance, created_at, updated_at").eq("created_by", moi).range(a, b));
  await lire("orientation", (a, b) =>
    c.from("orientation_pistes").select("kind, intitule, organisation, statut, contact_pro, echeance, notes, created_at, updated_at").eq("owner_id", moi).range(a, b),
  );
  await lire("agenda_personnel", (a, b) => c.from("agenda_evenements").select("kind, titre, debut, fin, lien, created_at").eq("owner_id", moi).range(a, b));
  await lire("reponses_ateliers", (a, b) => c.from("ateliers_reponses").select("atelier_id, annotations, contestation, created_at, updated_at").eq("author_id", moi).range(a, b));
  await lire("reponses_consultations", (a, b) =>
    c.from("consultation_reponses").select("consultation_id, ce_qui_fonctionne, difficulte, proposition, categorie, created_at").eq("author_id", moi).range(a, b),
  );

  const demandes = (await lire("demandes_a_un_adulte", (a, b) =>
    c.from("demandes_adulte").select("id, subject, state, created_at, closed_at, author_id, recipient_id").or(`author_id.eq.${moi},recipient_id.eq.${moi}`).range(a, b),
  )) as { id: string }[];
  if (demandes.length) {
    await lire("messages_des_demandes", (a, b) =>
      c
        .from("demandes_adulte_messages")
        .select("demande_id, author_id, body, created_at")
        .in(
          "demande_id",
          demandes.map((d) => d.id),
        )
        .order("created_at")
        .range(a, b),
    );
  }

  const corps = {
    format: "avecstudy-export-personnel",
    version: 1,
    exporte_le: new Date().toISOString(),
    personne: { prenom: personne.prenom, nom: personne.nom, etablissement: personne.organisation },
    a_savoir: [
      "Ce fichier contient les données vous concernant que votre session permet de lire, au moment de l'export.",
      "Les identifiants (assignment_id, lesson_id…) renvoient aux contenus de votre établissement ; ces contenus ne sont pas recopiés ici.",
      "Pour une rectification ou un effacement, adressez-vous à votre établissement, responsable du traitement.",
    ],
    sections_non_lues: nonLues,
    sections_tronquees: tronquees,
    donnees: sections,
  };
  const jour = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(corps, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename=mes-donnees-avecstudy-${jour}.json`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

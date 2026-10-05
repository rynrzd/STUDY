import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Lectures de l'espace élève V6. Tout passe par le jeton de la personne :
 * RLS décide. Aucune fonction n'accepte un identifiant d'élève.
 */

export interface SeanceResumee {
  readonly id: string;
  readonly titre: string;
  readonly objectif: string | null;
  readonly cours: string | null;
  readonly coursId: string;
  readonly chapitre: string | null;
  readonly publieeLe: string | null;
}

interface LigneLecon {
  id: string;
  title: string;
  objective: string | null;
  teaching_space_id: string;
  published_at: string | null;
  chapters: { label: string } | null;
  teaching_spaces: { subjects: { label: string } | null } | null;
}

function resumer(l: LigneLecon): SeanceResumee {
  return {
    id: l.id,
    titre: l.title,
    objectif: l.objective,
    cours: l.teaching_spaces?.subjects?.label ?? null,
    coursId: l.teaching_space_id,
    chapitre: l.chapters?.label ?? null,
    publieeLe: l.published_at,
  };
}

const COLONNES_LECON = "id, title, objective, teaching_space_id, published_at, chapters(label), teaching_spaces(subjects(label))";

/** La séance à reprendre : la dernière lue encore accessible, sinon la plus récente. */
export async function seanceAReprendre(jeton: string): Promise<{ seance: SeanceResumee; dejaLue: boolean } | null> {
  const client = clientUtilisateur(jeton);
  const lue = await client.from("lectures_seance").select("lesson_id, lu_le").order("lu_le", { ascending: false }).limit(5);
  for (const l of (lue.data ?? []) as { lesson_id: string }[]) {
    const { data } = await client
      .from("lessons")
      .select(COLONNES_LECON)
      .eq("id", l.lesson_id)
      .eq("state", "publiee")
      .is("archived_at", null)
      .maybeSingle();
    if (data) return { seance: resumer(data as unknown as LigneLecon), dejaLue: true };
  }
  const recente = await client
    .from("lessons")
    .select(COLONNES_LECON)
    .eq("state", "publiee")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return recente.data ? { seance: resumer(recente.data as unknown as LigneLecon), dejaLue: false } : null;
}

export interface EvenementSemaine {
  readonly id: string;
  readonly kind: string;
  readonly titre: string;
  readonly debut: string;
  readonly fin: string | null;
  readonly lien: string | null;
  readonly personnel: boolean;
  readonly contexte: string | null;
  readonly modifiable: boolean;
}

export async function agenda(jeton: string, debut: Date, fin: Date): Promise<EvenementSemaine[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("agenda_periode", {
    p_debut: debut.toISOString(),
    p_fin: fin.toISOString(),
  });
  if (error !== null) return null;
  return (data ?? []) as EvenementSemaine[];
}

export interface NouvelleClasse {
  readonly id: string;
  readonly genre: string;
  readonly objet: string;
  readonly contexte: Record<string, unknown>;
  readonly survenuLe: string;
  readonly luLe: string | null;
}

export async function notifications(jeton: string, options: { limite?: number; nonLuesSeulement?: boolean } = {}) {
  let requete = clientUtilisateur(jeton)
    .from("nouveautes")
    .select("id, genre, objet, contexte, created_at, lu_le")
    .order("created_at", { ascending: false })
    .limit(options.limite ?? 50);
  if (options.nonLuesSeulement) requete = requete.is("lu_le", null);
  const { data, error } = await requete;
  if (error !== null) return null;
  return ((data ?? []) as { id: string; genre: string; objet: string; contexte: Record<string, unknown>; created_at: string; lu_le: string | null }[]).map(
    (n) => ({ id: n.id, genre: n.genre, objet: n.objet, contexte: n.contexte ?? {}, survenuLe: n.created_at, luLe: n.lu_le }),
  );
}

/** Texte et lien d'une notification. Le lien rouvre l'objet : ses droits sont revérifiés à l'ouverture. */
export function decrireNotification(n: NouvelleClasse): { titre: string; lien: string; sujet: string } {
  const c = n.contexte as Record<string, string | number | undefined>;
  const nombre = typeof c.nombre === "number" && c.nombre > 1 ? c.nombre : null;
  switch (n.genre) {
    case "reponse_fil":
      return {
        sujet: "Messagerie",
        titre: nombre ? `${nombre} nouvelles réponses à ton message` : "Nouvelle réponse à ton message",
        lien: c.classe_id && c.salon_id ? `/app/classes/${c.classe_id}/salons/${c.salon_id}?fil=${n.objet}` : "/app/messagerie",
      };
    case "annonce":
      return {
        sujet: "Messagerie",
        titre: `Annonce dans ${String(c.salon ?? "un salon")}`,
        lien: c.classe_id && c.salon_id ? `/app/classes/${c.classe_id}/salons/${c.salon_id}?message=${n.objet}` : "/app/messagerie",
      };
    case "consultation_ouverte":
      return {
        sujet: "Vie de classe",
        titre: `Consultation ouverte : ${String(c.titre ?? "")}`,
        lien: c.classe_id ? `/app/classes/${c.classe_id}/consultations/${n.objet}` : "/app/classe",
      };
    case "fiche_prete":
      return {
        sujet: "Révisions",
        titre:
          c.etat === "failed"
            ? `Ta fiche « ${String(c.titre ?? "")} » n'a pas pu être préparée`
            : c.etat === "needs_review"
              ? `Ta fiche « ${String(c.titre ?? "")} » demande une précision`
              : `Ta fiche « ${String(c.titre ?? "")} » est prête`,
        lien: `/app/fiches/${n.objet}`,
      };
    case "adhesion_decidee":
      return { sujet: "Accès", titre: c.etat === "acceptee" ? "Ta demande d'accès a été acceptée" : "Ta demande d'accès a reçu une réponse", lien: "/app" };
    case "invitation_projet":
      return { sujet: "Projets", titre: `Invitation au projet « ${String(c.titre ?? "")} »`, lien: `/app/projets/${n.objet}` };
    case "demande_adulte":
      return { sujet: "Messagerie", titre: "Nouveau message dans une demande personnelle", lien: `/app/demandes/${n.objet}` };
    case "devoir_publie":
      return { sujet: "Travail", titre: `Nouveau devoir : ${String(c.titre ?? "")}`, lien: `/app/devoirs/${n.objet}` };
    case "devoir_modifie":
      return { sujet: "Travail", titre: `Devoir modifié : ${String(c.titre ?? "")}`, lien: `/app/devoirs/${n.objet}` };
    case "echeance_proche":
      return { sujet: "Travail", titre: `Échéance proche : ${String(c.titre ?? "")}`, lien: `/app/devoirs/${n.objet}` };
    case "correction_publiee":
    case "retour_individuel":
      return { sujet: "Travail", titre: `Correction disponible : ${String(c.titre ?? "")}`, lien: `/app/devoirs/${n.objet}` };
    default:
      return { sujet: "Study", titre: "Nouveauté", lien: "/app" };
  }
}

export interface RevisionCollective {
  readonly id: string;
  readonly titre: string;
  readonly debut: string;
  readonly capacite: number;
  readonly inscrits: number;
  readonly etat: string;
  readonly classId: string;
}

export async function revisionsCollectives(jeton: string, classe?: string | null): Promise<RevisionCollective[]> {
  let requete = clientUtilisateur(jeton)
    .from("revisions_collectives")
    .select("id, titre, debut, capacite, etat, class_id")
    .gte("debut", new Date().toISOString())
    .eq("etat", "ouverte")
    .order("debut")
    .limit(10);
  if (classe) requete = requete.eq("class_id", classe);
  const { data } = await requete;
  const lignes = (data ?? []) as { id: string; titre: string; debut: string; capacite: number; etat: string; class_id: string }[];
  return lignes.map((r) => ({ id: r.id, titre: r.titre, debut: r.debut, capacite: r.capacite, inscrits: 0, etat: r.etat, classId: r.class_id }));
}

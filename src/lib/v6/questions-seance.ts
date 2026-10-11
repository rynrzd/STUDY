import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";
import { nomsAffichables } from "./classe.ts";
import { resumePassagesIncompris } from "./passages.ts";

/**
 * Les questions de la classe qui citent une séance (salons, `kind =
 * 'question'`, `lesson_id`). Elles étaient posées « avec la séance citée »
 * mais n'apparaissaient nulle part sur la séance : l'élève qui relisait le
 * cours ne retrouvait pas les réponses déjà données et reposait la question.
 *
 * Lectures sous le jeton de la personne : la politique `messages_salon_lecture`
 * ne rend que les salons qu'elle peut lire, et masque les messages retirés par
 * la modération. Aucun filtre côté client ne fait office de droit.
 */

export interface QuestionDeSeance {
  readonly id: string;
  readonly href: string;
  readonly salon: string;
  readonly texte: string;
  readonly auteur: string;
  readonly le: string;
  readonly memeQuestion: number;
  readonly moiAussi: boolean;
  readonly reponses: number;
  /** Première réponse d'un adulte (professeur), s'il y en a une. */
  readonly reponseAdulte: { readonly texte: string; readonly auteur: string; readonly le: string } | null;
  readonly deMoi: boolean;
}

interface Ligne {
  id: string;
  salon_id: string;
  author_id: string;
  body: string;
  created_at: string;
  salons: { label: string; class_id: string | null } | null;
}

const LIMITE = 30;

export async function questionsDeLaSeance(jeton: string, moi: string, seance: string): Promise<QuestionDeSeance[] | null> {
  const client = clientUtilisateur(jeton);
  const { data, error } = await client
    .from("messages_salon")
    .select("id, salon_id, author_id, body, created_at, salons(label, class_id)")
    .eq("kind", "question")
    .eq("lesson_id", seance)
    .is("parent_id", null)
    .is("deleted_at", null)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (error !== null) return null;
  const lignes = (data ?? []) as unknown as Ligne[];
  if (lignes.length === 0) return [];
  const ids = lignes.map((l) => l.id);

  const [compteurs, reponses] = await Promise.all([
    client.rpc("salon_compteurs", { p_messages: ids }),
    client
      .from("messages_salon")
      .select("parent_id, author_id, body, created_at")
      .in("parent_id", ids)
      .is("deleted_at", null)
      .is("hidden_at", null)
      .order("created_at", { ascending: true })
      .limit(300),
  ]);
  const parId = new Map(
    ((compteurs.data ?? []) as { message_id: string; meme_question: number; moi_aussi: boolean; reponses: number }[]).map((c) => [c.message_id, c]),
  );
  const lesReponses = (reponses.data ?? []) as { parent_id: string; author_id: string; body: string; created_at: string }[];
  const noms = await nomsAffichables(jeton, [...lignes.map((l) => l.author_id), ...lesReponses.map((r) => r.author_id)]);

  return lignes.map((l) => {
    const c = parId.get(l.id);
    const adulte = lesReponses.find((r) => r.parent_id === l.id && noms.get(r.author_id)?.adulte === true) ?? null;
    return {
      id: l.id,
      href: l.salons?.class_id ? `/app/classes/${l.salons.class_id}/salons/${l.salon_id}?fil=${l.id}` : `/app/messagerie/${l.salon_id}?fil=${l.id}`,
      salon: l.salons?.label ?? "Salon",
      texte: l.body,
      auteur: noms.get(l.author_id)?.affichage ?? "Un membre de la classe",
      le: l.created_at,
      memeQuestion: c?.meme_question ?? 0,
      moiAussi: c?.moi_aussi ?? false,
      reponses: c?.reponses ?? lesReponses.filter((r) => r.parent_id === l.id).length,
      reponseAdulte: adulte ? { texte: adulte.body, auteur: noms.get(adulte.author_id)?.affichage ?? "Professeur", le: adulte.created_at } : null,
      deMoi: l.author_id === moi,
    };
  });
}

export interface PointBloquant {
  readonly seance: string;
  readonly titre: string;
  readonly questions: number;
  readonly sansReponse: number;
  /** Total des « j'ai la même question » sur ces questions (une personne peut en cocher plusieurs). */
  readonly memeQuestion: number;
  /** Passages signalés « pas compris » (0062), et élèves distincts qui les ont signalés. */
  readonly passagesIncompris: number;
  readonly elevesPassages: number;
  readonly exemple: string;
  readonly href: string;
}

/**
 * Côté professeur : les séances qui font buter les élèves. Regroupe les
 * questions des salons lisibles par le professeur par séance citée ; compte
 * celles sans réponse et les « j'ai la même question » (des nombres, jamais
 * de noms), puis ajoute les passages « pas compris ». Chaque nombre est
 * affiché tel quel : on n'additionne pas des grandeurs différentes.
 */
export async function pointsBloquants(jeton: string, limite = 5): Promise<PointBloquant[] | null> {
  const client = clientUtilisateur(jeton);
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data, error }, passages] = await Promise.all([
    client
      .from("messages_salon")
      .select("id, lesson_id, body, created_at, lessons(title)")
      .eq("kind", "question")
      .not("lesson_id", "is", null)
      .is("parent_id", null)
      .is("deleted_at", null)
      .is("hidden_at", null)
      .gte("created_at", depuis)
      .order("created_at", { ascending: false })
      .limit(200),
    resumePassagesIncompris(jeton),
  ]);
  if (error !== null) return null;
  const lignes = (data ?? []) as unknown as { id: string; lesson_id: string; body: string; lessons: { title: string } | null }[];
  const compteurs =
    lignes.length === 0 ? [] : (((await client.rpc("salon_compteurs", { p_messages: lignes.map((l) => l.id) })).data ?? []) as { message_id: string; meme_question: number; reponses: number }[]);
  const parId = new Map(compteurs.map((c) => [c.message_id, c]));

  type Point = { -readonly [K in keyof PointBloquant]: PointBloquant[K] };
  const parSeance = new Map<string, Point>();
  const point = (seance: string, titre: string): Point => {
    let p = parSeance.get(seance);
    if (p === undefined) {
      p = { seance, titre, questions: 0, sansReponse: 0, memeQuestion: 0, passagesIncompris: 0, elevesPassages: 0, exemple: "", href: `/app/seances/${seance}?onglet=questions` };
      parSeance.set(seance, p);
    }
    return p;
  };
  for (const l of lignes) {
    const c = parId.get(l.id);
    const p = point(l.lesson_id, l.lessons?.title ?? "Séance");
    p.questions += 1;
    if ((c?.reponses ?? 0) === 0) p.sansReponse += 1;
    p.memeQuestion += c?.meme_question ?? 0;
    p.exemple ||= l.body; // la plus récente (tri décroissant)
  }
  for (const [seance, r] of passages) {
    const p = point(seance, r.titre);
    p.passagesIncompris = r.passages;
    p.elevesPassages = r.eleves;
    if (p.questions === 0) p.href = `/app/seances/${seance}`;
  }
  // Ordre : ce qui attend une réponse d'abord, puis l'ampleur.
  const poids = (p: Point) => p.sansReponse * 3 + p.questions + p.memeQuestion + p.elevesPassages;
  return [...parSeance.values()].sort((a, b) => poids(b) - poids(a)).slice(0, limite);
}

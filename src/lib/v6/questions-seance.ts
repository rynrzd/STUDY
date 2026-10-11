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
  readonly elevesConcernes: number;
  /** Passages signalés « pas compris » (0062), en nombre ; 0 si aucun. */
  readonly passagesIncompris: number;
  readonly exemple: string;
  readonly href: string;
}

/**
 * Côté professeur : les séances qui font buter les élèves. Regroupe les
 * questions des salons lisibles par le professeur par séance citée ; compte
 * celles sans réponse et les « j'ai la même question » (nombre de personnes,
 * jamais leurs noms). Sert à décider quoi reprendre en classe.
 */
export async function pointsBloquants(jeton: string, limite = 5): Promise<PointBloquant[] | null> {
  const client = clientUtilisateur(jeton);
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await client
    .from("messages_salon")
    .select("id, lesson_id, body, created_at, lessons(title)")
    .eq("kind", "question")
    .not("lesson_id", "is", null)
    .is("parent_id", null)
    .is("deleted_at", null)
    .is("hidden_at", null)
    .gte("created_at", depuis)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error !== null) return null;
  const lignes = (data ?? []) as unknown as { id: string; lesson_id: string; body: string; created_at: string; lessons: { title: string } | null }[];
  const passages = await resumePassagesIncompris(jeton);
  if (lignes.length === 0 && passages.size === 0) return [];
  const compteurs = (await client.rpc("salon_compteurs", { p_messages: lignes.map((l) => l.id) })).data ?? [];
  const parId = new Map((compteurs as { message_id: string; meme_question: number; reponses: number }[]).map((c) => [c.message_id, c]));

  const parSeance = new Map<string, PointBloquant & { poids: number }>();
  for (const l of lignes) {
    const c = parId.get(l.id);
    const actuel = parSeance.get(l.lesson_id);
    const sansReponse = (c?.reponses ?? 0) === 0 ? 1 : 0;
    const concernes = 1 + (c?.meme_question ?? 0);
    parSeance.set(l.lesson_id, {
      seance: l.lesson_id,
      titre: l.lessons?.title ?? "Séance",
      questions: (actuel?.questions ?? 0) + 1,
      sansReponse: (actuel?.sansReponse ?? 0) + sansReponse,
      elevesConcernes: (actuel?.elevesConcernes ?? 0) + concernes,
      passagesIncompris: 0,
      exemple: actuel?.exemple ?? l.body,
      href: `/app/seances/${l.lesson_id}?onglet=questions`,
      poids: (actuel?.poids ?? 0) + concernes + sansReponse * 2,
    });
  }
  for (const [seance, r] of passages) {
    const actuel = parSeance.get(seance);
    parSeance.set(seance, {
      seance,
      titre: actuel?.titre ?? r.titre,
      questions: actuel?.questions ?? 0,
      sansReponse: actuel?.sansReponse ?? 0,
      elevesConcernes: Math.max(actuel?.elevesConcernes ?? 0, r.eleves),
      passagesIncompris: r.passages,
      exemple: actuel?.exemple ?? "",
      href: `/app/seances/${seance}`,
      poids: (actuel?.poids ?? 0) + r.eleves + r.passages,
    });
  }
  return [...parSeance.values()]
    .sort((a, b) => b.poids - a.poids)
    .slice(0, limite)
    .map(({ poids: _poids, ...p }) => p);
}

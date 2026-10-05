import { assembler, type FormatFiche, type Passage, type SourceAssemblage } from "./assemblage.ts";

/**
 * Le travail « fiche_revision » de la file — dossier Study V6, §8.1 et E40.
 *
 * Trois temps, chacun côté base :
 *
 *  1. `fiche_preparer` passe la fiche en traitement et rend ses passages,
 *     après avoir vérifié que **le propriétaire** lit encore chaque séance ;
 *  2. l'assemblage, ici, en mémoire — déterministe, sans réseau ;
 *  3. `fiche_terminer` revérifie les sources avant d'écrire : une séance
 *     retirée entre-temps fait échouer la fiche sans rien en restituer.
 *
 * Le module ne connaît qu'une fonction `rpc` : le drain lui passe le client
 * de service, les tests une base embarquée. Le journal ne reçoit ni texte de
 * cours ni nom d'élève.
 */

export type AppelRpc = (
  nom: string,
  parametres: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

interface LignePreparation {
  owner_id: string;
  format: FormatFiche;
  objectif: "essentiel" | "comprendre";
  longueur: "courte" | "detaillee";
  lesson_id: string;
  lisible: boolean;
  titre: string | null;
  passages: Passage[] | null;
  exercices: string[] | null;
}

export type IssueFiche = "ready" | "needs_review" | "failed" | "canceled" | "introuvable";

export async function traiterFiche(rpc: AppelRpc, fiche: string): Promise<IssueFiche> {
  const { data, error } = await rpc("fiche_preparer", { p_fiche: fiche });
  if (error !== null) throw new Error("fiche_preparer");

  const lignes = (data ?? []) as LignePreparation[];
  // Aucune ligne : la fiche a été annulée, ou n'existe plus. Rien à faire.
  if (lignes.length === 0) return "canceled";

  const premiere = lignes[0]!;
  const sources: SourceAssemblage[] = lignes.map((ligne) => ({
    lessonId: ligne.lesson_id,
    titre: ligne.titre,
    lisible: ligne.lisible,
    passages: ligne.passages ?? [],
    exercices: ligne.exercices,
  }));

  const resultat = assembler({
    format: premiere.format,
    objectif: premiere.objectif,
    longueur: premiere.longueur,
    sources,
  });

  const fin = await rpc("fiche_terminer", {
    p_fiche: fiche,
    p_etat: resultat.etat,
    p_sections: resultat.sections,
    p_cartes: resultat.cartes,
    p_exercices: resultat.exercices,
    p_limites: resultat.limites,
    p_erreur: null,
  });
  if (fin.error !== null) throw new Error("fiche_terminer");
  return (fin.data as IssueFiche | null) ?? "introuvable";
}

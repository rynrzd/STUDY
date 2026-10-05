import "server-only";

import { randomUUID } from "node:crypto";
import { clientUtilisateur } from "../supabase-serveur.ts";
import {
  classer,
  normaliserRequete,
  paginer,
  suggerer,
  type Candidat,
  type GenreResultat,
  type Resultat,
} from "./moteur.ts";

/**
 * Recherche, côté serveur — dossier Study V6, §7.3.
 *
 * La sélection se fait dans la base, sous l'identité de la personne : RLS
 * filtre l'index avant le classement, et la fonction `study.recherche`
 * revérifie chaque source vivante. Ce module ajoute la fusion et la mise en
 * forme ; il ne voit jamais un candidat interdit.
 *
 * Branche sémantique : aucun fournisseur d'embeddings n'est configuré
 * (décision du 5 octobre 2026). Le mode est donc « lexical », et l'écran le
 * dit. `brancheSemantique` est l'endroit où un fournisseur se brancherait :
 * il devra lui aussi interroger des candidats déjà autorisés.
 */

export const GENRES: readonly GenreResultat[] = ["seance", "exercice", "fiche", "message", "decision", "projet"];

export interface ReponseRecherche {
  readonly items: readonly Resultat[];
  readonly mode: "hybride" | "lexical";
  readonly suivant: string | null;
  readonly suggestion: string | null;
  readonly requestId: string;
  readonly facettes: Readonly<Partial<Record<GenreResultat, number>>>;
}

export class ErreurRecherche extends Error {
  constructor(
    readonly code: "NON_AUTHENTIFIE" | "INDISPONIBLE",
    readonly requestId: string,
  ) {
    super(code);
  }
}

async function brancheSemantique(): Promise<Candidat[] | null> {
  // Aucun fournisseur : null signifie « indisponible », pas « aucun résultat ».
  return null;
}

export async function rechercher(
  jeton: string,
  parametres: { q: string; types?: readonly GenreResultat[]; classe?: string | null; curseur?: string | null },
): Promise<ReponseRecherche> {
  const requestId = randomUUID();
  const q = normaliserRequete(parametres.q);
  const types = (parametres.types ?? []).filter((t) => GENRES.includes(t));
  const vide: ReponseRecherche = { items: [], mode: "lexical", suivant: null, suggestion: null, requestId, facettes: {} };
  if (q.length < 2) return vide;

  const client = clientUtilisateur(jeton);
  const { data, error } = await client.rpc("recherche", {
    p_q: q,
    p_types: types.length > 0 ? types : null,
    p_classe: parametres.classe ?? null,
    p_limite: 60,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "recherche", code: error.code, requestId }));
    throw new ErreurRecherche(error.code === "28000" ? "NON_AUTHENTIFIE" : "INDISPONIBLE", requestId);
  }

  const lexical = (data ?? []) as Candidat[];
  const semantique = await brancheSemantique();
  const tous = classer(lexical, semantique ?? [], q);

  // Les facettes ne comptent que ce qui vient d'être autorisé et rendu.
  const facettes: Partial<Record<GenreResultat, number>> = {};
  for (const r of tous) facettes[r.kind] = (facettes[r.kind] ?? 0) + 1;

  const perimetre = `${parametres.classe ?? "toutes"}|${types.join(",")}`;
  const { items, suivant } = paginer(tous, q, perimetre, parametres.curseur ?? null);

  let suggestion: string | null = null;
  if (tous.length === 0) {
    const vocabulaire = await client.rpc("recherche_vocabulaire");
    if (vocabulaire.error === null) {
      suggestion = suggerer(q, ((vocabulaire.data ?? []) as { mot: string }[]).map((v) => v.mot));
    }
  }

  return { items, mode: semantique === null ? "lexical" : "hybride", suivant, suggestion, requestId, facettes };
}

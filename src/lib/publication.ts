import "server-only";

import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Publication d'un document du Studio dans plusieurs cours (0066, cahier des
 * charges ch. 14).
 *
 * Les trois fonctions passent par la clé privilégiée, comme la publication
 * mono-cible : l'identité de la personne est relue côté serveur (session), et
 * la base revérifie l'auteur du document et chaque affectation au moment de
 * l'appel. Rien de ce qui arrive du navigateur n'est cru sur parole.
 */

export type GenreCible = "classe" | "groupe";

export interface CiblePublication {
  readonly id: string;
  readonly matiere: string;
  readonly cible: string;
  readonly genre: GenreCible;
  readonly effectif: number;
  readonly dejaPublie: boolean;
  readonly versionAJour: boolean;
  /** Date de publication prévue (UTC), si la séance est programmée. */
  readonly programmeePour: string | null;
  /** La séance déjà créée dans ce cours, s'il y en a une. */
  readonly seance: string | null;
}

export type IssuePublication = "publiee" | "mise_a_jour" | "deja_publiee" | "programmee" | "refusee";

export interface ResultatCible {
  readonly cible: string;
  readonly resultat: IssuePublication;
  readonly seance: string | null;
  readonly raison: "non_affecte" | "cours_introuvable" | "deja_visible" | "erreur" | null;
}

function journaliser(contexte: string, code: string | undefined) {
  console.error(JSON.stringify({ niveau: "erreur", contexte: `publication.${contexte}`, code: code ?? "inconnu" }));
}

/** Les cours où la personne enseigne aujourd'hui, avec effectif réel ; `null` si la lecture échoue. */
export async function ciblesPublication(acteur: string, document: string): Promise<CiblePublication[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("studio_cibles_publication", {
    p_acteur: acteur,
    p_document: document,
  });
  if (error !== null) {
    journaliser("cibles", error.code);
    return null;
  }
  return ((data ?? []) as {
    teaching_space_id: string;
    matiere: string;
    cible: string | null;
    genre: GenreCible;
    effectif: number;
    deja_publie: boolean;
    version_a_jour: boolean;
    programmee_pour: string | null;
    seance: string | null;
  }[]).map((l) => ({
    id: l.teaching_space_id,
    matiere: l.matiere,
    cible: l.cible ?? "",
    genre: l.genre,
    effectif: l.effectif,
    dejaPublie: l.deja_publie,
    versionAJour: l.version_a_jour,
    programmeePour: l.programmee_pour,
    seance: l.seance,
  }));
}

/** Élèves distincts derrière une sélection ; `null` si la lecture échoue. */
export async function destinatairesUniques(acteur: string, cours: readonly string[]): Promise<number | null> {
  if (cours.length === 0) return 0;
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("studio_destinataires_uniques", {
    p_acteur: acteur,
    p_cours: cours,
  });
  if (error !== null) {
    journaliser("destinataires", error.code);
    return null;
  }
  return typeof data === "number" ? data : null;
}

/** Publie dans chaque cible ; le résultat est rendu cible par cible, ou `null` si l'ensemble est refusé. */
export async function publierPlusieurs(
  acteur: string,
  document: string,
  cours: readonly string[],
  titre: string,
): Promise<ResultatCible[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("studio_publier_plusieurs", {
    p_acteur: acteur,
    p_document: document,
    p_cours: cours,
    p_titre: titre,
  });
  if (error !== null) {
    journaliser("publier", error.code);
    return null;
  }
  return ((data ?? []) as { cible: string; resultat: IssuePublication; seance: string | null; raison: ResultatCible["raison"] }[]).map((l) => ({
    cible: l.cible,
    resultat: l.resultat,
    seance: l.seance,
    raison: l.raison,
  }));
}

/** Programme la publication dans chaque cible, à une date (ISO, UTC). */
export async function programmerPlusieurs(
  acteur: string,
  document: string,
  cours: readonly string[],
  titre: string,
  quand: string,
): Promise<ResultatCible[] | { refus: "date" } | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("studio_programmer_plusieurs", {
    p_acteur: acteur,
    p_document: document,
    p_cours: cours,
    p_titre: titre,
    p_quand: quand,
  });
  if (error !== null) {
    journaliser("programmer", error.code);
    return (error.message ?? "").includes("date de programmation") ? { refus: "date" } : null;
  }
  return ((data ?? []) as { cible: string; resultat: IssuePublication; seance: string | null; raison: ResultatCible["raison"] }[]).map((l) => ({
    cible: l.cible,
    resultat: l.resultat,
    seance: l.seance,
    raison: l.raison,
  }));
}

/** Annule une programmation avant l'heure ; `false` si la base refuse. */
export async function annulerProgrammation(acteur: string, seance: string): Promise<boolean> {
  const { error } = await clientExploitation("administration_des_comptes").rpc("studio_annuler_programmation", {
    p_acteur: acteur,
    p_seance: seance,
  });
  if (error !== null) {
    journaliser("annuler_programmation", error.code);
    return false;
  }
  return true;
}

// Au plus une bascule toutes les 30 s par serveur : chaque page de
// l'application la déclenche, la requête est indexée et presque toujours vide.
const INTERVALLE_BASCULE_MS = 30_000;
let derniereBascule = 0;

/**
 * Fait passer en « publiée » les séances dont l'heure programmée est venue.
 * Appelée par le gabarit de l'application et par la tâche de nuit ; une erreur
 * ne bloque jamais l'affichage d'une page.
 */
export async function publierSeancesEchues(): Promise<number | null> {
  const maintenant = Date.now();
  if (maintenant - derniereBascule < INTERVALLE_BASCULE_MS) return 0;
  derniereBascule = maintenant;
  const { data, error } = await clientExploitation("tache_planifiee").rpc("publier_seances_echues");
  if (error !== null) {
    journaliser("bascule", error.code);
    return null;
  }
  return typeof data === "number" ? data : null;
}

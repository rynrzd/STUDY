import "server-only";

import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Dupliquer une séance — cahier V5, §4.5.
 *
 * L'appel passe par le client privilégié parce que la fonction en base doit
 * écrire dans **deux** cours à la fois, et que RLS raisonne sur les lignes
 * visibles, pas sur une intention. La contrepartie est écrite dans la fonction
 * elle-même : elle vérifie que le professeur enseigne l'origine **et** la
 * destination, à partir des affectations réelles. L'identité vient de la
 * session, jamais du formulaire.
 */

export interface Duplication {
  readonly seance: string;
  readonly blocsCopies: number;
  readonly devoirsIgnores: number;
}

export async function dupliquerSeance(options: {
  acteur: string;
  seance: string;
  coursCible: string;
  titre: string | null;
}): Promise<Duplication | { erreur: string }> {
  const { data, error } = await clientExploitation("duplication_de_seance").rpc(
    "studio_dupliquer_seance",
    {
      p_acteur: options.acteur,
      p_seance: options.seance,
      p_cours_cible: options.coursCible,
      p_titre: options.titre,
    },
  );

  if (error !== null) {
    return { erreur: messageLisible(error.message) };
  }

  const ligne = (Array.isArray(data) ? data[0] : null) as
    | { seance: string; blocs_copies: number; devoirs_ignores: number }
    | null;

  if (ligne === null) {
    return { erreur: "La séance n'a pas pu être dupliquée." };
  }

  return {
    seance: ligne.seance,
    blocsCopies: ligne.blocs_copies,
    devoirsIgnores: ligne.devoirs_ignores,
  };
}

/**
 * Le refus de la base, dit à un professeur.
 *
 * Les messages de la fonction sont déjà écrits pour être lus — ils disent ce
 * qui manque, pas un code. On les reprend tels quels quand on les reconnaît,
 * et on tait le reste : un message d'erreur PostgreSQL brut apprend la
 * structure de la base à qui le lit.
 */
function messageLisible(brut: string): string {
  // L'ordre compte : « la destination est le cours d origine » contient
  // « cours d origine », et serait pris pour un refus d'affectation.
  if (brut.includes("la destination est")) {
    return "Choisissez une autre classe que celle d'origine.";
  }
  if (brut.includes("destination introuvable")) {
    return "Cette classe n'existe pas dans votre établissement.";
  }
  if (brut.includes("cours de destination")) {
    return "Vous n'enseignez pas dans la classe choisie.";
  }
  if (brut.includes("cours d origine")) {
    return "Vous n'enseignez pas dans le cours d'origine.";
  }
  if (brut.includes("seance introuvable")) {
    return "Cette séance n'existe plus.";
  }
  return "La séance n'a pas pu être dupliquée.";
}

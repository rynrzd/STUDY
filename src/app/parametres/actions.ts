"use server";

import { changerMotDePasse, FournisseurSupabase } from "@/lib/fournisseur-supabase";
import { controlerMotDePasse, MESSAGES_MOT_DE_PASSE } from "@/lib/mot-de-passe";
import { depotAuthentification, jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * Changement de mot de passe depuis les paramètres — cahier V2, §15.
 *
 * L'ancien mot de passe est exigé. Ce n'est pas une formalité : sans lui, un
 * ordinateur de CDI laissé ouvert suffirait à verrouiller le compte de
 * quelqu'un d'autre. La vérification passe par le fournisseur d'identité, avec
 * l'alias technique de la personne — jamais par une comparaison de notre côté,
 * puisque nous ne détenons aucun mot de passe.
 *
 * Les autres sessions ne sont pas révoquées ici : le cahier ne le demande pas,
 * et couper la session d'un collègue sur le poste de la salle des professeurs
 * au moment où l'on change son propre mot de passe surprendrait plus que cela
 * ne protégerait. La révocation reste le geste de l'administration.
 */

import type { EtatParametres } from "./etats";

export async function changerSonMotDePasse(
  _precedent: EtatParametres,
  donnees: FormData,
): Promise<EtatParametres> {
  const personne = await sessionCourante();
  if (personne === null) {
    return { etat: "erreur", message: "Votre session a expiré. Reconnectez-vous." };
  }

  if (personne.organizationId === null) {
    return { etat: "erreur", message: "Cette session n'est rattachée à aucun établissement." };
  }

  const actuel = String(donnees.get("actuel") ?? "");
  const nouveau = String(donnees.get("nouveau") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  if (actuel === "") {
    return { etat: "erreur", message: "Saisissez votre mot de passe actuel." };
  }

  const controle = controlerMotDePasse({ nouveau, confirmation });
  if (!controle.accepte) {
    return { etat: "erreur", message: MESSAGES_MOT_DE_PASSE[controle.motif!] };
  }

  if (nouveau === actuel) {
    return { etat: "erreur", message: "Le nouveau mot de passe doit être différent de l'actuel." };
  }

  const alias = await depotAuthentification.aliasCourant(
    personne.profileId,
    personne.organizationId,
  );

  if (alias === null) {
    return {
      etat: "erreur",
      message: "Le changement de mot de passe est momentanément impossible. Réessayez plus tard.",
    };
  }

  const verification = await new FournisseurSupabase().verifierSecret(alias, actuel);
  if (!verification.reussi) {
    return { etat: "erreur", message: "Le mot de passe actuel ne correspond pas." };
  }

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) {
    return { etat: "erreur", message: "Votre session a expiré. Reconnectez-vous." };
  }

  const change = await changerMotDePasse(jeton, nouveau);
  if (!change) {
    return {
      etat: "erreur",
      message: "Ce mot de passe a été refusé. Choisissez-en un autre, d'au moins douze caractères.",
    };
  }

  return { etat: "ok", message: "Votre mot de passe a été modifié." };
}

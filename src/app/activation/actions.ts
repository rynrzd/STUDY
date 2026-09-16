"use server";

import { redirect } from "next/navigation";
import { changerMotDePasse } from "@/lib/fournisseur-supabase";
import {
  controlerMotDePasse,
  MESSAGES_MOT_DE_PASSE,
} from "@/lib/mot-de-passe";
import { depotAuthentification, jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * Activation : choix du mot de passe personnel.
 *
 * Tant que cette étape n'est pas franchie, la session n'a que la portée
 * « activation » et les politiques RLS refusent toute donnée pédagogique. Ce
 * n'est donc pas un simple écran qu'on pourrait sauter en changeant d'URL.
 *
 * L'ordre importe : le mot de passe est d'abord changé **chez le fournisseur**,
 * et seulement ensuite le compte est marqué activé. L'inverse laisserait un
 * compte réputé actif dont le mot de passe serait resté celui de la fiche
 * imprimée.
 */

import type { EtatActivation } from "./etats";

export async function activerCompte(
  _precedent: EtatActivation,
  donnees: FormData,
): Promise<EtatActivation> {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.organizationId === null) {
    return { etat: "erreur", message: "Cette session n'est rattachée à aucun établissement." };
  }

  const nouveau = String(donnees.get("nouveau") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  const controle = controlerMotDePasse({ nouveau, confirmation });
  if (!controle.accepte) {
    return { etat: "erreur", message: MESSAGES_MOT_DE_PASSE[controle.motif!] };
  }

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) {
    return {
      etat: "erreur",
      message:
        "Votre session a expiré avant l'enregistrement. Reconnectez-vous avec le mot de passe qui vous a été remis.",
    };
  }

  const change = await changerMotDePasse(jeton, nouveau);
  if (!change) {
    return {
      etat: "erreur",
      message:
        "Ce mot de passe a été refusé. Choisissez-en un autre, d'au moins douze caractères.",
    };
  }

  await depotAuthentification.activerCompte(
    personne.profileId,
    personne.organizationId,
    personne.empreinte,
  );

  redirect("/apres-connexion");
}

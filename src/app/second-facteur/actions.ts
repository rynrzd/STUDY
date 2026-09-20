"use server";

import { redirect } from "next/navigation";
import { verifierCode } from "@/lib/second-facteur";
import { sessionCourante } from "@/lib/session-serveur";

import type { EtatSecondFacteur } from "./etats";

/**
 * Vérification d'un code à six chiffres.
 *
 * L'identifiant du facteur vient du formulaire, et c'est sans danger : le
 * fournisseur ne connaît que les facteurs de la personne authentifiée par les
 * jetons de **cette** session. Un identifiant emprunté ailleurs n'y correspond
 * à rien.
 *
 * Le code, lui, n'est jamais journalisé — ni en succès ni en échec.
 */
export async function verifierSecondFacteur(
  _precedent: EtatSecondFacteur,
  donnees: FormData,
): Promise<EtatSecondFacteur> {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const facteur = String(donnees.get("facteur") ?? "");
  const code = String(donnees.get("code") ?? "");

  if (facteur === "") {
    return { etat: "erreur", message: "L'enrôlement a expiré. Rechargez la page." };
  }

  const resultat = await verifierCode(personne, facteur, code);

  if (!resultat.ok) {
    return { etat: "erreur", message: resultat.message };
  }

  return { etat: "verifie", sessionsFermees: resultat.sessionsFermees };
}

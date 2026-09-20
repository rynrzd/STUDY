import "server-only";

import { redirect } from "next/navigation";
import { etapeSecondFacteur } from "./second-facteur.ts";
import { sessionCourante, type Personne } from "./session-serveur.ts";

/**
 * La garde d'assurance — cahier V5, §1.
 *
 * Elle existe pour une raison qu'il vaut la peine d'écrire : **cacher un
 * bouton ne protège pas une ressource**. Une page qui redirige est une
 * politesse pour la personne ; ce qui refuse réellement, c'est cette
 * vérification, appelée au début de chaque action sensible.
 *
 * Deux usages, et il ne faut pas les confondre.
 *
 * `exigerAssurance` sert dans une **page** : elle redirige vers l'enrôlement,
 * parce qu'une personne qui arrive sur un écran doit être emmenée là où elle
 * peut agir.
 *
 * `assuranceSuffisante` sert dans une **action serveur** ou une route : elle
 * répond oui ou non, et l'appelant refuse. Rediriger depuis une action
 * serveur produirait une navigation inattendue au milieu d'un formulaire.
 */

/**
 * La personne connectée, à condition que son niveau d'assurance suffise.
 *
 * Redirige sinon — vers la connexion, l'activation, ou le second facteur selon
 * ce qui manque. Ne rend jamais une personne insuffisamment vérifiée.
 */
export async function exigerAssurance(): Promise<Personne> {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const etape = await etapeSecondFacteur(personne);
  if (etape === "a_enroler" || etape === "a_verifier") redirect("/second-facteur");

  return personne;
}

/**
 * Le niveau d'assurance de cette session suffit-il pour un geste sensible ?
 *
 * À appeler **au début** de toute action serveur qui crée, modifie ou
 * supprime un compte, un établissement ou une donnée commerciale. Une action
 * atteinte directement, sans passer par l'écran, tombe ici.
 */
export async function assuranceSuffisante(personne: Personne): Promise<boolean> {
  const etape = await etapeSecondFacteur(personne);
  return etape === "sans_objet" || etape === "verifie";
}

/**
 * Le message unique d'un refus pour assurance insuffisante.
 *
 * Il dit quoi faire, sans dire ce qui a été refusé : une action bloquée n'a
 * pas à décrire ce qu'elle aurait fait.
 */
export const REFUS_ASSURANCE =
  "Cette action demande la vérification en deux étapes. Ouvrez « Second facteur » pour la terminer.";

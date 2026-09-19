import "server-only";

import { genererMotDePasseTemporaire } from "./identite.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Les accès d'un établissement — cahier V5, §7.2 et §7.3.
 *
 * Une règle domine tout le fichier : **aucun mot de passe n'est conservé**.
 * Il n'existe qu'entre sa génération et la feuille imprimée. On ne peut donc
 * pas « réafficher » celui d'un élève, et l'export n'en contient aucun — ce
 * n'est pas une limite qu'on contourne, c'est la propriété qui rend une fuite
 * de la base inoffensive pour les comptes.
 *
 * Le §7.3 l'écrit du côté de l'interface : ne jamais afficher « mot de passe
 * actuel ». Ici, il n'y en a pas à afficher.
 */

export interface LigneAcces {
  readonly profileId: string;
  readonly prenom: string;
  readonly nom: string;
  readonly login: string;
  readonly classe: string | null;
  readonly role: "eleve" | "professeur";
  readonly etat: string;
}

/** La liste des accès, éventuellement restreinte à une classe (§7.2). */
export async function listeAcces(acteur: string, classe?: string): Promise<LigneAcces[]> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_acces", {
    p_acteur: acteur,
    p_classe: classe ?? null,
  });

  if (error !== null) return [];

  return (
    (data ?? []) as {
      profile_id: string;
      prenom: string;
      nom: string;
      local_login: string;
      classe: string | null;
      role: "eleve" | "professeur";
      account_state: string;
    }[]
  ).map((ligne) => ({
    profileId: ligne.profile_id,
    prenom: ligne.prenom,
    nom: ligne.nom,
    login: ligne.local_login,
    classe: ligne.classe,
    role: ligne.role,
    etat: ligne.account_state,
  }));
}

const ETATS: Record<string, string> = {
  actif: "Actif",
  a_activer: "Jamais connecté",
  suspendu: "Suspendu",
};

/**
 * Le tableau des accès, au format que le tableur du secrétariat ouvrira.
 *
 * Point-virgule et BOM : Excel en français lit une virgule comme un séparateur
 * décimal, et sans BOM il affiche « Émilie » en « Ã‰milie ». Ce sont deux
 * détails, et ce sont exactement les deux qui font qu'un export « marche » ou
 * qu'on le renvoie au support.
 */
export function csvAcces(lignes: readonly LigneAcces[]): string {
  const entetes = ["Prénom", "Nom", "Classe", "Identifiant", "Rôle", "État du compte"];

  const corps = lignes.map((ligne) =>
    [
      ligne.prenom,
      ligne.nom,
      ligne.classe ?? "",
      ligne.login,
      ligne.role === "professeur" ? "Professeur" : "Élève",
      ETATS[ligne.etat] ?? ligne.etat,
    ]
      .map(cellule)
      .join(";"),
  );

  return `﻿${[entetes.map(cellule).join(";"), ...corps].join("\r\n")}\r\n`;
}

/**
 * Une cellule échappée, et désamorcée.
 *
 * Un nom qui commence par `=`, `+`, `-` ou `@` est interprété comme une
 * formule à l'ouverture du fichier. C'est une injection réelle, qui a servi à
 * exfiltrer des tableurs entiers ; on préfixe donc d'une apostrophe, que le
 * tableur consomme à l'affichage.
 */
export function cellule(valeur: string): string {
  const desamorcee = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
  return `"${desamorcee.replaceAll('"', '""')}"`;
}

export interface AccesReinitialise {
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string | null;
  readonly login: string;
  readonly motDePasseTemporaire: string;
}

/**
 * Donne un nouveau mot de passe provisoire à quelqu'un (§7.3).
 *
 * Trois effets, et l'ordre compte. La base rouvre le compte et coupe les
 * sessions **d'abord** : si le changement de secret échouait ensuite, on
 * laisserait un compte fermé plutôt qu'un compte joignable avec l'ancien mot
 * de passe. L'inverse serait une porte laissée ouverte.
 *
 * Le mot de passe rendu ici n'est écrit nulle part. Il traverse l'écran une
 * fois, s'imprime, et disparaît.
 */
export async function reinitialiserAcces(
  acteur: string,
  profil: string,
): Promise<AccesReinitialise | { erreur: string }> {
  const client = clientExploitation("administration_des_comptes");

  const { data, error } = await client.rpc("etab_reinitialiser_acces", {
    p_acteur: acteur,
    p_profile: profil,
  });

  if (error !== null) {
    return {
      erreur:
        error.message.includes("votre compte")
          ? "Pour votre propre compte, passez par « Mon compte »."
          : "Ce compte est introuvable dans votre établissement.",
    };
  }

  const ligne = (Array.isArray(data) ? data[0] : null) as
    | { local_login: string; prenom: string; nom: string; classe: string | null }
    | null;

  if (ligne === null) {
    return { erreur: "Ce compte est introuvable dans votre établissement." };
  }

  const motDePasse = genererMotDePasseTemporaire(16);
  const { error: refus } = await client.auth.admin.updateUserById(profil, {
    password: motDePasse,
  });

  if (refus !== null) {
    // Le compte est déjà fermé et ses sessions coupées : c'est l'état sûr.
    // Il reste inutilisable jusqu'à une nouvelle tentative, et l'écran le dit.
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "acces.reinitialiser", code: refus.status }),
    );
    return {
      erreur:
        "L'accès a été fermé mais le nouveau mot de passe n'a pas pu être posé. Réessayez : le compte reste inutilisable d'ici là.",
    };
  }

  return {
    prenom: ligne.prenom,
    nom: ligne.nom,
    classe: ligne.classe,
    login: ligne.local_login,
    motDePasseTemporaire: motDePasse,
  };
}

/** Désactive ou réactive un compte (§9). */
export async function changerEtatCompte(options: {
  acteur: string;
  profil: string;
  actif: boolean;
  motif: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await clientExploitation("administration_des_comptes").rpc(
    "etab_changer_etat_compte",
    {
      p_acteur: options.acteur,
      p_profile: options.profil,
      p_actif: options.actif,
      p_motif: options.motif,
    },
  );

  if (error !== null) {
    return {
      ok: false,
      message: error.message.includes("propre compte")
        ? "Vous ne pouvez pas désactiver votre propre compte."
        : "Ce compte est introuvable dans votre établissement.",
    };
  }

  return { ok: true };
}

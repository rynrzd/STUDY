import "server-only";

import { FournisseurSupabase } from "./fournisseur-supabase.ts";
import type { EnrolementTotp, JetonsFournisseur } from "./identite.ts";
import { jetonsDe, remplacerJetonsDe, type Personne } from "./session-serveur.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Le second facteur — cahier V5, §1.
 *
 * Le produit déclarait déjà `mfa_obligatoire` pour l'exploitant et les
 * administrateurs d'établissement. Cette valeur ne faisait que **raccourcir la
 * session** : aucun enrôlement n'était demandé, aucun `aal2` n'était exigé, et
 * l'administration du site s'ouvrait avec un simple mot de passe. Le compte
 * qui crée les établissements était protégé comme celui d'un élève.
 *
 * Trois règles gouvernent ce module.
 *
 * **Le niveau appartient à la session, pas au compte.** Un facteur présenté
 * sur le poste du lycée n'ouvre rien sur le téléphone resté dans un sac.
 *
 * **Le secret ne se conserve pas.** Il traverse l'écran d'enrôlement une fois
 * et n'est écrit nulle part — ni base, ni journal, ni trace. Le garder
 * reviendrait à ranger la clé à côté de la serrure.
 *
 * **Rien n'est acquis avant vérification.** Un enrôlement abandonné laisse un
 * facteur non vérifié, que l'écran reprend au lieu d'en empiler un second.
 */

export type EtapeSecondFacteur =
  /** Le second facteur n'est pas exigé de cette personne. */
  | "sans_objet"
  /** Exigé, aucun facteur vérifié : il faut enrôler. */
  | "a_enroler"
  /** Enrôlé, mais cette session n'a pas présenté de code. */
  | "a_verifier"
  /** Cette session a présenté un code valide. */
  | "verifie";

/**
 * Où en est cette personne, sur cette session ?
 *
 * La question est posée au fournisseur, pas à un indicateur local : c'est lui
 * qui sait ce qui est réellement enrôlé, et un indicateur recopié dériverait
 * au premier facteur retiré depuis un autre écran.
 */
export async function etapeSecondFacteur(personne: Personne): Promise<EtapeSecondFacteur> {
  if (!(await secondFacteurExige(personne))) return "sans_objet";
  if (personne.niveauAssurance === "aal2") return "verifie";

  const jetons = await jetonsDe(personne);
  if (jetons === null) return "a_enroler";

  const facteurs = await new FournisseurSupabase().listerFacteurs(jetons);
  return facteurs.some((facteur) => facteur.verifie) ? "a_verifier" : "a_enroler";
}

/**
 * Le second facteur est-il exigé ?
 *
 * La règle vit en base — `study.auth_second_facteur_exige` — et non ici : elle
 * doit valoir aussi pour un appel qui n'aurait pas traversé cet écran.
 */
export async function secondFacteurExige(personne: Personne): Promise<boolean> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc(
    "auth_second_facteur_exige",
    { p_profile: personne.profileId },
  );

  // En cas de doute on exige. Un refus de trop se corrige en se connectant ;
  // une exigence oubliée ouvre l'administration du site.
  if (error !== null) return true;
  return data === true;
}

/**
 * L'identifiant du facteur déjà vérifié, pour une session qui doit seulement
 * présenter un code.
 *
 * Il est relu à chaque affichage plutôt que gardé : un facteur retiré depuis
 * un autre écran rendrait un identifiant conservé inutilisable, et le
 * formulaire échouerait sans expliquer pourquoi.
 */
export async function facteurVerifieDe(personne: Personne): Promise<string | null> {
  const jetons = await jetonsDe(personne);
  if (jetons === null) return null;

  try {
    const facteurs = await new FournisseurSupabase().listerFacteurs(jetons);
    return facteurs.find((facteur) => facteur.verifie)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Prépare un facteur, ou reprend celui qui était en cours.
 *
 * Un enrôlement interrompu — onglet fermé, téléphone introuvable — laisse
 * derrière lui un facteur non vérifié. On le retire avant d'en préparer un
 * autre : sans cela la liste se remplit de facteurs morts, et la personne ne
 * sait plus lequel son application connaît.
 */
export async function preparerEnrolement(
  personne: Personne,
): Promise<EnrolementTotp | { erreur: string }> {
  const jetons = await jetonsDe(personne);
  if (jetons === null) return { erreur: "Votre session n'est plus lisible. Reconnectez-vous." };

  const fournisseur = new FournisseurSupabase();

  try {
    for (const facteur of await fournisseur.listerFacteurs(jetons)) {
      if (!facteur.verifie) await fournisseur.retirerFacteur(jetons, facteur.id);
    }

    return await fournisseur.enrolerTotp(jetons);
  } catch {
    return {
      erreur:
        "Le second facteur n'a pas pu être préparé. Réessayez ; si cela se reproduit, " +
        "signalez-le avant de continuer.",
    };
  }
}

/**
 * Vérifie un code et élève la session.
 *
 * Trois écritures, dans cet ordre, et l'ordre compte. Le fournisseur valide le
 * code et rend de nouveaux jetons. On les range dans la session. Puis on élève
 * le niveau en base et on ferme les autres sessions.
 *
 * Si la dernière étape échouait, la session garderait `aal1` : l'accès resterait
 * refusé, ce qui est l'état sûr. L'inverse — élever d'abord — laisserait une
 * session réputée forte porter des jetons faibles.
 */
export async function verifierCode(
  personne: Personne,
  facteurId: string,
  code: string,
): Promise<{ ok: true; sessionsFermees: number } | { ok: false; message: string }> {
  const propre = code.replace(/\D/g, "");
  if (propre.length !== 6) {
    return { ok: false, message: "Le code compte six chiffres." };
  }

  const jetons = await jetonsDe(personne);
  if (jetons === null) {
    return { ok: false, message: "Votre session n'est plus lisible. Reconnectez-vous." };
  }

  let resultat;
  try {
    resultat = await new FournisseurSupabase().verifierTotp(jetons, facteurId, propre);
  } catch {
    return { ok: false, message: "Ce code n'a pas pu être vérifié. Réessayez." };
  }

  if (!resultat.reussi || resultat.jetons === undefined) {
    // Message unique : un code faux et un facteur inconnu donnent la même
    // réponse. Distinguer les deux renseignerait qui essaie.
    return { ok: false, message: "Ce code ne correspond pas. Vérifiez l'heure de votre téléphone." };
  }

  const range = await remplacerJetonsDe(personne, resultat.jetons);
  if (!range) {
    return { ok: false, message: "Votre session n'a pas pu être mise à jour. Reconnectez-vous." };
  }

  const { data, error } = await clientExploitation("administration_des_comptes").rpc(
    "auth_elever_assurance",
    { p_empreinte: `\\x${personne.empreinte.toString("hex")}`, p_niveau: "aal2" },
  );

  if (error !== null) {
    return { ok: false, message: "Votre session n'a pas pu être élevée. Reconnectez-vous." };
  }

  return { ok: true, sessionsFermees: typeof data === "number" ? data : 0 };
}

/** Les jetons courants, tels que la session les conserve. */
export type { JetonsFournisseur };

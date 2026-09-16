import { randomBytes } from "node:crypto";

/**
 * Fournisseur d'identité — chapitre 37.
 *
 * AvecStudy ne stocke aucun mot de passe (AUTH-01). Cette interface est le seul
 * point de contact avec le fournisseur qui, lui, les conserve. Elle est
 * volontairement étroite : tout ce qui n'y figure pas ne peut pas être demandé
 * au fournisseur depuis le reste du code.
 *
 * Deux implémentations sont prévues :
 *  - `FournisseurAbsent`, active tant qu'aucun projet n'est configuré. Elle
 *    échoue de manière contrôlée, en disant pourquoi. Le ch. 35 l'exige :
 *    « L'absence de Supabase configuré doit produire une erreur de
 *    configuration contrôlée, jamais un retour silencieux vers localStorage » ;
 *  - `FournisseurSupabase`, à écrire une fois le projet ouvert.
 */

export type NiveauAssurance = "aal1" | "aal2";

export interface JetonsFournisseur {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expireLe: Date;
  /** Niveau réellement atteint par CETTE session, pas une capacité du compte. */
  readonly niveauAssurance: NiveauAssurance;
}

export interface ResultatVerification {
  readonly reussi: boolean;
  readonly identifiantFournisseur?: string;
  readonly jetons?: JetonsFournisseur;
}

export interface FournisseurIdentite {
  /** Vérifie une identité et un secret. Ne dit jamais si le compte existe. */
  verifierSecret(identite: string, secret: string): Promise<ResultatVerification>;

  /** Crée un compte côté fournisseur. Opération serveur privilégiée (ch. 37). */
  creerCompte(identite: string, options: { motDePasseTemporaire: string }): Promise<string>;

  /** Invalide toutes les sessions du fournisseur pour cette personne. */
  revoquerSessions(identifiantFournisseur: string): Promise<void>;

  /** Renouvelle les jetons. Sérialisé par session côté appelant (ch. 37). */
  renouveler(refreshToken: string): Promise<JetonsFournisseur>;

  /** Le fournisseur est-il réellement joignable et configuré ? */
  disponible(): boolean;
}

export class FournisseurNonConfigure extends Error {
  constructor(operation: string) {
    super(
      `Le fournisseur d'identite n'est pas raccorde : « ${operation} » est impossible. ` +
        "Ce n'est pas une panne mais une configuration absente — voir « npm run diagnostic ». " +
        "Aucun repli local n'est prevu : un compte sans fournisseur d'identite serait un " +
        "compte sans mot de passe verifie.",
    );
    this.name = "FournisseurNonConfigure";
  }
}

/**
 * Implémentation active tant qu'aucun projet n'est configuré.
 *
 * Elle ne « simule » rien. Chaque appel échoue avec un message qui dit ce qui
 * manque. C'est exactement le comportement demandé : une fonctionnalité non
 * livrée est clairement indisponible, jamais simulée comme réussie (ch. 19).
 */
export class FournisseurAbsent implements FournisseurIdentite {
  disponible(): boolean {
    return false;
  }

  async verifierSecret(_identite: string, _secret: string): Promise<ResultatVerification> {
    throw new FournisseurNonConfigure("verifier un mot de passe");
  }

  async creerCompte(_identite: string, _options: { motDePasseTemporaire: string }): Promise<string> {
    throw new FournisseurNonConfigure("creer un compte");
  }

  async revoquerSessions(_identifiantFournisseur: string): Promise<void> {
    throw new FournisseurNonConfigure("revoquer les sessions");
  }

  async renouveler(_refreshToken: string): Promise<JetonsFournisseur> {
    throw new FournisseurNonConfigure("renouveler des jetons");
  }
}

/**
 * Alias technique d'un élève sans adresse électronique (ch. 37).
 *
 * Trois propriétés, imposées aussi par une contrainte en base :
 *  - la partie locale est purement hexadécimale : **ni nom, ni prénom, ni
 *    classe** ne doivent pouvoir s'y lire ;
 *  - elle est tirée au hasard, donc stable et sans lien avec l'identité
 *    affichée : changer de classe ou de prénom ne change pas l'alias ;
 *  - le domaine est contrôlé par l'éditeur. Ce n'est pas une boîte aux lettres :
 *    aucun message n'y est jamais envoyé.
 */
export function genererAliasTechnique(domaine: string): string {
  if (!/^[a-z0-9.-]+$/.test(domaine)) {
    throw new Error("Domaine d'alias invalide : il doit etre un nom de domaine simple.");
  }
  return `${randomBytes(8).toString("hex")}@${domaine}`;
}

/** Un alias est-il bien opaque ? Contrôle défensif avant écriture. */
export function aliasEstOpaque(alias: string, indices: readonly string[]): boolean {
  const partieLocale = alias.split("@")[0] ?? "";
  if (!/^[a-f0-9]{16,64}$/.test(partieLocale)) return false;

  const enMinuscules = alias.toLowerCase();
  return !indices.some((indice) => {
    const nettoye = indice.trim().toLowerCase();
    return nettoye.length >= 3 && enMinuscules.includes(nettoye);
  });
}

/**
 * Mot de passe temporaire de rentrée — ch. 12.
 *
 * Au moins 16 caractères, générateur cryptographique. Il n'ouvre qu'une session
 * d'activation ; il ne donne jamais accès aux cours.
 *
 * L'alphabet exclut les caractères qui se confondent à la lecture sur une fiche
 * imprimée (O/0, I/l/1) : un élève qui recopie mal son secret appelle
 * l'administration, et une réinitialisation coûte plus cher qu'un alphabet
 * légèrement réduit.
 */
const ALPHABET_LISIBLE = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function genererMotDePasseTemporaire(longueur = 20): string {
  if (longueur < 16) {
    throw new Error("Un mot de passe temporaire fait au moins 16 caracteres (ch. 12).");
  }

  // Tirage sans biais : on rejette les octets qui déborderaient du plus grand
  // multiple de la taille de l'alphabet.
  const seuil = Math.floor(256 / ALPHABET_LISIBLE.length) * ALPHABET_LISIBLE.length;
  const caracteres: string[] = [];

  while (caracteres.length < longueur) {
    for (const octet of randomBytes(longueur * 2)) {
      if (octet >= seuil) continue;
      caracteres.push(ALPHABET_LISIBLE[octet % ALPHABET_LISIBLE.length]!);
      if (caracteres.length === longueur) break;
    }
  }

  return caracteres.join("");
}

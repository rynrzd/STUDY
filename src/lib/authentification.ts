import type { FournisseurIdentite, NiveauAssurance } from "./identite.ts";
import {
  calculerEcheances,
  dureesPour,
  genererJetonSession,
  empreinteJeton,
  type PorteeSession,
  type TypeAppareil,
} from "./session.ts";

/**
 * Connexion BFF — chapitre 37, AUTH-03 et AUTH-04.
 *
 * Cette couche est volontairement **pure** : elle ne parle ni à Supabase ni à
 * PostgreSQL directement, mais à deux interfaces (`FournisseurIdentite` et
 * `DepotAuthentification`). C'est ce qui permet de la tester entièrement avant
 * qu'un projet Supabase existe — et de vérifier les propriétés qui comptent
 * vraiment : la non-divulgation, le blocage d'activation, la limitation des
 * tentatives.
 *
 * Ce qu'elle ne fait jamais :
 *  - dire si un compte existe ;
 *  - journaliser un secret, un identifiant saisi ou un jeton ;
 *  - accorder un droit sur la foi d'un champ envoyé par le navigateur.
 */

export interface IdentiteResolue {
  readonly profileId: string;
  readonly organizationId: string | null;
  /** Identité technique transmise au fournisseur : alias ou email pro. */
  readonly alias: string;
  readonly mustChangePassword: boolean;
  readonly accountState: "a_activer" | "actif" | "suspendu" | "sorti" | "en_suppression";
  readonly membershipState: "active" | "suspendue" | "terminee";
  /** Vrai si la personne porte un rôle exigeant la MFA (AUTH-02). */
  readonly mfaObligatoire: boolean;
  /**
   * Portée de la session à ouvrir. L'exploitant n'appartient à aucun
   * établissement : sa session est de portée « editeur », et son
   * `organizationId` est nul.
   */
  readonly portee?: Exclude<PorteeSession, "activation">;
}

export interface SessionACreer {
  readonly profileId: string;
  readonly organizationId: string | null;
  readonly tokenSha256: Buffer;
  readonly scope: PorteeSession;
  readonly deviceKind: TypeAppareil;
  readonly niveauAssurance: NiveauAssurance;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly jetonsChiffres: string;
}

export interface DepotAuthentification {
  /**
   * Résout un couple (code établissement, identifiant local) en identité.
   * Renvoie `null` si rien ne correspond — l'appelant ne doit pas laisser
   * cette différence transparaître dans sa réponse.
   */
  resoudreIdentifiant(codeEtablissement: string, identifiant: string): Promise<IdentiteResolue | null>;

  /** Échecs récents pour ce compte, sur la fenêtre de limitation. */
  compterEchecsRecents(profileId: string): Promise<number>;

  /**
   * Cibles distinctes en échec dans l'établissement, sur la même fenêtre.
   *
   * Sert à reconnaître un balayage — beaucoup de comptes, peu d'essais chacun —
   * là où le compteur par compte ne voit rien. Voir `seuilApplicable`.
   */
  compterBalayage(codeEtablissement: string): Promise<number>;

  enregistrerEchec(profileId: string | null, codeEtablissement: string): Promise<void>;

  creerSession(session: SessionACreer): Promise<string>;

  /** Révoque toutes les sessions d'une personne (suspension, reset, rôle). */
  revoquerSessions(profileId: string, motif: string): Promise<void>;
}

export type MotifRefus =
  | "identifiants_invalides"
  | "trop_de_tentatives"
  | "compte_indisponible"
  | "service_indisponible";

export interface Refus {
  readonly reussi: false;
  readonly motif: MotifRefus;
  /** Secondes avant nouvelle tentative, quand la limitation s'applique. */
  readonly reprendreDansSecondes?: number;
}

export interface Succes {
  readonly reussi: true;
  /** Compte connecté. Sert à l'appelant pour effacer l'ardoise des tentatives. */
  readonly profileId: string;
  /** Valeur en clair du cookie. Elle n'existe qu'ici et dans le navigateur. */
  readonly jetonSession: string;
  readonly portee: PorteeSession;
  /** Vrai si la personne doit choisir son mot de passe avant toute autre chose. */
  readonly activationRequise: boolean;
  readonly dureeSecondes: number;
}

export type ResultatConnexion = Refus | Succes;

/**
 * ABUSE-01 : après 5 échecs par compte sur 15 minutes, temporisation
 * croissante. Ce sont des réglages à tester, pas une promesse « zéro brute
 * force » — et la temporisation vise le compte, pas l'adresse IP, parce que
 * 800 élèves d'un lycée partagent la même IP publique.
 */
export const SEUIL_ECHECS = 5;
export const FENETRE_ECHECS_MINUTES = 15;

/**
 * ABUSE-02 : le balayage d'établissement — constat F-07 du 23 septembre 2026.
 *
 * Le compteur par compte ci-dessus ne voit pas l'attaque la plus probable ici.
 * Un pulvérisateur de mots de passe n'insiste jamais sur un compte : il essaie
 * trois mots de passe plausibles sur huit cents comptes. Chaque compteur reste
 * à trois, sous le seuil, et rien ne ralentit. Dans un lycée, où les mots de
 * passe sont distribués à la rentrée et se ressemblent, c'est le scénario
 * qu'il faut gêner.
 *
 * Trente cibles distinctes en quinze minutes ne sont pas une matinée
 * difficile : un même élève qui se trompe cinq fois ne compte que pour une
 * cible, et un lycée entier qui rentre de vacances ne produit pas trente
 * comptes **différents** en échec dans le même quart d'heure.
 */
export const SEUIL_BALAYAGE = 30;

/**
 * Le seuil par compte réellement appliqué.
 *
 * Pendant un balayage, il descend à deux. C'est tout ce qui change — et c'est
 * délibérément tout ce qui change.
 *
 * Ce qu'on a écarté : verrouiller l'établissement. Un verrou déclenché par un
 * tiers est une arme qu'on lui tend — un balayage volontaire un matin de
 * rentrée suffirait à empêcher un lycée de se connecter. Ici, rien ne ferme.
 * Une personne qui tape correctement son mot de passe passe, alerte ou pas ;
 * celle qui se trompe attend trente secondes au lieu de disposer de cinq
 * essais. L'attaquant, lui, tombe de cinq essais par compte à deux.
 */
export function seuilApplicable(balayage: number): number {
  return balayage >= SEUIL_BALAYAGE ? 2 : SEUIL_ECHECS;
}

export function delaiApresEchecs(echecs: number, seuil: number = SEUIL_ECHECS): number {
  if (echecs < seuil) return 0;
  // 5 → 30 s, 6 → 60 s, 7 → 120 s… plafonné à 15 minutes.
  const exposant = echecs - seuil;
  return Math.min(30 * 2 ** exposant, 900);
}

/** Un refus n'apprend rien : même forme, même vocabulaire, quel que soit le cas. */
const REFUS_GENERIQUE: Refus = { reussi: false, motif: "identifiants_invalides" };

export interface OptionsConnexion {
  readonly codeEtablissement: string;
  readonly identifiant: string;
  readonly secret: string;
  readonly appareil: TypeAppareil;
}

export interface DependancesConnexion {
  readonly depot: DepotAuthentification;
  readonly fournisseur: FournisseurIdentite;
  /** Chiffre les jetons du fournisseur avant stockage (ch. 37). */
  readonly chiffrer: (clair: string) => string;
  readonly maintenant?: () => Date;
}

/**
 * Tente une connexion.
 *
 * L'ordre des opérations est choisi pour ne rien révéler :
 *
 *  1. on résout l'identifiant. S'il est inconnu, on **vérifie quand même un
 *     secret** contre une identité factice, pour ne pas répondre plus vite que
 *     dans le cas d'un compte existant, puis on renvoie le refus générique ;
 *  2. on applique la limitation de tentatives **avant** de parler au
 *     fournisseur, pour ne pas transformer le service en oracle de mots de passe ;
 *  3. on vérifie le secret ;
 *  4. seulement ensuite, on regarde l'état du compte. Un compte suspendu et un
 *     mot de passe faux produisent le même refus vu du navigateur.
 */
export async function tenterConnexion(
  options: OptionsConnexion,
  dependances: DependancesConnexion,
): Promise<ResultatConnexion> {
  const { depot, fournisseur, chiffrer } = dependances;
  const maintenant = dependances.maintenant?.() ?? new Date();

  if (!fournisseur.disponible()) {
    // Erreur de configuration contrôlée, jamais un repli silencieux (ch. 35).
    return { reussi: false, motif: "service_indisponible" };
  }

  const identite = await depot.resoudreIdentifiant(options.codeEtablissement, options.identifiant);

  if (identite === null) {
    // Identifiant inconnu : on consomme le même travail qu'un cas réel.
    await fournisseur
      .verifierSecret(`inconnu-${options.codeEtablissement}`, options.secret)
      .catch(() => undefined);
    await depot.enregistrerEchec(null, options.codeEtablissement);
    return REFUS_GENERIQUE;
  }

  // Les deux compteurs se lisent ensemble : l'un dit si ce compte-ci est
  // harcelé, l'autre si l'établissement est balayé. Le second ne refuse rien
  // par lui-même — il resserre le premier.
  const [echecs, balayage] = await Promise.all([
    depot.compterEchecsRecents(identite.profileId),
    depot.compterBalayage(options.codeEtablissement),
  ]);

  const delai = delaiApresEchecs(echecs, seuilApplicable(balayage));
  if (delai > 0) {
    return { reussi: false, motif: "trop_de_tentatives", reprendreDansSecondes: delai };
  }

  let verification;
  try {
    verification = await fournisseur.verifierSecret(identite.alias, options.secret);
  } catch {
    return { reussi: false, motif: "service_indisponible" };
  }

  if (!verification.reussi || verification.jetons === undefined) {
    await depot.enregistrerEchec(identite.profileId, options.codeEtablissement);
    return REFUS_GENERIQUE;
  }

  // Le mot de passe est bon. L'état du compte se vérifie maintenant, et son
  // refus prend la même forme : un compte suspendu ne se distingue pas d'un
  // mot de passe faux vu du navigateur.
  const compteUtilisable =
    identite.membershipState === "active" &&
    (identite.accountState === "actif" || identite.accountState === "a_activer");

  if (!compteUtilisable) {
    await depot.enregistrerEchec(identite.profileId, options.codeEtablissement);
    return REFUS_GENERIQUE;
  }

  // Activation : tant que le mot de passe doit être changé, la session n'ouvre
  // que l'activation. Aucune donnée pédagogique n'est atteignable — c'est
  // garanti une seconde fois par les politiques RLS (test T07).
  const portee: PorteeSession = identite.mustChangePassword
    ? "activation"
    : (identite.portee ?? "etablissement");

  const durees = dureesPour({
    portee,
    appareil: options.appareil,
    administratif: identite.mfaObligatoire,
  });
  const echeances = calculerEcheances(durees, maintenant);

  const jetonSession = genererJetonSession();

  await depot.creerSession({
    profileId: identite.profileId,
    organizationId: identite.organizationId,
    tokenSha256: empreinteJeton(jetonSession),
    scope: portee,
    deviceKind: options.appareil,
    // Le niveau d'assurance vient du fournisseur, pour CETTE session. Un compte
    // « MFA activée » qui n'a pas passé son second facteur reste en aal1.
    niveauAssurance: verification.jetons.niveauAssurance,
    idleExpiresAt: echeances.idleExpiresAt,
    absoluteExpiresAt: echeances.absoluteExpiresAt,
    jetonsChiffres: chiffrer(
      JSON.stringify({
        access: verification.jetons.accessToken,
        refresh: verification.jetons.refreshToken,
        expire: verification.jetons.expireLe.toISOString(),
      }),
    ),
  });

  return {
    reussi: true,
    profileId: identite.profileId,
    jetonSession,
    portee,
    activationRequise: identite.mustChangePassword,
    dureeSecondes: Math.floor((echeances.absoluteExpiresAt.getTime() - maintenant.getTime()) / 1000),
  };
}

/**
 * Messages destinés à l'interface.
 *
 * Ils ne distinguent jamais « compte inconnu » de « mot de passe faux » ni de
 * « compte suspendu » : c'est la même phrase, qui renvoie vers la bonne
 * personne — l'établissement, pas l'éditeur.
 */
export function messageDeRefus(refus: Refus): string {
  switch (refus.motif) {
    case "trop_de_tentatives":
      return (
        "Trop de tentatives. Patientez un instant avant de reessayer. " +
        "Si vous avez perdu vos identifiants, votre etablissement peut les reinitialiser."
      );
    case "service_indisponible":
      return (
        "La connexion est momentanement indisponible. " +
        "Aucune information n'a ete perdue ; reessayez dans quelques minutes."
      );
    case "identifiants_invalides":
    case "compte_indisponible":
    default:
      return (
        "Code etablissement, identifiant ou mot de passe incorrect. " +
        "Si vous avez perdu vos identifiants, adressez-vous a votre etablissement."
      );
  }
}

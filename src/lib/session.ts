import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Sessions — AUTH-04 et AUTH-05 du cahier des charges.
 *
 * Le navigateur ne reçoit qu'un cookie **opaque** : une valeur aléatoire sans
 * signification, qui ne contient ni identité, ni rôle, ni date d'expiration.
 * Tout l'état vit côté serveur, dans `study.sessions`, et seule l'empreinte
 * SHA-256 du jeton y est stockée. Une fuite de la table ne permet donc pas de
 * rejouer une session.
 *
 * C'est le choix volontaire du ch. 20 : on ne mélange pas un client Supabase
 * navigateur, qui doit lire ses jetons, avec la promesse d'un cookie
 * inaccessible au JavaScript.
 */

/**
 * Préfixe __Host- : le navigateur refuse alors le cookie s'il n'est pas en
 * Secure, sur Path=/ et sans attribut Domain. C'est une garantie posée par le
 * navigateur, pas seulement par notre code.
 *
 * En développement local sur http://localhost, le préfixe est impossible
 * (Secure obligatoire) : le nom dégradé n'est utilisé qu'en dehors de la
 * production, et jamais servi à un vrai lycée.
 */
export const NOM_COOKIE_SESSION =
  process.env.NODE_ENV === "production" ? "__Host-study_session" : "study_session_dev";

export const NOM_COOKIE_CSRF =
  process.env.NODE_ENV === "production" ? "__Host-study_csrf" : "study_csrf_dev";

/** Contexte d'usage d'une session. Le poste partagé expire beaucoup plus vite. */
export type TypeAppareil = "personnel" | "partage";

/** Portée de la session : un cookie éditeur et un cookie lycée sont distincts. */
export type PorteeSession = "etablissement" | "editeur" | "activation";

export interface DureesSession {
  /** Inactivité tolérée avant déconnexion. */
  inactiviteMinutes: number;
  /** Durée de vie maximale, quelle que soit l'activité. */
  absolueHeures: number;
}

/**
 * Durées **proposées** par le ch. 23, à réajuster après des essais pédagogiques
 * documentés. Elles ne sont pas présentées comme un réglage validé sur le
 * terrain : ce sont des valeurs de départ.
 */
export const DUREES: Record<string, DureesSession> = {
  // Salle informatique, poste partagé entre plusieurs classes dans la journée.
  partage: { inactiviteMinutes: 30, absolueHeures: 8 },
  // Administration : l'écran ouvert sur un bureau est un risque réel.
  admin: { inactiviteMinutes: 15, absolueHeures: 8 },
  // Appareil personnel d'un élève ou d'un enseignant.
  personnel: { inactiviteMinutes: 120, absolueHeures: 12 },
  // Session d'activation : elle n'ouvre QUE le choix du mot de passe (ch. 12).
  activation: { inactiviteMinutes: 15, absolueHeures: 1 },
};

/** Réauthentification récente exigée pour les actions sensibles (AUTH-05). */
export const FENETRE_REAUTH_MINUTES = 5;

/**
 * Jeton de session : 32 octets d'aléa cryptographique, encodés en base64url.
 * Aucune information n'y est encodée — c'est un pointeur, pas un porteur.
 */
export function genererJetonSession(): string {
  return randomBytes(32).toString("base64url");
}

/** Empreinte stockée en base. Le jeton en clair ne quitte jamais la réponse. */
export function empreinteJeton(jeton: string): Buffer {
  return createHash("sha256").update(jeton, "utf8").digest();
}

/**
 * Comparaison à temps constant, pour ne pas laisser fuiter d'information par la
 * durée de la comparaison.
 */
export function comparerEmpreintes(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface OptionsCookieSession {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
}

/**
 * Attributs du cookie de session.
 *
 * SameSite=Lax réduit la surface CSRF mais ne la ferme pas : le ch. 25
 * (WEB-03) impose en plus un jeton CSRF et la validation Origin /
 * Fetch Metadata sur toute mutation. Voir `src/lib/csrf.ts`.
 */
export function cookieSession(jeton: string, dureeSecondes: number): OptionsCookieSession {
  return {
    name: NOM_COOKIE_SESSION,
    value: jeton,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: dureeSecondes,
  };
}

/** Cookie de suppression : même nom, même chemin, durée nulle. */
export function cookieSessionSupprime(): OptionsCookieSession {
  return cookieSession("", 0);
}

export interface EcheancesSession {
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export function calculerEcheances(durees: DureesSession, depuis = new Date()): EcheancesSession {
  return {
    idleExpiresAt: new Date(depuis.getTime() + durees.inactiviteMinutes * 60_000),
    absoluteExpiresAt: new Date(depuis.getTime() + durees.absolueHeures * 3_600_000),
  };
}

/**
 * Choisit les durées applicables. Un compte portant un rôle administratif prend
 * toujours la fenêtre la plus courte, même sur un appareil personnel.
 */
export function dureesPour(options: {
  portee: PorteeSession;
  appareil: TypeAppareil;
  administratif: boolean;
}): DureesSession {
  if (options.portee === "activation") return DUREES.activation!;
  if (options.administratif) return DUREES.admin!;
  if (options.appareil === "partage") return DUREES.partage!;
  return DUREES.personnel!;
}

/**
 * Une session est-elle encore utilisable ?
 *
 * Le contrôle est fait côté serveur à chaque requête, à partir de l'état en
 * base. On n'attend jamais l'expiration naturelle d'un JWT : une révocation
 * (déconnexion, suspension, changement de rôle, réinitialisation) prend effet
 * immédiatement parce que la ligne est relue.
 */
export function sessionUtilisable(session: {
  revokedAt: Date | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}, maintenant = new Date()): boolean {
  if (session.revokedAt !== null) return false;
  if (session.idleExpiresAt <= maintenant) return false;
  if (session.absoluteExpiresAt <= maintenant) return false;
  return true;
}

/** La réauthentification est-elle assez récente pour une action sensible ? */
export function reauthRecente(
  reauthenticatedAt: Date | null,
  maintenant = new Date(),
): boolean {
  if (reauthenticatedAt === null) return false;
  return maintenant.getTime() - reauthenticatedAt.getTime() <= FENETRE_REAUTH_MINUTES * 60_000;
}

/**
 * Prolonger une session sur activité réelle.
 *
 * Le ch. 23 demande explicitement de ne PAS prolonger sur un simple ping de
 * fond : seule une action de l'utilisateur repousse l'échéance d'inactivité, et
 * l'échéance absolue n'est jamais repoussée.
 */
export function prolongerSurActivite(
  session: EcheancesSession,
  durees: DureesSession,
  maintenant = new Date(),
): EcheancesSession {
  const nouvelleInactivite = new Date(maintenant.getTime() + durees.inactiviteMinutes * 60_000);
  return {
    idleExpiresAt:
      nouvelleInactivite > session.absoluteExpiresAt
        ? session.absoluteExpiresAt
        : nouvelleInactivite,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

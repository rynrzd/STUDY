/**
 * Erreurs au format du contrat — dossier Study V6, §12 et contracts.ts.
 *
 * `{ error: { code, message, requestId, fieldErrors?, retryAfterSeconds? } }`
 *
 * Les fonctions SQL lèvent des messages stables (NON_ACCESSIBLE,
 * VERSION_CONFLICT, TROP_RAPIDE…). Ce module les traduit en un code du
 * contrat et une phrase compréhensible, sans jamais renvoyer un détail SQL.
 * Module pur : il se teste sans base.
 */

export type CodeErreur =
  | "UNAUTHENTICATED"
  | "NOT_ACCESSIBLE"
  | "VALIDATION_FAILED"
  | "VERSION_CONFLICT"
  | "RATE_LIMITED"
  | "SOURCE_UNREADABLE"
  | "SOURCE_REVOKED"
  | "PROVIDER_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "IMPORT_EXPIRED"
  | "SERVER_ERROR";

export interface ErreurContrat {
  readonly code: CodeErreur;
  readonly message: string;
  readonly requestId: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly retryAfterSeconds?: number;
}

interface Traduction {
  readonly code: CodeErreur;
  readonly message: string;
  readonly retryAfterSeconds?: number;
}

/** Messages SQL connus → contrat. L'ordre n'importe pas : la clé est exacte. */
const TABLE: Readonly<Record<string, Traduction>> = {
  NON_AUTHENTIFIE: { code: "UNAUTHENTICATED", message: "Votre session a pris fin. Reconnectez-vous pour continuer." },
  NON_ACCESSIBLE: { code: "NOT_ACCESSIBLE", message: "Ce contenu n'est pas accessible." },
  VERSION_CONFLICT: {
    code: "VERSION_CONFLICT",
    message: "Une version plus récente existe. Rechargez pour voir les changements ; votre texte est conservé ci-dessous.",
  },
  TROP_RAPIDE: { code: "RATE_LIMITED", message: "Vous envoyez beaucoup de messages. Patientez quelques secondes : votre texte est gardé.", retryAfterSeconds: 10 },
  CODE_TROP_ESSAIS: { code: "RATE_LIMITED", message: "Trop d'essais. Réessayez dans une heure, ou demandez un nouveau code.", retryAfterSeconds: 3600 },
  MODE_ANNONCES: { code: "NOT_ACCESSIBLE", message: "Ce salon est réservé aux annonces de l'équipe pédagogique." },
  MODE_QUESTIONS: { code: "VALIDATION_FAILED", message: "Dans ce salon, on pose une question ou on répond dans un fil." },
  PARENT_INVALIDE: { code: "VALIDATION_FAILED", message: "Le message auquel vous répondez n'est plus disponible." },
  LECON_INVALIDE: { code: "NOT_ACCESSIBLE", message: "Cette séance ne peut pas être citée ici." },
  MENTION_RESERVEE: { code: "VALIDATION_FAILED", message: "La mention @tous est réservée à l'équipe pédagogique." },
  CORPS_INVALIDE: { code: "VALIDATION_FAILED", message: "Le message doit contenir entre 1 et 4 000 caractères." },
  PIECE_INVALIDE: { code: "VALIDATION_FAILED", message: "Seuls les PDF, JPEG, PNG et WebP de 10 Mo au plus peuvent être joints." },
  TROP_DE_PIECES: { code: "VALIDATION_FAILED", message: "Trois pièces jointes au plus par message." },
  DELAI_DEPASSE: { code: "VALIDATION_FAILED", message: "Un message ne se modifie que dans les 15 minutes qui suivent son envoi." },
  TROP_D_EPINGLES: { code: "VALIDATION_FAILED", message: "Trois messages épinglés au plus : retirez-en un d'abord." },
  MOTIF_REQUIS: { code: "VALIDATION_FAILED", message: "Un motif est nécessaire." },
  SUIVI_REQUIS: { code: "VALIDATION_FAILED", message: "Indiquez un responsable et une date de suivi." },
  TRANSITION_INVALIDE: { code: "VALIDATION_FAILED", message: "Ce changement d'état n'est pas possible depuis l'état actuel." },
  CONSULTATION_CLOSE: { code: "VALIDATION_FAILED", message: "La consultation est close : votre réponse ne peut plus être modifiée." },
  SYNTHESE_NON_RELUE: { code: "VALIDATION_FAILED", message: "Relisez et réécrivez la synthèse (en retirant la mention « BROUILLON ») avant de la publier." },
  DEJA_PUBLIEE: { code: "VALIDATION_FAILED", message: "Cette synthèse est déjà publiée." },
  DEJA_TRAITEE: { code: "VALIDATION_FAILED", message: "Cette demande a déjà été traitée." },
  ROLE_INCOMPATIBLE: { code: "VALIDATION_FAILED", message: "Ce compte n'est pas un compte élève : il ne peut pas être inscrit par ce chemin." },
  SOURCE_INACCESSIBLE: { code: "SOURCE_REVOKED", message: "Une des séances choisies n'est plus accessible." },
  SOURCES_INVALIDES: { code: "VALIDATION_FAILED", message: "Choisissez entre une et huit séances." },
  FORMAT_INVALIDE: { code: "VALIDATION_FAILED", message: "Choisissez un format." },
  FICHE_NON_PRETE: { code: "VALIDATION_FAILED", message: "Cette fiche n'est pas encore prête." },
  COMPLET: { code: "VALIDATION_FAILED", message: "Cette séance est complète." },
  REVISION_FERMEE: { code: "VALIDATION_FAILED", message: "Les inscriptions sont fermées." },
  HORS_CLASSE: { code: "NOT_ACCESSIBLE", message: "Seuls les membres de la classe peuvent être invités." },
  PROJET_PRIVE: { code: "VALIDATION_FAILED", message: "Un projet personnel reste privé : passez-le en projet de groupe pour inviter." },
  RESPONSABLE_INVALIDE: { code: "VALIDATION_FAILED", message: "Le responsable doit être un participant du projet." },
  DESTINATAIRE_INVALIDE: { code: "NOT_ACCESSIBLE", message: "Ce destinataire n'est pas disponible pour vous." },
  DEMANDE_CLOSE: { code: "VALIDATION_FAILED", message: "Cette demande est close." },
  DATE_PASSEE: { code: "VALIDATION_FAILED", message: "Choisissez une date à venir." },
  ANNOTATION_INVALIDE: { code: "VALIDATION_FAILED", message: "Chaque annotation demande une catégorie et une justification." },
  ATELIER_CLOS: { code: "VALIDATION_FAILED", message: "L'atelier est clos : seule une contestation argumentée reste possible." },
  REPONSE_INVALIDE: { code: "VALIDATION_FAILED", message: "Choisissez ou saisissez une réponse." },
  NOTE_TROP_LONGUE: { code: "VALIDATION_FAILED", message: "La note dépasse 20 000 caractères." },
  CORRIGE_MANQUANT: { code: "VALIDATION_FAILED", message: "Ajoutez la correction avant de publier l'exercice." },
  VERSION_PUBLIEE_FIGEE: { code: "VERSION_CONFLICT", message: "Une version publiée ne se modifie plus : créez-en une nouvelle." },
  DUREE_INVALIDE: { code: "VALIDATION_FAILED", message: "Durée invalide." },
  CYCLE_DE_PREREQUIS: { code: "VALIDATION_FAILED", message: "Ce prérequis créerait une boucle entre notions." },
};

/** Extrait le code stable d'un message d'erreur PostgreSQL / PostgREST. */
export function codeStable(message: string | null | undefined): string | null {
  if (typeof message !== "string") return null;
  for (const trouve of message.matchAll(/\b([A-Z][A-Z_]{4,})\b/gu)) {
    if (trouve[1] !== undefined && trouve[1] in TABLE) return trouve[1];
  }
  return null;
}

export function traduire(
  erreur: { message?: string | null; code?: string | null } | null | undefined,
  requestId: string,
): ErreurContrat {
  const stable = codeStable(erreur?.message ?? null);
  if (stable !== null) {
    const t = TABLE[stable]!;
    return { code: t.code, message: t.message, requestId, ...(t.retryAfterSeconds ? { retryAfterSeconds: t.retryAfterSeconds } : {}) };
  }
  // Codes SQLSTATE utiles quand le message n'est pas un code stable.
  if (erreur?.code === "42501") return { code: "NOT_ACCESSIBLE", message: TABLE.NON_ACCESSIBLE!.message, requestId };
  if (erreur?.code === "40001") return { code: "VERSION_CONFLICT", message: TABLE.VERSION_CONFLICT!.message, requestId };
  if (erreur?.code === "28000" || erreur?.code === "PGRST301") {
    return { code: "UNAUTHENTICATED", message: TABLE.NON_AUTHENTIFIE!.message, requestId };
  }
  return {
    code: "SERVER_ERROR",
    message: "Le service n'a pas pu traiter la demande. Rien n'a été perdu de votre saisie ; réessayez dans un instant.",
    requestId,
  };
}

/** Le même contrat pour une erreur de validation locale (422). */
export function erreurValidation(requestId: string, champs: Record<string, readonly string[]>): ErreurContrat {
  return {
    code: "VALIDATION_FAILED",
    message: "Certains champs sont à corriger.",
    requestId,
    fieldErrors: champs,
  };
}

import { NextResponse } from "next/server";

/**
 * Contrat de réponse de l'API — ch. 22.
 *
 * Règles appliquées ici :
 *  - aucune trace d'exécution (stack trace) dans une réponse ;
 *  - politique de non-divulgation : selon le cas, 404 plutôt que 403, pour ne
 *    pas confirmer l'existence d'un objet qu'on n'a pas le droit de voir ;
 *  - 409 en cas de conflit de version, avec de quoi recharger sans écraser ;
 *  - 429 avec un délai de reprise exploitable.
 */

export type CodeErreur =
  | "non_authentifie"      // 401
  | "droit_insuffisant"    // 403
  | "introuvable"          // 404
  | "conflit_de_version"   // 409
  | "validation"           // 422
  | "trop_de_requetes"     // 429
  | "indisponible";        // 503

const STATUTS: Record<CodeErreur, number> = {
  non_authentifie: 401,
  droit_insuffisant: 403,
  introuvable: 404,
  conflit_de_version: 409,
  validation: 422,
  trop_de_requetes: 429,
  indisponible: 503,
};

export interface DetailErreur {
  /** Message destiné à l'interface, lisible par un élève ou un enseignant. */
  readonly message: string;
  /** Erreurs par champ, pour un formulaire. */
  readonly champs?: Record<string, string>;
  /** Version actuelle de la ressource, sur un conflit. */
  readonly versionActuelle?: number;
  /** Secondes avant nouvelle tentative, sur une limitation de débit. */
  readonly reprendreDansSecondes?: number;
}

export function erreur(code: CodeErreur, detail: DetailErreur): NextResponse {
  const statut = STATUTS[code];
  const entetes: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    // Une réponse d'API privée ne doit jamais être mise en cache par un
    // intermédiaire ni par le navigateur d'un poste partagé (ch. 19).
    "cache-control": "no-store",
  };

  if (code === "trop_de_requetes" && detail.reprendreDansSecondes !== undefined) {
    entetes["retry-after"] = String(detail.reprendreDansSecondes);
  }

  return new NextResponse(JSON.stringify({ erreur: code, ...detail }), {
    status: statut,
    headers: entetes,
  });
}

export function succes<T>(donnees: T, statut = 200): NextResponse {
  return new NextResponse(JSON.stringify(donnees), {
    status: statut,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Non-divulgation : quand refuser l'accès révélerait l'existence de l'objet,
 * on répond « introuvable ». Le refus reste journalisé côté serveur avec le
 * vrai motif — c'est l'appelant qui n'apprend rien, pas l'exploitant.
 *
 * On ne l'utilise PAS quand l'utilisateur sait déjà légitimement que l'objet
 * existe : dire « vous n'avez pas le droit » est alors plus honnête et plus
 * utile qu'un faux « ça n'existe pas ».
 */
export function refusDiscret(objetConnuDeLAppelant: boolean): NextResponse {
  return objetConnuDeLAppelant
    ? erreur("droit_insuffisant", { message: "Vous n'avez pas accès à cette ressource." })
    : erreur("introuvable", { message: "Ressource introuvable." });
}

/**
 * Pagination par curseur (ch. 22) : 50 éléments par défaut, 100 au maximum.
 * Aucune liste intégrale d'élèves n'est servie pour alimenter un sélecteur.
 */
export const PAGE_PAR_DEFAUT = 50;
export const PAGE_MAXIMUM = 100;

export function taillePage(demande: string | null): number {
  if (demande === null) return PAGE_PAR_DEFAUT;
  const valeur = Number.parseInt(demande, 10);
  if (!Number.isFinite(valeur) || valeur <= 0) return PAGE_PAR_DEFAUT;
  return Math.min(valeur, PAGE_MAXIMUM);
}

/**
 * Journalise une erreur serveur sans jamais renvoyer son détail au client.
 * Le corps d'une copie, un mot de passe ou un jeton ne doivent pas atterrir
 * dans les journaux (ABUSE-02).
 */
export function erreurInterne(contexte: string, cause: unknown): NextResponse {
  const reference = crypto.randomUUID();
  console.error(
    JSON.stringify({
      niveau: "erreur",
      contexte,
      reference,
      message: cause instanceof Error ? cause.message : "erreur inconnue",
    }),
  );
  return new NextResponse(
    JSON.stringify({
      erreur: "indisponible",
      message: "Une erreur est survenue. Réessayez dans un instant.",
      reference,
    }),
    {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

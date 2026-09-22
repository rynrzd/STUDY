/**
 * Protection des mutations — WEB-03 du cahier des charges.
 *
 * Trois défenses indépendantes, parce qu'aucune ne suffit seule. Celles-ci sont
 * **déployées** : chacune se constate sur la production, et la dernière section
 * de ce commentaire dit comment.
 *
 *  1. `SameSite=Lax` sur le cookie de session. Une requête POST partie d'un
 *     autre site n'emporte donc pas la session : elle s'exécute anonyme. Utile,
 *     mais ce n'est pas toute la défense — elle ne couvre ni les navigateurs
 *     anciens, ni un sous-domaine compromis.
 *  2. `verifierMutation`, appelée par `src/proxy.ts` sur **toute** méthode à
 *     effet, avant que la requête n'atteigne quoi que ce soit : Fetch Metadata,
 *     puis `Origin` avec repli sur `Referer`, contre une liste explicite.
 *  3. La vérification propre à Next sur les actions serveur, qui compare
 *     l'origine à l'hôte et refuse « Invalid Server Actions request ».
 *
 * Et une règle structurante : **aucune mutation en GET**. Une requête qui
 * change l'état passe par POST, PUT, PATCH ou DELETE, sans exception.
 *
 * ---------------------------------------------------------------------------
 * Ce que ce module ne fait pas, et pourquoi c'est écrit ici
 * ---------------------------------------------------------------------------
 *
 * Il n'y a **pas** de jeton CSRF à double dépôt. Il y en a eu la description,
 * et même des fonctions testées — mais rien ne les appelait : l'audit du
 * 23 septembre 2026 a trouvé `verifierMutation` couverte par cinq tests verts
 * et introuvable dans `src/`. Une défense décrite mais non branchée est pire
 * que son absence, parce qu'on la compte.
 *
 * Deux choses ont été faites plutôt qu'une : la fonction éprouvée est devenue
 * celle que le proxy appelle, et le jeton — qui aurait demandé un champ caché
 * dans chaque formulaire et une vérification dans chaque action — a été retiré
 * au lieu d'être laissé en promesse. Les trois défenses ci-dessus suffisent
 * pour un navigateur qui respecte `SameSite`, et le risque résiduel est nommé
 * dans le dossier de sécurité plutôt que masqué par du code mort.
 */

const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

export function estMutation(methode: string): boolean {
  return !METHODES_SANS_EFFET.has(methode.toUpperCase());
}

export type RefusCsrf = "origine_absente" | "origine_etrangere" | "contexte_suspect";

export interface RequeteAVerifier {
  readonly methode: string;
  readonly origine: string | null;
  readonly referer: string | null;
  /** `Sec-Fetch-Site` : same-origin, same-site, cross-site ou none. */
  readonly fetchSite: string | null;
  /** `Sec-Fetch-Mode` : navigate, cors, no-cors… */
  readonly fetchMode: string | null;
}

export interface VerdictCsrf {
  readonly accepte: boolean;
  readonly motif?: RefusCsrf;
}

const ACCEPTE: VerdictCsrf = { accepte: true };

function refus(motif: RefusCsrf): VerdictCsrf {
  return { accepte: false, motif };
}

/**
 * Vérifie une mutation venant d'un navigateur.
 *
 * `originesAutorisees` est la liste explicite des origines du service. Elle ne
 * contient jamais `*`, et le service ne renvoie jamais `Access-Control-Allow-
 * Origin: *` avec des cookies (ch. 25).
 *
 * Les webhooks n'entrent PAS ici : ils sont authentifiés par leur signature et
 * sont exemptés de la logique CSRF navigateur (ch. 25, WEB-03).
 */
export function verifierMutation(
  requete: RequeteAVerifier,
  originesAutorisees: readonly string[],
): VerdictCsrf {
  if (!estMutation(requete.methode)) return ACCEPTE;

  // 1. Fetch Metadata : un POST déclenché depuis un autre site est refusé
  //    d'emblée, sur la foi d'un en-tête que la page appelante ne peut pas
  //    fabriquer — c'est le navigateur qui le pose.
  const site = requete.fetchSite === null ? null : requete.fetchSite.toLowerCase();
  if (site !== null) {
    if (site !== "same-origin" && site !== "none") {
      return refus("contexte_suspect");
    }
    // `none` correspond à une action lancée par la personne hors page (barre
    // d'adresse). Une mutation ne devrait jamais arriver par ce chemin.
    if (site === "none" && requete.fetchMode === "navigate") {
      return refus("contexte_suspect");
    }
  }

  // 2. Origin, avec Referer en repli pour les navigateurs qui l'omettent.
  //    `strict-origin-when-cross-origin` garantit qu'un Referer reste présent
  //    en même origine, et réduit à l'origine seule quand il vient d'ailleurs :
  //    dans les deux cas, c'est exactement ce qu'on compare.
  const origine = requete.origine ?? origineDepuisReferer(requete.referer);
  if (origine !== null) {
    return originesAutorisees.includes(origine) ? ACCEPTE : refus("origine_etrangere");
  }

  // 3. Aucune origine présentée. Le cas existe pour de bon : une requête sans
  //    `Origin` **ni** `Sec-Fetch-Site` franchissait la barrière en production
  //    le 23 septembre 2026 (constat F-06), et Next laisse lui aussi passer une
  //    action serveur dont l'origine est absente — c'est écrit dans son code.
  //
  //    Un navigateur qui a répondu `same-origin` a déjà dit ce qu'il fallait
  //    savoir ; on ne lui redemande pas une origine qu'il n'envoie pas toujours
  //    sur un POST de formulaire. Sans cette affirmation, en revanche, rien ne
  //    distingue la requête d'une requête forgée : on refuse.
  if (site === "same-origin") return ACCEPTE;
  return refus("origine_absente");
}

function origineDepuisReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origines acceptées pour une mutation.
 *
 * En principe une seule : l'origine canonique du service (APP_ORIGIN, ch. 40).
 * Le BFF ne sert que son propre navigateur ; il n'a aucune raison d'accepter
 * une mutation venue d'ailleurs. Une valeur générique `*` est ignorée, jamais
 * appliquée — le ch. 25 interdit `*` avec des credentials.
 *
 * COLLAB_ORIGIN n'entre pas ici : le service temps réel s'authentifie par
 * ticket signé, pas par cookie, et ne passe pas par cette vérification.
 *
 * @param origineDeLaRequete origine du déploiement qui reçoit la requête. Elle
 *   n'est acceptée que sur un déploiement d'aperçu — voir ci-dessous.
 *
 * S'y ajoute, en production, le domaine canonique déclaré par l'hébergeur
 * (`VERCEL_PROJECT_PRODUCTION_URL`), qui vient lui aussi de l'environnement.
 */
export function originesAutorisees(
  origineDeLaRequete: string | null = null,
  source: Record<string, string | undefined> = process.env,
): string[] {
  const acceptees: string[] = [];

  const canonique = (source.APP_ORIGIN ?? "").trim();
  if (canonique !== "" && canonique !== "*") {
    try {
      acceptees.push(new URL(canonique).origin);
    } catch {
      // APP_ORIGIN illisible : on ne l'accepte pas plutôt que de deviner.
    }
  }

  // Déploiement d'aperçu : son adresse est tirée au hasard à chaque commit et
  // ne peut donc pas figurer dans APP_ORIGIN. Sans cette exception, aucun
  // formulaire n'est utilisable sur une Preview — et la recette avant fusion,
  // qui est tout l'intérêt d'une Preview, devient impossible.
  //
  // L'exception est étroite : elle n'accepte que l'origine du déploiement
  // lui-même, jamais une origine tierce, et elle disparaît en production. Une
  // Preview est de toute façon une origine distincte : ses cookies ne sont pas
  // ceux du domaine de production.
  if (source.VERCEL_ENV === "preview" && origineDeLaRequete !== null) {
    try {
      const propre = new URL(origineDeLaRequete).origin;
      if (!acceptees.includes(propre)) acceptees.push(propre);
    } catch {
      // Origine illisible : rien à ajouter.
    }
  }

  // Le domaine canonique du déploiement, tel que l'hébergeur le déclare.
  //
  // Il vient de l'environnement, comme APP_ORIGIN, et **jamais de la requête** :
  // une page tierce ne peut donc pas le fabriquer. La sécurité est la même ;
  // ce qui change, c'est qu'une seule variable mal renseignée ne suffit plus à
  // rendre tous les formulaires du site inutilisables — panne silencieuse,
  // constatée en production, et invisible à la compilation comme aux tests
  // locaux.
  //
  // APP_ORIGIN reste la valeur qui fait foi partout ailleurs (liens absolus,
  // plan du site, métadonnées) : celle-ci ne la remplace pas, elle la double.
  const canoniqueHebergeur = (source.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (canoniqueHebergeur !== "") {
    try {
      const avecProtocole = canoniqueHebergeur.includes("://")
        ? canoniqueHebergeur
        : `https://${canoniqueHebergeur}`;
      const origine = new URL(avecProtocole).origin;
      if (!acceptees.includes(origine)) acceptees.push(origine);
    } catch {
      // Valeur illisible : on ne devine pas.
    }
  }

  return acceptees;
}

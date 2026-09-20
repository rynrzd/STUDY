/**
 * Dates lisibles, identiques sur le serveur et dans le navigateur.
 *
 * `toLocaleString` sans fuseau explicite prend celui de la machine. Le serveur
 * tourne en UTC, le navigateur à l'heure de l'élève : la même date sortait
 * « 14:32 » d'un côté et « 16:32 » de l'autre. React voyait deux textes
 * différents pour le même nœud et abandonnait l'hydratation de l'arbre —
 * erreur 418, observée sur la page d'édition du Studio en production.
 *
 * Une plateforme de lycée français a un fuseau, et un seul. On le nomme donc,
 * au lieu de laisser chaque machine répondre pour elle-même.
 *
 * Ces fonctions ne vivent pas dans un composant : elles servent des deux côtés
 * de l'hydratation, et c'est précisément le point.
 */

const FUSEAU = "Europe/Paris";
const LANGUE = "fr-FR";

/** « 20 septembre » — pour une date qu'on situe dans l'année scolaire. */
export function jourLisible(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(LANGUE, {
    timeZone: FUSEAU,
    day: "numeric",
    month: "long",
  });
}

/** « 20 septembre à 16:32 » — quand l'heure compte, pour une modification. */
export function instantLisible(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(LANGUE, {
    timeZone: FUSEAU,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** « 20 septembre 2026 » — pour une trace, un journal, une facture. */
export function dateCompleteLisible(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(LANGUE, {
    timeZone: FUSEAU,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

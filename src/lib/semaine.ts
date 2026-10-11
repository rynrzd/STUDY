/**
 * « Ta semaine » : les jours de la semaine en cours (lundi → dimanche, heure
 * de Paris) où la personne s'est entraînée.
 *
 * Volontairement pas une « série » : le cahier (ch. 01) proscrit la série
 * quotidienne punitive. Rien ne se perd, rien ne se remet à zéro un jour
 * manqué ; la semaine suivante repart simplement vide.
 */

export interface Semaine {
  /** Sept cases, lundi d'abord ; `true` = au moins une tentative ce jour-là. */
  readonly jours: readonly boolean[];
  /** Index du jour courant (0 = lundi). */
  readonly aujourdHui: number;
  readonly actifs: number;
}

export const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

/** La date du jour à Paris, au format AAAA-MM-JJ (celui de `tentatives.jour`). */
export function jourParis(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

const enJours = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const indexDuJour = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;

/** Le lundi de la semaine d'un jour donné, AAAA-MM-JJ. */
export function lundiDe(jour: string): string {
  return new Date((enJours(jour) - indexDuJour(jour)) * 86_400_000).toISOString().slice(0, 10);
}

export function semaineDepuis(joursActifs: readonly string[], aujourdhui: string): Semaine {
  const aujourdHui = indexDuJour(aujourdhui);
  const lundi = enJours(aujourdhui) - aujourdHui;
  const jours = Array.from({ length: 7 }, () => false);
  for (const iso of joursActifs) {
    const k = enJours(iso) - lundi;
    if (k >= 0 && k <= aujourdHui) jours[k] = true;
  }
  return { jours, aujourdHui, actifs: jours.filter(Boolean).length };
}

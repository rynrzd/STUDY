/**
 * Heures d'une évaluation : saisies et affichées à l'heure de Paris, quel que
 * soit le fuseau du serveur (UTC sur l'hébergeur). Changement d'heure compris.
 */

const FUSEAU = "Europe/Paris";

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné. */
function decalageParis(instant: number): number {
  const nom = new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, timeZoneName: "longOffset" })
    .formatToParts(new Date(instant))
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nom);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** « 2026-10-12T08:00 » (heure de Paris) → instant ISO en UTC ; null si vide ou illisible. */
export function parisVersIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const naif = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Deux passes : le décalage dépend de l'instant, qui dépend du décalage.
  let instant = naif - decalageParis(naif) * 60000;
  instant = naif - decalageParis(instant) * 60000;
  return new Date(instant).toISOString();
}

/** Instant ISO → « 2026-10-12T08:00 » à l'heure de Paris, pour un champ datetime-local. */
export function isoVersParis(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** « mardi 12 octobre à 08:00 », à l'heure de Paris. */
export function heureLisible(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(" ", " ");
}

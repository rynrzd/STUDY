import { isoVersParis, parisVersIso } from "./evaluations/dates.ts";

/** Les champs date et heure des devoirs sont toujours exprimés à Paris. */
export function echeanceDevoirVersIso(date: string, heure: string): string | null {
  const jour = date.trim();
  if (!jour) return null;
  const locale = `${jour}T${heure.trim() || "23:59"}`;
  const instant = parisVersIso(locale);

  // Refuser les jours inexistants et les heures sautées au printemps : une
  // normalisation silencieuse changerait l'échéance sans prévenir le prof.
  return instant !== null && isoVersParis(instant) === locale ? instant : null;
}

/** Préremplissage de l'édition : date *et* heure dans le même fuseau. */
export function champsEcheanceDevoir(instant: string | null | undefined): { date: string; heure: string } {
  const locale = isoVersParis(instant);
  if (!locale) return { date: "", heure: "" };
  const [date, heure] = locale.split("T");
  return { date: date ?? "", heure: heure ?? "" };
}

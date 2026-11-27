/** Résumé pour le professeur, sans déduire un état de remise depuis l'horloge client. */
export function prioritesDevoirs<T extends { etat: string; echeance: string | null }>(
  devoirs: readonly T[],
  maintenant: Date = new Date(),
) {
  const depart = maintenant.getTime();
  const semaine = depart + 7 * 24 * 60 * 60 * 1000;
  const brouillons = devoirs.filter((devoir) => devoir.etat === "brouillon");
  const aRendreBientot = devoirs.filter((devoir) => {
    if (devoir.etat !== "publie" || devoir.echeance === null) return false;
    const echeance = Date.parse(devoir.echeance);
    return Number.isFinite(echeance) && echeance >= depart && echeance <= semaine;
  });
  const actifs = devoirs.filter((devoir) => devoir.etat === "publie" || devoir.etat === "publie_en_retard");
  return { brouillons, aRendreBientot, actifs };
}

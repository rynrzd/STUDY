/** Une remise existe ou non selon la base ; l'horloge ne sert qu'à l'ordre des cartes. */
export function classerDevoirsEleve<T extends {
  devoir: { etat: string; echeance: string | null };
  etat: string;
  corrige: boolean;
}>(lignes: readonly T[], maintenant: Date = new Date()) {
  const limiteBientot = maintenant.getTime() + 7 * 24 * 60 * 60 * 1000;
  const estRemis = (etat: string) => ["remis", "remis_en_retard", "retour_disponible"].includes(etat);
  const trier = (a: T, b: T) =>
    (a.devoir.echeance ?? "9999").localeCompare(b.devoir.echeance ?? "9999");

  const aFaire = lignes.filter((ligne) =>
    !ligne.corrige && !estRemis(ligne.etat) && ligne.devoir.etat !== "ferme",
  );
  const bientot = aFaire.filter((ligne) =>
    ligne.devoir.echeance !== null && Date.parse(ligne.devoir.echeance) <= limiteBientot,
  ).sort(trier);
  const proches = new Set(bientot);
  const plusTard = aFaire.filter((ligne) => !proches.has(ligne)).sort(trier);
  const encoreAFaire = new Set(aFaire);
  const termines = lignes.filter((ligne) => !encoreAFaire.has(ligne)).sort(trier);
  return { bientot, plusTard, termines, nombreAFaire: aFaire.length };
}

/**
 * Règles d'affichage des échéances — cahier V2, §7 et §11.
 *
 * Volontairement hors de `espace-eleve.ts` : ce sont des fonctions pures, sans
 * accès à la base ni au réseau. Elles ne portent donc pas `server-only`, et
 * peuvent servir aussi bien dans une page serveur que dans un composant
 * client — ou être testées directement, ce qui est le plus utile des trois.
 *
 * Une erreur ici ne fait pas tomber l'application : elle fait disparaître un
 * devoir de la liste « À faire ». C'est pire, parce que personne ne signale un
 * devoir qu'il n'a pas vu.
 */

/**
 * Sépare les devoirs à venir de ceux dont l'échéance est passée.
 *
 * Un devoir sans échéance est « à venir » : il reste à faire, et le ranger
 * dans le passé le ferait disparaître de la liste que l'élève consulte.
 */
export function trierDevoirs<T extends { due_at: string | null }>(
  devoirs: readonly T[],
  maintenant = new Date(),
): { aVenir: T[]; passes: T[] } {
  const aVenir: T[] = [];
  const passes: T[] = [];

  for (const devoir of devoirs) {
    if (devoir.due_at === null || new Date(devoir.due_at) >= maintenant) aVenir.push(devoir);
    else passes.push(devoir);
  }

  // Les devoirs passés se lisent du plus récent au plus ancien : celui de la
  // semaine dernière intéresse plus que celui du mois dernier.
  passes.reverse();
  return { aVenir, passes };
}

/** La séance datée d'aujourd'hui, s'il y en a une. */
export function seanceDuJour<T extends { scheduled_for: string | null }>(
  seances: readonly T[],
  maintenant = new Date(),
): T | null {
  const jour = maintenant.toISOString().slice(0, 10);
  return seances.find((seance) => seance.scheduled_for?.slice(0, 10) === jour) ?? null;
}

/** Les séances datées d'aujourd'hui. */
export function seancesDuJour<T extends { scheduled_for: string | null }>(
  seances: readonly T[],
  maintenant = new Date(),
): T[] {
  const jour = maintenant.toISOString().slice(0, 10);
  return seances.filter((seance) => seance.scheduled_for?.slice(0, 10) === jour);
}

/**
 * Libellé court d'une échéance, pour une liste.
 *
 * Au-delà d'une semaine, la date remplace le décompte : « dans 42 jours »
 * n'aide personne à s'organiser, « pour le 3 novembre » si.
 */
export function echeanceLisible(date: string | null, maintenant = new Date()): string {
  if (date === null) return "Sans date limite";

  const echeance = new Date(date);
  const jours = Math.round(
    (new Date(echeance.toDateString()).getTime() - new Date(maintenant.toDateString()).getTime()) /
      86_400_000,
  );

  if (jours === 0) return "Pour aujourd'hui";
  if (jours === 1) return "Pour demain";
  if (jours === -1) return "Était pour hier";
  if (jours > 1 && jours <= 7) return `Dans ${jours} jours`;
  if (jours < -1) return `En retard de ${Math.abs(jours)} jours`;

  return `Pour le ${echeance.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

import type { RevisionDevoir } from "./devoirs";
import type { Suggestion } from "../v6/revision";

/** Une sélection limitée par matière, depuis des exercices réellement publiés. */
export function entrainementsParMatiere(
  matieres: readonly { id: string; libelle: string }[],
  suggestions: readonly Suggestion[],
  devoirs: readonly RevisionDevoir[],
) {
  return matieres.map((matiere) => {
    const liesAuxDevoirs = devoirs.filter((d) => d.espace_id === matiere.id && d.versions.length);
    const notions = suggestions.filter((s) => s.espaceId === matiere.id && s.versions.length);
    // Des devoirs d'abord, puis une première question par notion, puis les
    // questions supplémentaires. Cela évite huit variantes du même exercice.
    const priorites = liesAuxDevoirs.flatMap((d) => d.versions.slice(0, 2));
    const premierTour = notions.map((s) => s.versions[0]!);
    const autres = [...liesAuxDevoirs.flatMap((d) => d.versions.slice(2)), ...notions.flatMap((s) => s.versions.slice(1))];
    const versions = [...new Set([...priorites, ...premierTour, ...autres])].slice(0, 8);
    const aTravailler = [...new Set([
      ...liesAuxDevoirs.map((d) => d.notion),
      ...notions.map((s) => s.notion),
    ])].filter(Boolean).slice(0, 3);
    return {
      ...matiere,
      versions,
      notions: aTravailler,
      devoirs: liesAuxDevoirs.length,
    };
  });
}

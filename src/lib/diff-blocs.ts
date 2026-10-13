/**
 * Ce qui a changé depuis la publication — cahier des charges ch. 14
 * (PUB-11). La version publiée est figée (content_versions.body.blocs) ; on
 * la compare aux blocs actuels avant de republier, pour que le professeur
 * sache ce que ses élèves verront de nouveau.
 *
 * Un bloc identique (même type, même contenu) est inchangé, où qu'il soit.
 * Parmi les autres, deux blocs de même type à la même position sont un bloc
 * modifié ; le reste est ajouté ou retiré.
 */
export interface BlocComparable {
  readonly kind: string;
  readonly position: number;
  readonly contenu: Record<string, unknown>;
}

export interface Differences {
  readonly ajoutes: number;
  readonly modifies: number;
  readonly retires: number;
  readonly deplaces: boolean;
}

const signature = (b: BlocComparable) => `${b.kind}|${JSON.stringify(b.contenu, Object.keys(b.contenu).sort())}`;

export function comparerBlocs(avant: readonly BlocComparable[], apres: readonly BlocComparable[]): Differences {
  const restantsAvant = [...avant];
  const restantsApres: BlocComparable[] = [];
  for (const b of apres) {
    const i = restantsAvant.findIndex((a) => signature(a) === signature(b));
    if (i >= 0) restantsAvant.splice(i, 1);
    else restantsApres.push(b);
  }
  let modifies = 0;
  for (const b of [...restantsApres]) {
    const i = restantsAvant.findIndex((a) => a.kind === b.kind && a.position === b.position);
    if (i >= 0) {
      modifies++;
      restantsAvant.splice(i, 1);
      restantsApres.splice(restantsApres.indexOf(b), 1);
    }
  }
  const ordre = (l: readonly BlocComparable[]) => [...l].sort((x, y) => x.position - y.position).map(signature).join("¶");
  const memesBlocs = restantsAvant.length === 0 && restantsApres.length === 0 && modifies === 0;
  return { ajoutes: restantsApres.length, modifies, retires: restantsAvant.length, deplaces: memesBlocs && ordre(avant) !== ordre(apres) };
}

export function resumeDifferences(d: Differences): string {
  const morceaux = [
    d.modifies > 0 ? `${d.modifies} bloc${d.modifies > 1 ? "s" : ""} modifié${d.modifies > 1 ? "s" : ""}` : null,
    d.ajoutes > 0 ? `${d.ajoutes} ajouté${d.ajoutes > 1 ? "s" : ""}` : null,
    d.retires > 0 ? `${d.retires} retiré${d.retires > 1 ? "s" : ""}` : null,
    d.deplaces ? "ordre changé" : null,
  ].filter(Boolean);
  return morceaux.length === 0 ? "Aucune modification depuis la publication." : `Depuis la publication : ${morceaux.join(", ")}.`;
}

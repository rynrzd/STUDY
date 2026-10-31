/** Isolation locale uniquement : le serveur décide toujours de l'identité et des droits. */
export function cleBrouillonNote(proprietaire: string, seance: string, autorise: boolean): string | null {
  if (!autorise || !proprietaire || !seance) return null;
  return `study-note-v2:${encodeURIComponent(proprietaire)}:${encodeURIComponent(seance)}`;
}

export function garderBrouillon(stockage: Pick<Storage, "setItem">, cle: string | null, texte: string): boolean {
  if (cle === null) return false;
  try { stockage.setItem(cle, texte); return true; } catch { return false; }
}

/** Un ancien accusé ne doit jamais effacer une nouvelle saisie en attente. */
export function retirerBrouillonConfirme(stockage: Pick<Storage, "getItem" | "removeItem">, cle: string | null, texte: string): void {
  if (cle === null) return;
  try { if (stockage.getItem(cle) === texte) stockage.removeItem(cle); } catch { /* stockage indisponible */ }
}

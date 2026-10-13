/**
 * Deux noms de groupe qui se confondent (cahier des charges ch. 07, GR-14).
 *
 * Voisins : identiques aux accents, à la casse, aux espaces et à la
 * ponctuation près, ou à une faute de frappe près (une lettre ajoutée,
 * retirée ou changée). Pas voisins : deux noms qui ne diffèrent que par leur
 * dernière lettre ou leur dernier chiffre — « Spé Maths A » et « Spé Maths B »
 * sont deux groupes voulus.
 */
export function plat(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length]![b.length]!;
}

export function nomsVoisins(x: string, y: string): boolean {
  const a = plat(x);
  const b = plat(y);
  if (a === "" || b === "") return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  // Seule la dernière lettre ou le dernier chiffre change : deux groupes d'une série.
  if (a.length === b.length && a.slice(0, -1) === b.slice(0, -1)) return false;
  return distance(a, b) <= 1;
}

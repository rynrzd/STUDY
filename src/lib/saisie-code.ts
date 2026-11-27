/** Une seule source de vérité pour le champ OTP : six chiffres ASCII au plus. */
export function normaliserSaisieCode(valeur: string): string {
  return valeur.replace(/[^0-9]/gu, "").slice(0, 6);
}

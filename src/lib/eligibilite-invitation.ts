/** Une invitation ordinaire sert uniquement à activer un compte élève neuf.
 * Un compte déjà actif passe par la récupération d'accès, réservée à l'administration.
 */
export function peutPreparerInvitationEleve(etatCompte: string | null | undefined): boolean {
  return etatCompte === "a_activer";
}

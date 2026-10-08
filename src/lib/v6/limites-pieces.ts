/** Plafond de transport actuel : multipart via Vercel (4,5 MB au total).
 * 4 000 000 octets laissent une marge pour les en-têtes multipart.
 * Augmenter seulement après un transfert direct vers le stockage vérifié.
 */
export const TAILLE_MAX_PIECE = 4_000_000;
export const CORPS_MAX_PIECE = 4_200_000;
export const LIMITE_PIECE_LIBELLE = "4 Mo";

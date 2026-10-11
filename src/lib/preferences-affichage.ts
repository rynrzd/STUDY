/**
 * Préférences d'affichage gardées dans un cookie, lues par le serveur pour
 * rendre la bonne mise en page dès le premier octet. Purement visuelles :
 * elles n'ouvrent aucun droit. Module sans « use client » : un composant
 * serveur doit lire la valeur, pas une référence client.
 */
export const COOKIE_BARRE = "study_barre";

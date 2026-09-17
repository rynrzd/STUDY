import { EspaceEnAttente } from "@/components/app/Chargement";

/**
 * Écran d'attente de l'espace du Studio.
 *
 * Affiché par Next dès le clic, pendant que le serveur interroge la base. Sans
 * lui, la navigation ne produit rien de visible le temps de la requête — et on
 * reclique, croyant avoir manqué le bouton.
 */
export default function Chargement() {
  return <EspaceEnAttente cartes={2} lignes={6} />;
}

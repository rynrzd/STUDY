#!/usr/bin/env node
// =============================================================================
// Tests navigateur — chapitre 40.
//
// La commande existe et retourne un résultat interprétable, comme le chapitre
// l'exige. Ce qu'elle retourne aujourd'hui, c'est qu'elle n'a rien à exécuter :
// aucun parcours de bout en bout n'est automatisable tant que la connexion
// n'est pas raccordée.
//
// Faire passer cette commande au vert en n'exécutant rien serait exactement le
// faux succès que le ch. 29 interdit.
// =============================================================================

import { titre } from "./_commun.mjs";

const PARCOURS_A_AUTOMATISER = [
  ["Admin", "importer un fichier, verifier l'apercu, creer comptes et classes"],
  ["Admin", "interrompre un import puis le reprendre"],
  ["Eleve", "activer son acces, choisir un mot de passe, se reconnecter"],
  ["Eleve", "verifier que le secret temporaire echoue apres activation"],
  ["Prof", "preparer un cours, deposer un PDF de test, publier en Seconde 1 seulement"],
  ["Eleve S1", "ouvrir le cours, ecrire, recharger, retrouver son brouillon, rendre"],
  ["Eleve S2", "tenter les memes URL : refus sans copie ni titre confidentiel"],
  ["Lycee B", "tenter les memes URL : refus sans fuite"],
  ["Prof", "annoter et publier le retour"],
  ["Eleve", "ouvrir sa correction et l'enregistrer pour revision"],
  ["Groupe", "ecrire a deux, recharger, retrouver le brouillon partage"],
  ["Groupe", "retirer un membre et verifier sa revocation"],
  ["Gestion", "creer un devis, un contrat, une facture, et rapprocher un virement"],
  ["Recette visuelle", "landing et vues 01-18 a 390, 768 et 1440 px"],
  ["Accessibilite", "parcours principal au clavier et au lecteur d'ecran"],
];

titre("AvecStudy — tests navigateur");

console.log("Etat : aucun test navigateur n'est automatise.\n");
console.log("Ce qui bloque :");
console.log("  - la connexion n'est pas operationnelle (fournisseur d'identite non raccorde) ;");
console.log("  - sans session, aucun parcours de bout en bout n'est jouable ;");
console.log("  - aucun outil de pilotage de navigateur n'est installe dans ce depot.\n");

console.log(`Parcours a automatiser une fois la connexion raccordee (ch. 41) — ${PARCOURS_A_AUTOMATISER.length} :`);
for (const [acteur, parcours] of PARCOURS_A_AUTOMATISER) {
  console.log(`  ${acteur.padEnd(18)} ${parcours}`);
}

console.log("\nCette commande sort en echec volontairement : une suite de tests vide");
console.log("qui renverrait « succes » serait un faux succes.");

process.exit(1);

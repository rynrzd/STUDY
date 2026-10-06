import type { LienEspace } from "./Cadre";

/**
 * Les navigations des trois espaces — cahier V2, §7, §8 et §14.
 *
 * Elles vivent ici plutôt que dans chaque gabarit parce que `/studio` et
 * `/professeur` sont deux segments de route distincts qui doivent afficher
 * exactement la même barre : un lien ajouté d'un côté et oublié de l'autre se
 * verrait immédiatement à l'usage.
 */

export const LIENS_PROFESSEUR: readonly LienEspace[] = [
  { href: "/professeur", libelle: "Accueil" },
  { href: "/professeur/classes", libelle: "Mes classes" },
  // « Mes cours » ouvre les chapitres et séances ; « Studio » ouvre l'import
  // d'un document existant. Deux gestes distincts, deux entrées distinctes.
  { href: "/studio", libelle: "Mes cours" },
  { href: "/professeur/studio", libelle: "Studio" },
  { href: "/studio/exercices", libelle: "Banque d’exercices" },
  { href: "/app/prof/ateliers", libelle: "Ateliers" },
  { href: "/professeur/devoirs", libelle: "Devoirs" },
  { href: "/parametres", libelle: "Paramètres" },
];

export const LIENS_ELEVE: readonly LienEspace[] = [
  { href: "/app", libelle: "Accueil" },
  { href: "/app/cours", libelle: "Mes cours" },
  { href: "/app/devoirs", libelle: "À faire" },
  { href: "/app/entraide", libelle: "Entraide" },
  { href: "/parametres", libelle: "Paramètres" },
];

export const LIENS_ADMIN: readonly LienEspace[] = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/classes", libelle: "Classes" },
  { href: "/admin/professeurs", libelle: "Professeurs" },
  { href: "/admin/utilisateurs", libelle: "Utilisateurs" },
  { href: "/admin/import", libelle: "Import" },
  { href: "/admin/moderation", libelle: "Modération" },
  { href: "/admin/recuperation", libelle: "Demandes d’accès" },
  { href: "/admin/annees", libelle: "Années scolaires" },
  { href: "/parametres", libelle: "Paramètres" },
];

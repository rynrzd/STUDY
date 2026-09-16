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
  { href: "/studio", libelle: "Studio" },
  { href: "/professeur/devoirs", libelle: "Devoirs" },
  { href: "/parametres", libelle: "Paramètres" },
];

export const LIENS_ELEVE: readonly LienEspace[] = [
  { href: "/eleve", libelle: "Accueil" },
  { href: "/eleve/cours", libelle: "Mes cours" },
  { href: "/eleve/devoirs", libelle: "À faire" },
  { href: "/eleve/entraide", libelle: "Entraide" },
  { href: "/parametres", libelle: "Paramètres" },
];

export const LIENS_ADMIN: readonly LienEspace[] = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/classes", libelle: "Classes" },
  { href: "/admin/utilisateurs", libelle: "Utilisateurs" },
  { href: "/admin/import", libelle: "Import" },
  { href: "/parametres", libelle: "Paramètres" },
];

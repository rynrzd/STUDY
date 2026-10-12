import { OngletsLiens } from "@/components/study/ui";

/**
 * Onglets de rubrique : ce que le menu ne montre plus est ici, à un clic, à
 * l'intérieur de la rubrique qui le contient. Une rubrique = une entrée du
 * menu ; ses pages partagent les mêmes onglets, dans le même ordre, si bien
 * qu'on sait toujours où l'on est et où aller ensuite.
 */

type Onglet = { readonly href: string; readonly libelle: string };

function Rubrique({ etiquette, onglets, actif }: { etiquette: string; onglets: readonly Onglet[]; actif: string }) {
  // Enveloppe « rubrique » : sur téléphone, les onglets passent à la ligne au
  // lieu de défiler hors de l'écran — un onglet caché est un onglet perdu.
  return (
    <div className="rubrique">
      <OngletsLiens etiquette={etiquette} onglets={onglets.map((o) => ({ ...o, actif: o.href === actif }))} />
    </div>
  );
}

/** Professeur — « Mes cours » : préparer, importer, réutiliser. */
export const ONGLETS_COURS = [
  { href: "/studio", libelle: "Mes séances" },
  { href: "/professeur/studio", libelle: "Importer un document" },
  { href: "/studio/exercices", libelle: "Banque d’exercices" },
] as const satisfies readonly Onglet[];

export function RubriqueCours({ actif }: { actif: (typeof ONGLETS_COURS)[number]["href"] }) {
  return <Rubrique etiquette="Mes cours" onglets={ONGLETS_COURS} actif={actif} />;
}

/** Administration — « Personnes » : tous les comptes, les professeurs, l'import. */
export const ONGLETS_PERSONNES = [
  { href: "/admin/utilisateurs", libelle: "Tous les comptes" },
  { href: "/admin/professeurs", libelle: "Professeurs et cours" },
  { href: "/admin/import", libelle: "Importer un fichier" },
] as const satisfies readonly Onglet[];

export function RubriquePersonnes({ actif }: { actif: (typeof ONGLETS_PERSONNES)[number]["href"] }) {
  return <Rubrique etiquette="Personnes" onglets={ONGLETS_PERSONNES} actif={actif} />;
}

/** Administration — « Classes et groupes ». */
export const ONGLETS_CLASSES = [
  { href: "/admin/classes", libelle: "Classes et cours" },
  { href: "/admin/groupes", libelle: "Groupes (spécialités, options…)" },
] as const satisfies readonly Onglet[];

export function RubriqueClasses({ actif }: { actif: (typeof ONGLETS_CLASSES)[number]["href"] }) {
  return <Rubrique etiquette="Classes et groupes" onglets={ONGLETS_CLASSES} actif={actif} />;
}

/** Élève — « Cours » : les cours, ce qui est à rendre, les contrôles, les ateliers. */
export const ONGLETS_COURS_ELEVE = [
  { href: "/app/cours", libelle: "Mes cours" },
  { href: "/app/devoirs", libelle: "À faire" },
  { href: "/app/evaluations", libelle: "Évaluations" },
  { href: "/app/ateliers", libelle: "Ateliers" },
] as const satisfies readonly Onglet[];

export function RubriqueCoursEleve({ actif }: { actif: (typeof ONGLETS_COURS_ELEVE)[number]["href"] }) {
  return <Rubrique etiquette="Cours" onglets={ONGLETS_COURS_ELEVE} actif={actif} />;
}

/** Élève — « Projets et orientation ». */
export const ONGLETS_PROJETS = [
  { href: "/app/projets", libelle: "Mes projets" },
  { href: "/app/orientation", libelle: "Orientation" },
] as const satisfies readonly Onglet[];

export function RubriqueProjets({ actif }: { actif: (typeof ONGLETS_PROJETS)[number]["href"] }) {
  return <Rubrique etiquette="Projets et orientation" onglets={ONGLETS_PROJETS} actif={actif} />;
}

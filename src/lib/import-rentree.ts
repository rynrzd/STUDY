import type { Tableau } from "./tableur.ts";

/**
 * Import de rentrée — préparation et contrôle.
 *
 * Ce module ne touche pas la base : il lit un tableau, reconnaît les colonnes,
 * normalise, détecte les problèmes et propose des identifiants. Tout est donc
 * vérifiable sans Supabase, et l'aperçu montré à l'administrateur est
 * exactement ce qui sera écrit.
 *
 * Deux règles de fond, héritées du cahier des charges :
 *
 *  - **Aucune fusion silencieuse de classes.** « 2nde 1 » et « Seconde 1 »
 *    donnent deux classes distinctes. Si l'administrateur voulait les
 *    confondre, il corrige le fichier : c'est lui qui sait, pas nous.
 *  - **Aucune donnée inventée.** Une ligne incomplète est rejetée et affichée
 *    avec son numéro, jamais complétée par défaut.
 */

/* -------------------------------------------------------------------------- */
/* Reconnaissance des colonnes                                                 */
/* -------------------------------------------------------------------------- */

export type Champ = "nom" | "prenom" | "classe" | "identifiantExterne";

const SYNONYMES: Record<Champ, string[]> = {
  nom: ["nom", "nom de famille", "nom eleve", "nom_eleve", "lastname", "last name", "nom usuel"],
  prenom: ["prenom", "prénom", "prenom eleve", "prenom_eleve", "firstname", "first name"],
  classe: ["classe", "division", "groupe classe", "classe eleve", "class", "libelle classe"],
  identifiantExterne: [
    "ine",
    "identifiant",
    "identifiant externe",
    "id",
    "numero",
    "num eleve",
    "matricule",
    "identifiant national",
  ],
};

export type Correspondance = Partial<Record<Champ, number>>;

/** Reconnaît les colonnes d'après leurs intitulés. */
export function reconnaitreColonnes(entetes: readonly string[]): Correspondance {
  const correspondance: Correspondance = {};

  entetes.forEach((entete, index) => {
    const aplati = aplatir(entete);
    if (aplati === "") return;

    for (const [champ, synonymes] of Object.entries(SYNONYMES) as [Champ, string[]][]) {
      if (correspondance[champ] !== undefined) continue;
      if (synonymes.some((synonyme) => aplatir(synonyme) === aplati)) {
        correspondance[champ] = index;
        return;
      }
    }
  });

  return correspondance;
}

export function colonnesManquantes(correspondance: Correspondance): Champ[] {
  const requis: Champ[] = ["nom", "prenom", "classe"];
  return requis.filter((champ) => correspondance[champ] === undefined);
}

/* -------------------------------------------------------------------------- */
/* Analyse des lignes                                                          */
/* -------------------------------------------------------------------------- */

export interface LigneImport {
  /** Numéro affiché à l'administrateur : celui du tableur, en-tête comprise. */
  readonly numero: number;
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string;
  readonly identifiantExterne: string | null;
  /** Identifiant de connexion proposé. */
  readonly login: string;
  readonly probleme: string | null;
}

export interface Analyse {
  readonly lignes: LigneImport[];
  readonly valides: LigneImport[];
  readonly rejetees: LigneImport[];
  readonly classes: string[];
  readonly resume: Resume;
}

export interface Resume {
  readonly lues: number;
  readonly valides: number;
  readonly rejetees: number;
  readonly classes: number;
}

export const LIGNES_PAR_IMPORT = 800;

export function analyser(
  tableau: Tableau,
  correspondance: Correspondance,
  loginsExistants: readonly string[] = [],
): Analyse {
  const pris = new Set(loginsExistants.map((login) => login.toLowerCase()));
  const lignes: LigneImport[] = [];
  const classes = new Set<string>();

  tableau.lignes.forEach((brute, index) => {
    const numero = index + 2; // +1 pour l'en-tête, +1 pour compter à partir de 1

    const prenom = cellule(brute, correspondance.prenom);
    const nom = cellule(brute, correspondance.nom);
    const classe = cellule(brute, correspondance.classe);
    const externe = cellule(brute, correspondance.identifiantExterne);

    let probleme: string | null = null;
    if (prenom === "") probleme = "Prénom manquant";
    else if (nom === "") probleme = "Nom manquant";
    else if (classe === "") probleme = "Classe manquante";
    else if (prenom.length > 60 || nom.length > 60) probleme = "Nom ou prénom trop long";
    else if (classe.length > 40) probleme = "Libellé de classe trop long";

    const login = probleme === null ? proposerLogin(prenom, nom, pris) : "";
    if (probleme === null) {
      pris.add(login);
      classes.add(classe);
    }

    lignes.push({
      numero,
      prenom,
      nom,
      classe,
      identifiantExterne: externe === "" ? null : externe,
      login,
      probleme,
    });
  });

  const valides = lignes.filter((ligne) => ligne.probleme === null);
  const rejetees = lignes.filter((ligne) => ligne.probleme !== null);

  return {
    lignes,
    valides,
    rejetees,
    classes: [...classes].sort((a, b) => a.localeCompare(b, "fr")),
    resume: {
      lues: lignes.length,
      valides: valides.length,
      rejetees: rejetees.length,
      classes: classes.size,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Identifiants                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Identifiant lisible : `prenom.nom`, sans accent ni espace.
 *
 * En cas de collision, un suffixe numérique est ajouté — jamais l'année de
 * naissance ni une initiale supplémentaire, qui feraient entrer une donnée
 * personnelle de plus dans un identifiant affiché en classe.
 */
export function proposerLogin(prenom: string, nom: string, pris: ReadonlySet<string>): string {
  const base = `${aplatirIdentifiant(prenom)}.${aplatirIdentifiant(nom)}`
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 34);

  const racine = base === "" || base === "." ? "eleve" : base;
  if (!pris.has(racine)) return racine;

  for (let suffixe = 2; suffixe < 1000; suffixe++) {
    const candidat = `${racine}${suffixe}`;
    if (!pris.has(candidat)) return candidat;
  }

  return `${racine}${Date.now() % 100000}`;
}

/* -------------------------------------------------------------------------- */

function cellule(ligne: readonly string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (ligne[index] ?? "").trim();
}

/** Minuscules sans accent ni ponctuation, pour comparer des intitulés. */
function aplatir(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Forme admise par `memberships_login_format` : [a-z0-9][a-z0-9._-]{1,38} */
function aplatirIdentifiant(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

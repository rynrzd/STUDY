/**
 * Assistant de rentrée — cahier V5, §5 et §6.
 *
 * Ce module fait l'analyse, et **rien que l'analyse**. Il ne touche ni à la
 * base, ni au réseau : on lui donne des fichiers, il rend un plan. C'est ce qui
 * permet de le tester seul, et surtout c'est ce qui garantit la règle centrale
 * du chapitre 5 : *aucune création définitive pendant l'analyse*.
 *
 * Trois principes gouvernent tout le reste.
 *
 * **On ne décide jamais en silence.** Quand la classe d'un fichier est
 * ambiguë, l'assistant le dit et demande, au lieu de choisir. Un lycée qui
 * découvre après coup que « liste.xlsx » a créé une classe nommée « liste »
 * doit tout défaire à la main.
 *
 * **On ne fusionne jamais deux personnes sur leur seul nom.** Deux Martin
 * Dupont en Seconde 1, cela existe. L'assistant les signale comme homonymes ;
 * il ne les réduit pas à une ligne.
 *
 * **La valeur affichée n'est pas la valeur comparée.** « 2nde 4 », « 2DE4 » et
 * « Seconde 4 » se comparent après normalisation, mais ce que voit
 * l'établissement reste ce qu'il a écrit.
 */

import { proposerLogin } from "./import-rentree.ts";
import { type Tableau } from "./tableur.ts";

/* -------------------------------------------------------------------------- */
/* Champs reconnus                                                            */
/* -------------------------------------------------------------------------- */

export type ChampEleve = "nom" | "prenom" | "classe" | "email" | "identifiantExterne";
export type ChampProfesseur = "nom" | "prenom" | "email" | "matieres" | "classes";

export type Champ = ChampEleve | ChampProfesseur;

/** Intitulés admis, par champ. Comparés après aplatissement. */
const INTITULES: Record<Champ, readonly string[]> = {
  nom: ["nom", "nom eleve", "nom de l eleve", "nom famille", "nom de famille", "surname", "last name", "lastname", "nom prof", "nom enseignant"],
  prenom: ["prenom", "prenom eleve", "prenom de l eleve", "first name", "firstname", "given name", "prenom prof", "prenom enseignant"],
  classe: ["classe", "division", "groupe", "classes", "section", "class"],
  email: ["email", "e mail", "mail", "courriel", "adresse mail", "adresse electronique"],
  identifiantExterne: ["ine", "identifiant", "id", "identifiant national", "numero", "matricule"],
  matieres: ["matiere", "matieres", "discipline", "disciplines", "subject", "subjects"],
  classes: ["classe", "classes", "divisions", "groupes"],
};

/** Minuscules sans accent ni ponctuation : la forme sur laquelle on compare. */
export function aplatir(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type Confiance = "sur" | "a_confirmer" | "non_reconnu";

export interface ColonneReconnue {
  readonly index: number;
  readonly entete: string;
  readonly champ: Champ | null;
  readonly confiance: Confiance;
  /** Une valeur du fichier, pour que l'administrateur juge sur pièce (§5.3). */
  readonly exemple: string;
}

/**
 * Reconnaît les colonnes d'un tableau.
 *
 * Une correspondance exacte est « sûre ». Une correspondance partielle — « nom
 * de l'élève (obligatoire) » contient « nom » — est « à confirmer » : elle est
 * proposée, pas appliquée. Le reste est « non reconnu » et reste visible :
 * une colonne qu'on ne comprend pas ne disparaît pas de l'écran.
 */
export function reconnaitreColonnes(
  tableau: Tableau,
  champs: readonly Champ[],
): ColonneReconnue[] {
  const prises = new Set<Champ>();

  return tableau.entetes.map((entete, index) => {
    const plat = aplatir(entete);
    const exemple = premiereValeur(tableau, index);

    for (const champ of champs) {
      if (prises.has(champ)) continue;
      if (INTITULES[champ].includes(plat)) {
        prises.add(champ);
        return { index, entete, champ, confiance: "sur" as const, exemple };
      }
    }

    for (const champ of champs) {
      if (prises.has(champ)) continue;
      const partiel = INTITULES[champ].some(
        (attendu) => plat.startsWith(`${attendu} `) || plat.includes(` ${attendu}`),
      );
      if (partiel) {
        prises.add(champ);
        return { index, entete, champ, confiance: "a_confirmer" as const, exemple };
      }
    }

    return { index, entete, champ: null, confiance: "non_reconnu" as const, exemple };
  });
}

function premiereValeur(tableau: Tableau, colonne: number): string {
  for (const ligne of tableau.lignes) {
    const valeur = (ligne[colonne] ?? "").trim();
    if (valeur !== "") return valeur.slice(0, 40);
  }
  return "";
}

/** La correspondance retenue : champ → index de colonne. */
export type Correspondance = Partial<Record<Champ, number>>;

export function correspondanceDepuis(colonnes: readonly ColonneReconnue[]): Correspondance {
  const sortie: Correspondance = {};
  for (const colonne of colonnes) {
    if (colonne.champ !== null && sortie[colonne.champ] === undefined) {
      sortie[colonne.champ] = colonne.index;
    }
  }
  return sortie;
}

/* -------------------------------------------------------------------------- */
/* Détection de la classe                                                     */
/* -------------------------------------------------------------------------- */

export type SourceClasse = "fichier" | "colonne" | "saisie" | "inconnue";

export interface ClasseDetectee {
  readonly nom: string | null;
  readonly source: SourceClasse;
  /** Quand le fichier contient plusieurs classes, elles sont toutes là. */
  readonly multiples: readonly string[];
}

/**
 * Déduit la ou les classes d'un fichier.
 *
 * Une colonne « Classe » l'emporte sur le nom du fichier : elle décrit chaque
 * ligne, là où le nom du fichier décrit une intention. Un fichier global qui
 * contient dix classes est donc réparti correctement, sans que l'administrateur
 * ait à le découper.
 *
 * Sans colonne ni nom exploitable, on rend `null` : l'écran demandera. C'est
 * l'interdiction explicite du §5.2 — ne jamais décider en cas d'ambiguïté.
 */
export function detecterClasse(
  nomFichier: string,
  tableau: Tableau,
  correspondance: Correspondance,
): ClasseDetectee {
  const colonne = correspondance.classe;

  if (colonne !== undefined) {
    const valeurs = new Set<string>();
    for (const ligne of tableau.lignes) {
      const valeur = (ligne[colonne] ?? "").trim();
      if (valeur !== "") valeurs.add(valeur);
    }

    if (valeurs.size === 1) {
      return { nom: [...valeurs][0]!, source: "colonne", multiples: [...valeurs] };
    }
    if (valeurs.size > 1) {
      return { nom: null, source: "colonne", multiples: [...valeurs].sort() };
    }
  }

  const depuisNom = classeDepuisNomDeFichier(nomFichier);
  if (depuisNom !== null) {
    return { nom: depuisNom, source: "fichier", multiples: [depuisNom] };
  }

  return { nom: null, source: "inconnue", multiples: [] };
}

/**
 * Tire un nom de classe d'un nom de fichier.
 *
 * Volontairement prudent : on ne retient que ce qui ressemble vraiment à une
 * classe — « 2nde4 », « 2DE 4 », « Terminale S1 », « 1ère B ». Un fichier
 * nommé « liste », « eleves » ou « rentree 2026 » ne produit rien, et
 * l'assistant demandera.
 */
export function classeDepuisNomDeFichier(nom: string): string | null {
  const base = nom.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const plat = aplatir(base);

  const generiques = ["liste", "eleves", "classe", "import", "fichier", "rentree", "feuille"];
  if (generiques.includes(plat)) return null;

  const motifs = [
    /\b((?:2nde|2de|seconde)\s*[a-z0-9]{1,3})\b/i,
    /\b((?:1ere|1re|1ère|premiere|première)\s*[a-z0-9]{1,3})\b/i,
    /\b((?:tle|term|terminale)\s*[a-z0-9]{1,3})\b/i,
    /\b([0-9]\s?(?:nde|ere|ère|re|de)\s*[a-z0-9]{1,3})\b/i,
  ];

  for (const motif of motifs) {
    const trouve = motif.exec(base);
    if (trouve !== null) return trouve[1]!.replace(/\s+/g, " ").trim();
  }

  // Un nom court et sans mot générique est pris tel quel : « 2A », « TS2 ».
  if (/^[a-z0-9 ]{2,12}$/i.test(base) && /\d/.test(base)) return base;

  return null;
}

/**
 * Forme comparable d'un nom de classe.
 *
 * « 2nde 4 », « 2DE4 » et « Seconde 4 » se rejoignent ici, sans que la valeur
 * affichée change. C'est ce qui évite de créer trois classes pour une.
 */
export function classeNormalisee(nom: string): string {
  // Les espaces partent d'abord. Sans cela, « 2DE4 » échappe à la règle : une
  // limite de mot ne s'applique pas entre « 2de » et « 4 », et l'on se
  // retrouve avec deux classes là où il n'y en a qu'une.
  const plat = aplatir(nom).replace(/\s+/g, "");

  // Du plus long au plus court : « term » couperait « terminale » en deux.
  return plat
    .replace(/^(seconde|2nde|2de)/, "2")
    .replace(/^(premiere|1ere|1re)/, "1")
    .replace(/^(terminale|term|tle)/, "t");
}

/* -------------------------------------------------------------------------- */
/* Lignes analysées                                                           */
/* -------------------------------------------------------------------------- */

export type GraviteAnomalie = "bloquante" | "avertissement";

export interface Anomalie {
  readonly code:
    | "nom_manquant"
    | "prenom_manquant"
    | "classe_manquante"
    | "email_invalide"
    | "doublon_fichier"
    | "homonyme"
    | "mot_de_passe_dans_le_fichier";
  readonly gravite: GraviteAnomalie;
  readonly message: string;
}

export interface LigneEleve {
  readonly fichier: string;
  readonly numero: number;
  readonly nom: string;
  readonly prenom: string;
  readonly classe: string;
  readonly email: string | null;
  readonly identifiantExterne: string | null;
  readonly anomalies: readonly Anomalie[];
}

export interface FichierAnalyse {
  readonly nom: string;
  readonly octets: number;
  readonly colonnes: readonly ColonneReconnue[];
  readonly correspondance: Correspondance;
  readonly classe: ClasseDetectee;
  readonly lignes: readonly LigneEleve[];
  /** Erreur de lecture : le fichier est rejeté, les autres continuent (§5.1). */
  readonly erreur: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Intitulés qui n'ont rien à faire dans un fichier de rentrée (ch. 11). */
const INTERDITS = ["mot de passe", "mdp", "password", "pass", "secret"];

/**
 * Analyse un fichier déjà lu.
 *
 * `classeImposee` vient de l'administrateur quand il a corrigé la détection.
 * Elle l'emporte sur tout le reste — c'est lui qui connaît son lycée.
 */
export function analyserFichier(options: {
  nom: string;
  octets: number;
  tableau: Tableau;
  correspondance?: Correspondance;
  classeImposee?: string | null;
}): FichierAnalyse {
  const colonnes = reconnaitreColonnes(options.tableau, [
    "nom",
    "prenom",
    "classe",
    "email",
    "identifiantExterne",
  ]);
  const correspondance = options.correspondance ?? correspondanceDepuis(colonnes);
  const classe = options.classeImposee
    ? { nom: options.classeImposee, source: "saisie" as const, multiples: [options.classeImposee] }
    : detecterClasse(options.nom, options.tableau, correspondance);

  const interdite = colonnes.find((colonne) =>
    INTERDITS.some((mot) => aplatir(colonne.entete).includes(mot)),
  );

  const lignes: LigneEleve[] = [];
  const vues = new Map<string, number>();

  options.tableau.lignes.forEach((brute, index) => {
    const numero = index + 2; // en-tête en ligne 1
    const cellule = (champ: Champ) => {
      const colonne = correspondance[champ];
      return colonne === undefined ? "" : (brute[colonne] ?? "").trim();
    };

    const nom = cellule("nom");
    const prenom = cellule("prenom");
    const classeLigne = cellule("classe") || classe.nom || "";
    const email = cellule("email");
    const identifiant = cellule("identifiantExterne");

    // Une ligne entièrement vide n'est pas une erreur : c'est la fin du
    // tableau, ou une ligne de séparation. On la passe.
    if (nom === "" && prenom === "" && classeLigne === "" && email === "") return;

    const anomalies: Anomalie[] = [];

    if (interdite !== undefined) {
      anomalies.push({
        code: "mot_de_passe_dans_le_fichier",
        gravite: "bloquante",
        message: `La colonne « ${interdite.entete} » ressemble à un mot de passe. AvecStudy n'en accepte aucun dans un fichier.`,
      });
    }
    if (nom === "") {
      anomalies.push({ code: "nom_manquant", gravite: "bloquante", message: "Nom absent." });
    }
    if (prenom === "") {
      anomalies.push({ code: "prenom_manquant", gravite: "bloquante", message: "Prénom absent." });
    }
    if (classeLigne === "") {
      anomalies.push({
        code: "classe_manquante",
        gravite: "bloquante",
        message: "Aucune classe pour cette ligne.",
      });
    }
    if (email !== "" && !EMAIL.test(email)) {
      anomalies.push({
        code: "email_invalide",
        gravite: "avertissement",
        message: `« ${email} » n'est pas une adresse valide : elle sera ignorée.`,
      });
    }

    // Doublon strict à l'intérieur du fichier : même nom, prénom et classe.
    // C'est le seul rapprochement automatique, et il reste un avertissement.
    const cle = `${aplatir(nom)}|${aplatir(prenom)}|${classeNormalisee(classeLigne)}`;
    const deja = vues.get(cle);
    if (deja !== undefined) {
      anomalies.push({
        code: "doublon_fichier",
        gravite: "avertissement",
        message: `Ligne identique à la ligne ${deja} du même fichier.`,
      });
    } else {
      vues.set(cle, numero);
    }

    lignes.push({
      fichier: options.nom,
      numero,
      nom,
      prenom,
      classe: classeLigne,
      email: email !== "" && EMAIL.test(email) ? email : null,
      identifiantExterne: identifiant === "" ? null : identifiant,
      anomalies,
    });
  });

  return {
    nom: options.nom,
    octets: options.octets,
    colonnes,
    correspondance,
    classe,
    lignes,
    erreur: null,
  };
}

/** Un fichier illisible : rejeté seul, sans faire tomber le lot (§5.1). */
export function fichierRejete(nom: string, octets: number, erreur: string): FichierAnalyse {
  return {
    nom,
    octets,
    colonnes: [],
    correspondance: {},
    classe: { nom: null, source: "inconnue", multiples: [] },
    lignes: [],
    erreur,
  };
}

/* -------------------------------------------------------------------------- */
/* Le plan complet                                                            */
/* -------------------------------------------------------------------------- */

export interface ClassePrevue {
  readonly nom: string;
  readonly normalisee: string;
  readonly effectif: number;
  readonly fichiers: readonly string[];
}

export interface PlanImport {
  readonly fichiers: readonly FichierAnalyse[];
  readonly classes: readonly ClassePrevue[];
  readonly lignes: readonly LigneEleve[];
  readonly compte: {
    readonly fichiersLus: number;
    readonly fichiersRejetes: number;
    readonly lignesLues: number;
    readonly valides: number;
    readonly avertissements: number;
    readonly bloquantes: number;
  };
  /** Ce qui empêche de valider. Vide, le bouton « Créer » s'ouvre (§5.5). */
  readonly blocages: readonly string[];
}

/**
 * Assemble le plan à partir des fichiers analysés.
 *
 * C'est ici que se font les rapprochements **entre** fichiers : deux classes
 * écrites différemment dans deux fichiers n'en font qu'une, et un élève présent
 * dans deux fichiers de la même classe est signalé.
 */
export function construirePlan(fichiers: readonly FichierAnalyse[]): PlanImport {
  const lignes = fichiers.flatMap((fichier) => fichier.lignes);

  // Regroupement des classes sur leur forme comparable, en gardant le premier
  // libellé rencontré comme nom affiché.
  const parClasse = new Map<string, { nom: string; effectif: number; fichiers: Set<string> }>();
  for (const ligne of lignes) {
    if (ligne.classe === "") continue;
    const cle = classeNormalisee(ligne.classe);
    const entree = parClasse.get(cle);
    if (entree === undefined) {
      parClasse.set(cle, { nom: ligne.classe, effectif: 1, fichiers: new Set([ligne.fichier]) });
    } else {
      entree.effectif += 1;
      entree.fichiers.add(ligne.fichier);
    }
  }

  // Homonymes : même nom et prénom dans la même classe, lignes différentes.
  // Signalés, jamais fusionnés — c'est la règle du §5.4.
  const parIdentite = new Map<string, LigneEleve[]>();
  for (const ligne of lignes) {
    const cle = `${aplatir(ligne.nom)}|${aplatir(ligne.prenom)}|${classeNormalisee(ligne.classe)}`;
    parIdentite.set(cle, [...(parIdentite.get(cle) ?? []), ligne]);
  }

  const avecHomonymes = lignes.map((ligne) => {
    const cle = `${aplatir(ligne.nom)}|${aplatir(ligne.prenom)}|${classeNormalisee(ligne.classe)}`;
    const groupe = parIdentite.get(cle) ?? [];
    const deuxFichiers = new Set(groupe.map((autre) => autre.fichier)).size > 1;

    if (groupe.length > 1 && deuxFichiers) {
      return {
        ...ligne,
        anomalies: [
          ...ligne.anomalies,
          {
            code: "homonyme" as const,
            gravite: "avertissement" as const,
            message:
              "Même nom, prénom et classe dans un autre fichier. Deux personnes distinctes ou un doublon : à vous de trancher.",
          },
        ],
      };
    }
    return ligne;
  });

  const bloquantes = avecHomonymes.filter((ligne) =>
    ligne.anomalies.some((anomalie) => anomalie.gravite === "bloquante"),
  );
  const avertissements = avecHomonymes.filter(
    (ligne) =>
      ligne.anomalies.length > 0 &&
      !ligne.anomalies.some((anomalie) => anomalie.gravite === "bloquante"),
  );

  const blocages: string[] = [];

  for (const fichier of fichiers) {
    if (fichier.erreur !== null) continue;

    if (fichier.correspondance.nom === undefined || fichier.correspondance.prenom === undefined) {
      blocages.push(`${fichier.nom} : indiquez quelles colonnes portent le nom et le prénom.`);
    }
    if (fichier.classe.nom === null && fichier.classe.multiples.length === 0) {
      blocages.push(`${fichier.nom} : aucune classe détectée, indiquez-la.`);
    }
  }

  if (bloquantes.length > 0) {
    blocages.push(
      `${bloquantes.length} ligne${bloquantes.length > 1 ? "s" : ""} à corriger avant de créer les comptes.`,
    );
  }

  if (avecHomonymes.length === 0 && fichiers.some((fichier) => fichier.erreur === null)) {
    blocages.push("Aucun élève n'a été lu dans ces fichiers.");
  }

  return {
    fichiers,
    lignes: avecHomonymes,
    classes: [...parClasse.entries()]
      .map(([normalisee, entree]) => ({
        nom: entree.nom,
        normalisee,
        effectif: entree.effectif,
        fichiers: [...entree.fichiers],
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    compte: {
      fichiersLus: fichiers.filter((fichier) => fichier.erreur === null).length,
      fichiersRejetes: fichiers.filter((fichier) => fichier.erreur !== null).length,
      lignesLues: avecHomonymes.length,
      valides: avecHomonymes.length - bloquantes.length,
      avertissements: avertissements.length,
      bloquantes: bloquantes.length,
    },
    blocages,
  };
}

/**
 * Attribue un identifiant à chaque ligne retenue.
 *
 * `pris` contient les identifiants déjà en base : la collision se résout par
 * un suffixe, et deux homonymes reçoivent donc deux identifiants distincts.
 */
export function attribuerIdentifiants(
  lignes: readonly LigneEleve[],
  pris: ReadonlySet<string>,
): { ligne: LigneEleve; login: string }[] {
  const occupes = new Set(pris);

  return lignes
    .filter((ligne) => !ligne.anomalies.some((anomalie) => anomalie.gravite === "bloquante"))
    .map((ligne) => {
      const login = proposerLogin(ligne.prenom, ligne.nom, occupes);
      occupes.add(login);
      return { ligne, login };
    });
}

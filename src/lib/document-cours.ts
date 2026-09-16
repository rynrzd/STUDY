/**
 * Le document de cours structuré — cahier « Refonte fidèle », T01 et S06.
 *
 * Un seul modèle pour tout le monde : l'éditeur du professeur, la vue de
 * l'élève, la projection et le PDF lisent ce même objet. C'est la seule façon
 * d'éviter qu'un cours s'affiche différemment selon l'endroit — et de garantir
 * que « prévisualiser » dise la vérité.
 *
 * Deux règles tiennent la fidélité du contenu (S10) :
 *
 *  1. **Rien n'est jamais reformulé.** Les blocs portent le texte tel qu'il a
 *     été extrait. Changer de modèle visuel change la présentation, jamais la
 *     chaîne de caractères. Un cours de mathématiques dont on « améliore » une
 *     formule est un cours faux.
 *  2. **Ce qui n'a pas été compris est conservé, pas jeté.** Un fragment non
 *     reconnu devient un bloc `brut` accompagné d'une alerte, plutôt que de
 *     disparaître en silence. Perdre trois lignes sans le dire est pire que de
 *     mal les présenter.
 *
 * Ce module ne dépend d'aucune bibliothèque et ne touche ni au réseau ni à la
 * base : il se teste directement.
 */

export const VERSION_DOCUMENT = 1;

export type NiveauTitre = 1 | 2 | 3;

/** D'où vient un bloc dans l'original, pour pouvoir y retourner (S11). */
export interface Origine {
  readonly page: number;
}

export type BlocCours =
  | { readonly type: "titre"; readonly niveau: NiveauTitre; readonly texte: string; readonly origine?: Origine }
  | { readonly type: "paragraphe"; readonly texte: string; readonly origine?: Origine }
  | {
      readonly type: "liste";
      readonly ordonnee: boolean;
      readonly elements: readonly string[];
      readonly origine?: Origine;
    }
  | {
      readonly type: "tableau";
      readonly entetes: readonly string[];
      readonly lignes: readonly (readonly string[])[];
      readonly origine?: Origine;
    }
  | {
      readonly type: "encadre";
      /** « Définition », « Propriété », « Théorème »… */
      readonly intitule: string;
      readonly texte: string;
      readonly origine?: Origine;
    }
  | {
      readonly type: "image";
      readonly fileId: string | null;
      readonly alt: string;
      readonly legende?: string;
      readonly origine?: Origine;
    }
  | {
      /** Fragment conservé tel quel, faute d'avoir été reconnu. */
      readonly type: "brut";
      readonly texte: string;
      readonly origine?: Origine;
    };

export type GraviteAlerte = "information" | "verifier";

export interface AlerteConversion {
  readonly gravite: GraviteAlerte;
  readonly message: string;
  readonly page?: number;
}

export interface RapportConversion {
  readonly pagesLues: number;
  readonly blocsExtraits: number;
  readonly imagesConservees: number;
  readonly alertes: readonly AlerteConversion[];
}

export type Modele = "classique" | "fiche" | "aere";

export interface ReglagesPresentation {
  readonly modele: Modele;
  /** Facteur appliqué à la taille de lecture : 0,9 à 1,4. */
  readonly taille: number;
  /** Interligne : 1,4 à 2. */
  readonly interligne: number;
  readonly numerosDePage: boolean;
  readonly sommaire: boolean;
}

export const REGLAGES_PAR_DEFAUT: ReglagesPresentation = {
  modele: "classique",
  taille: 1,
  interligne: 1.6,
  numerosDePage: true,
  sommaire: false,
};

export interface DocumentCours {
  readonly version: number;
  readonly titre: string;
  readonly blocs: readonly BlocCours[];
  readonly format: "pdf" | "docx";
  readonly rapport: RapportConversion;
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                    */
/* -------------------------------------------------------------------------- */

/** Le texte d'un bloc, pour compter et comparer. Jamais pour ré-afficher. */
export function texteDuBloc(bloc: BlocCours): string {
  switch (bloc.type) {
    case "titre":
    case "paragraphe":
    case "brut":
      return bloc.texte;
    case "encadre":
      return `${bloc.intitule}\n${bloc.texte}`;
    case "liste":
      return bloc.elements.join("\n");
    case "tableau":
      return [bloc.entetes, ...bloc.lignes].map((ligne) => ligne.join("\t")).join("\n");
    case "image":
      return bloc.legende ?? "";
  }
}

/**
 * Le texte complet, normalisé pour comparaison.
 *
 * Sert au contrôle de fidélité : si le texte d'avant et celui d'après un
 * changement de modèle diffèrent, c'est que la présentation a mangé du
 * contenu. Un test le vérifie.
 */
export function texteIntegral(document: DocumentCours): string {
  return document.blocs
    .map(texteDuBloc)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Les titres, pour le sommaire (S09). */
export function sommaire(document: DocumentCours): { niveau: NiveauTitre; texte: string; index: number }[] {
  const entrees: { niveau: NiveauTitre; texte: string; index: number }[] = [];
  document.blocs.forEach((bloc, index) => {
    if (bloc.type === "titre") entrees.push({ niveau: bloc.niveau, texte: bloc.texte, index });
  });
  return entrees;
}

/** Les alertes qui demandent une vérification humaine, et elles seules. */
export function alertesBloquantes(rapport: RapportConversion): readonly AlerteConversion[] {
  return rapport.alertes.filter((alerte) => alerte.gravite === "verifier");
}

/* -------------------------------------------------------------------------- */
/* Écriture                                                                   */
/* -------------------------------------------------------------------------- */

/** Remplace un bloc, sans toucher aux autres. */
export function remplacerBloc(
  document: DocumentCours,
  index: number,
  bloc: BlocCours,
): DocumentCours {
  if (index < 0 || index >= document.blocs.length) return document;
  const blocs = [...document.blocs];
  blocs[index] = bloc;
  return { ...document, blocs };
}

export function supprimerBloc(document: DocumentCours, index: number): DocumentCours {
  if (index < 0 || index >= document.blocs.length) return document;
  return { ...document, blocs: document.blocs.filter((_, i) => i !== index) };
}

/**
 * Déplace un bloc d'un cran.
 *
 * Volontairement par pas de un, et déclenché par un bouton : le
 * glisser-déposer seul exclut le clavier et les lecteurs d'écran (P07).
 */
export function deplacerBloc(
  document: DocumentCours,
  index: number,
  sens: "haut" | "bas",
): DocumentCours {
  const cible = sens === "haut" ? index - 1 : index + 1;
  if (index < 0 || index >= document.blocs.length) return document;
  if (cible < 0 || cible >= document.blocs.length) return document;

  const blocs = [...document.blocs];
  const tampon = blocs[index]!;
  blocs[index] = blocs[cible]!;
  blocs[cible] = tampon;
  return { ...document, blocs };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Relit un document venu de la base.
 *
 * Le JSON stocké a pu être écrit par une version antérieure, ou abîmé. Plutôt
 * que de faire confiance à un `as DocumentCours`, on vérifie la forme et on
 * écarte ce qui ne tient pas — un bloc illisible ne doit pas faire tomber la
 * page entière du professeur.
 */
export function relireDocument(valeur: unknown): DocumentCours | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const brut = valeur as Record<string, unknown>;

  if (typeof brut.titre !== "string" || !Array.isArray(brut.blocs)) return null;
  if (brut.format !== "pdf" && brut.format !== "docx") return null;

  const blocs = brut.blocs.filter(estBloc);
  const rapport = brut.rapport as RapportConversion | undefined;

  return {
    version: typeof brut.version === "number" ? brut.version : VERSION_DOCUMENT,
    titre: brut.titre,
    blocs,
    format: brut.format,
    rapport: {
      pagesLues: rapport?.pagesLues ?? 0,
      blocsExtraits: rapport?.blocsExtraits ?? blocs.length,
      imagesConservees: rapport?.imagesConservees ?? 0,
      alertes: Array.isArray(rapport?.alertes) ? rapport.alertes : [],
    },
  };
}

function estBloc(valeur: unknown): valeur is BlocCours {
  if (typeof valeur !== "object" || valeur === null) return false;
  const bloc = valeur as Record<string, unknown>;

  switch (bloc.type) {
    case "titre":
      return typeof bloc.texte === "string" && [1, 2, 3].includes(bloc.niveau as number);
    case "paragraphe":
    case "brut":
      return typeof bloc.texte === "string";
    case "encadre":
      return typeof bloc.texte === "string" && typeof bloc.intitule === "string";
    case "liste":
      return Array.isArray(bloc.elements) && bloc.elements.every((e) => typeof e === "string");
    case "tableau":
      return Array.isArray(bloc.entetes) && Array.isArray(bloc.lignes);
    case "image":
      return typeof bloc.alt === "string";
    default:
      return false;
  }
}

/** Bornes des réglages : une valeur hors plage est ramenée, pas refusée. */
export function relireReglages(valeur: unknown): ReglagesPresentation {
  const brut = (typeof valeur === "object" && valeur !== null ? valeur : {}) as Record<string, unknown>;
  const modele = brut.modele;

  return {
    modele: modele === "fiche" || modele === "aere" ? modele : "classique",
    taille: borner(brut.taille, 0.9, 1.4, 1),
    interligne: borner(brut.interligne, 1.4, 2, 1.6),
    numerosDePage: brut.numerosDePage !== false,
    sommaire: brut.sommaire === true,
  };
}

function borner(valeur: unknown, min: number, max: number, defaut: number): number {
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  if (!Number.isFinite(nombre)) return defaut;
  return Math.min(max, Math.max(min, nombre));
}

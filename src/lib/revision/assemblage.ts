/**
 * Assemblage d'une fiche de révision — dossier Study V6, §8.1.
 *
 * Décision du 5 octobre 2026 : aucun fournisseur d'IA. Une fiche est donc
 * construite **uniquement** à partir des passages des séances choisies :
 *
 *  - chaque texte de la fiche est un extrait, recopié tel quel, avec sa
 *    référence (séance, passage, page) ;
 *  - rien n'est reformulé, résumé par un modèle, ni complété ;
 *  - quand les sources ne suffisent pas, la fiche demande une clarification
 *    (`needs_review`) au lieu d'inventer.
 *
 * Les seules phrases écrites par Study sont des intitulés et des consignes
 * (« Sais-tu expliquer… ? ») : elles ne prétendent rien sur le cours.
 *
 * Ce module ne touche ni au réseau ni à la base : il se teste directement.
 */

export type FormatFiche = "essentiel" | "detaille" | "cartes" | "quiz" | "controle";

export interface Passage {
  readonly ordre: number;
  readonly ref: string;
  readonly page: number | null;
  readonly kind: string;
  readonly texte: string;
}

export interface SourceAssemblage {
  readonly lessonId: string;
  readonly titre: string | null;
  readonly lisible: boolean;
  readonly passages: readonly Passage[];
  readonly exercices: readonly string[] | null;
}

export interface Citation {
  readonly lessonId: string;
  readonly ref: string;
  readonly page: number | null;
}

export interface Extrait {
  readonly texte: string;
  readonly citation: Citation;
}

export interface Section {
  readonly titre: string;
  /** Rôle de la section, pour la mise en page : jamais affiché comme une vérité. */
  readonly role: "notions" | "methode" | "attention" | "verification" | "contenu";
  readonly extraits: readonly Extrait[];
}

export interface Carte {
  readonly recto: string;
  readonly verso: string;
  readonly citation: Citation;
}

export interface Limite {
  readonly code: "SOURCE_RETIREE" | "SOURCE_SANS_TEXTE" | "LONGUEUR_ATTEINTE" | "PAS_D_EXERCICE" | "TROP_PEU_DE_CARTES";
  readonly message: string;
  readonly lessonId?: string;
}

export interface Assemblage {
  readonly etat: "ready" | "needs_review";
  readonly sections: readonly Section[];
  readonly cartes: readonly Carte[];
  readonly exercices: readonly string[];
  readonly limites: readonly Limite[];
}

export const GENERATEUR_VERSION = "assemblage-1";

/** Plafonds du dossier : 600 mots pour une fiche courte, 1 500 pour une détaillée. */
export function plafondMots(longueur: "courte" | "detaillee"): number {
  return longueur === "courte" ? 600 : 1500;
}

export function compterMots(texte: string): number {
  const t = texte.trim();
  return t === "" ? 0 : t.split(/\s+/u).length;
}

const DEFINITION = /\b(on (dit|appelle)|est appel[ée]e?s?|d[ée]finition|se d[ée]finit|signifie|propri[ée]t[ée]|th[ée]or[èe]me|on note)\b/iu;
const ATTENTION = /\b(attention|pi[èe]ge|ne pas confondre|erreur fr[ée]quente|remarque)\b/iu;
const METHODE = /\b(m[ée]thode|pour (calculer|d[ée]terminer|trouver|lire|r[ée]soudre)|on proc[èe]de|[ée]tapes?)\b/iu;

/**
 * La première phrase d'un paragraphe, recopiée telle quelle. On coupe sur un
 * point suivi d'un espace et d'une majuscule, jamais au milieu d'une formule
 * comme « f(3) = 2 × 3 + 1 = 7. » qui contient elle-même des points.
 */
export function premierePhrase(texte: string): string {
  const propre = texte.trim();
  const coupe = /[.!?…](?=\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ«])/u.exec(propre);
  return coupe === null ? propre : propre.slice(0, coupe.index + 1);
}

interface Bloc {
  readonly titre: string;
  readonly passages: Passage[];
}

/** Regroupe les passages sous le titre qui les précède. */
function parTitre(source: SourceAssemblage): Bloc[] {
  const blocs: Bloc[] = [];
  let courant: Bloc = { titre: source.titre ?? "Séance", passages: [] };
  for (const passage of [...source.passages].sort((a, b) => a.ordre - b.ordre)) {
    if (passage.kind === "titre") {
      if (courant.passages.length > 0) blocs.push(courant);
      courant = { titre: passage.texte.trim(), passages: [] };
    } else {
      courant.passages.push(passage);
    }
  }
  if (courant.passages.length > 0) blocs.push(courant);
  return blocs;
}

function citation(source: SourceAssemblage, passage: Passage): Citation {
  return { lessonId: source.lessonId, ref: passage.ref, page: passage.page };
}

function utile(passage: Passage): boolean {
  return passage.kind !== "lien" && passage.kind !== "image" && compterMots(passage.texte) >= 3;
}

export function assembler(options: {
  readonly format: FormatFiche;
  readonly objectif: "essentiel" | "comprendre";
  readonly longueur: "courte" | "detaillee";
  readonly sources: readonly SourceAssemblage[];
}): Assemblage {
  const limites: Limite[] = [];
  const lisibles: SourceAssemblage[] = [];

  for (const source of options.sources) {
    if (!source.lisible) {
      limites.push({
        code: "SOURCE_RETIREE",
        lessonId: source.lessonId,
        message: "Une séance choisie n'est plus accessible : elle n'a pas été utilisée.",
      });
    } else if (!source.passages.some(utile)) {
      limites.push({
        code: "SOURCE_SANS_TEXTE",
        lessonId: source.lessonId,
        message: `« ${source.titre ?? "Séance"} » ne contient pas de texte lisible (document numérisé, image ou séance vide). Rien n'a été inventé à sa place.`,
      });
    } else {
      lisibles.push(source);
    }
  }

  const exercices = lisibles.flatMap((s) => s.exercices ?? []);

  if (options.format === "quiz") {
    if (exercices.length === 0) {
      limites.push({
        code: "PAS_D_EXERCICE",
        message: "Aucun exercice n'a été publié par le professeur pour ces séances. Study ne fabrique pas de questions : choisis d'autres séances ou demande des exercices.",
      });
      return { etat: "needs_review", sections: [], cartes: [], exercices: [], limites };
    }
    return { etat: "ready", sections: [], cartes: [], exercices: dedoublonner(exercices).slice(0, 40), limites };
  }

  if (lisibles.length === 0) {
    return { etat: "needs_review", sections: [], cartes: [], exercices: [], limites };
  }

  if (options.format === "cartes") {
    const cartes = construireCartes(lisibles);
    if (cartes.length < 2) {
      limites.push({
        code: "TROP_PEU_DE_CARTES",
        message: "Les séances choisies n'ont pas assez de titres ou de définitions pour faire des cartes fidèles. Ajoute une séance ou choisis « L'essentiel ».",
      });
      return { etat: "needs_review", sections: [], cartes, exercices: [], limites };
    }
    return { etat: "ready", sections: [], cartes: cartes.slice(0, 40), exercices: [], limites };
  }

  const detaille = options.format === "detaille" || options.objectif === "comprendre";
  const plafond = plafondMots(options.format === "detaille" ? "detaillee" : options.longueur);
  const sections = construireSections(lisibles, { detaille, plafond, limites });

  if (options.format === "controle") {
    const questions: Extrait[] = lisibles.flatMap((source) =>
      parTitre(source)
        .filter((bloc) => bloc.titre !== (source.titre ?? "Séance"))
        .map((bloc) => ({
          texte: `Sais-tu expliquer « ${bloc.titre} » sans regarder le cours ?`,
          citation: citation(source, bloc.passages[0]!),
        })),
    );
    if (questions.length > 0) {
      sections.push({ titre: "Avant le contrôle, vérifie que…", role: "verification", extraits: questions.slice(0, 12) });
    }
    if (exercices.length === 0) {
      limites.push({
        code: "PAS_D_EXERCICE",
        message: "Pas d'exercice publié pour ces séances : la préparation s'appuie sur le cours seulement.",
      });
    }
  }

  const etat = sections.some((s) => s.extraits.length > 0) ? "ready" : "needs_review";
  return {
    etat,
    sections,
    cartes: [],
    exercices: options.format === "controle" ? dedoublonner(exercices).slice(0, 20) : [],
    limites,
  };
}

function construireSections(
  sources: readonly SourceAssemblage[],
  options: { detaille: boolean; plafond: number; limites: Limite[] },
): Section[] {
  const notions: Extrait[] = [];
  const methode: Extrait[] = [];
  const attention: Extrait[] = [];
  const contenu: { titre: string; extraits: Extrait[] }[] = [];

  for (const source of sources) {
    for (const bloc of parTitre(source)) {
      const reste: Extrait[] = [];
      for (const passage of bloc.passages.filter(utile)) {
        const texte = options.detaille ? passage.texte.trim() : premierePhrase(passage.texte);
        const extrait = { texte, citation: citation(source, passage) };
        if (passage.kind === "encadre" || DEFINITION.test(passage.texte)) notions.push({ ...extrait, texte: passage.texte.trim() });
        else if (ATTENTION.test(passage.texte)) attention.push(extrait);
        else if (METHODE.test(passage.texte) || passage.kind === "liste") methode.push(extrait);
        else if (passage.kind !== "exercice") reste.push(extrait);
      }
      if (reste.length > 0) contenu.push({ titre: bloc.titre, extraits: reste });
    }
  }

  // Ordre de priorité : définitions, méthodes, points d'attention, puis le reste.
  const ordonnees: Section[] = [];
  let budget = options.plafond;
  let tronque = false;

  const prendre = (titre: string, role: Section["role"], extraits: readonly Extrait[]) => {
    const retenus: Extrait[] = [];
    for (const extrait of extraits) {
      const mots = compterMots(extrait.texte);
      if (mots > budget) {
        tronque = true;
        continue;
      }
      budget -= mots;
      retenus.push(extrait);
    }
    if (retenus.length > 0) ordonnees.push({ titre, role, extraits: retenus });
  };

  prendre("Les notions", "notions", notions);
  prendre("La méthode", "methode", methode);
  prendre("Points d'attention", "attention", attention);
  for (const bloc of contenu) prendre(bloc.titre, "contenu", bloc.extraits);

  if (tronque) {
    options.limites.push({
      code: "LONGUEUR_ATTEINTE",
      message: `La fiche est limitée à ${options.plafond} mots : certains passages n'y figurent pas. Ils restent dans le cours.`,
    });
  }
  return ordonnees;
}

function construireCartes(sources: readonly SourceAssemblage[]): Carte[] {
  const cartes: Carte[] = [];
  for (const source of sources) {
    for (const passage of source.passages) {
      if (passage.kind === "encadre") {
        const [intitule, ...reste] = passage.texte.split(" : ");
        const verso = reste.join(" : ").trim();
        if (intitule && verso.length > 0) {
          cartes.push({ recto: `${intitule.trim()} — que dit le cours ?`, verso, citation: citation(source, passage) });
        }
      }
    }
    for (const bloc of parTitre(source)) {
      const premier = bloc.passages.find(utile);
      if (bloc.titre !== (source.titre ?? "Séance") && premier !== undefined) {
        cartes.push({ recto: bloc.titre, verso: premierePhrase(premier.texte), citation: citation(source, premier) });
      }
    }
    for (const passage of source.passages.filter(utile)) {
      if (passage.kind !== "encadre" && DEFINITION.test(passage.texte)) {
        const phrase = premierePhrase(passage.texte);
        if (!cartes.some((c) => c.verso === phrase)) {
          cartes.push({ recto: "Complète la définition vue en cours", verso: phrase, citation: citation(source, passage) });
        }
      }
    }
  }
  return cartes;
}

function dedoublonner<T>(valeurs: readonly T[]): T[] {
  return [...new Set(valeurs)];
}

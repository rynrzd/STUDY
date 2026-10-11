/**
 * Tirage du sujet d'une évaluation, élève par élève — pur, testé.
 *
 * Trois leviers contre la copie entre voisins, tous optionnels :
 * l'ordre des questions, l'ordre des choix, et des valeurs numériques tirées
 * pour chaque élève. Un énoncé peut contenir des expressions entre accolades
 * — `f(x) = {a}x + {b}`, `{2*a+b}` — évaluées avec les valeurs tirées par un
 * petit analyseur arithmétique (jamais `eval`). L'attendu concret de chaque
 * copie est calculé ici, puis stocké côté serveur ; l'élève ne le reçoit pas.
 */

export type GenreQuestion = "qcm" | "qcm_multiple" | "vrai_faux" | "numerique" | "courte" | "redigee";

export const GENRES_QUESTION: readonly GenreQuestion[] = ["qcm", "qcm_multiple", "vrai_faux", "numerique", "courte", "redigee"];

export const LIBELLES_GENRE: Readonly<Record<GenreQuestion, string>> = {
  qcm: "QCM (une réponse)",
  qcm_multiple: "QCM (plusieurs réponses)",
  vrai_faux: "Vrai ou faux",
  numerique: "Réponse numérique",
  courte: "Réponse courte",
  redigee: "Réponse rédigée",
};

/** Ce qui se corrige sans le professeur. */
export const CORRECTION_AUTOMATIQUE: ReadonlySet<GenreQuestion> = new Set(["qcm", "qcm_multiple", "vrai_faux", "numerique", "courte"]);

export interface Parametre {
  readonly min: number;
  readonly max: number;
  /** Exclure 0 du tirage (un coefficient nul change la question). */
  readonly nonNul?: boolean;
}

export interface QuestionModele {
  readonly id: string;
  readonly kind: GenreQuestion;
  readonly enonce: string;
  readonly choix: readonly string[] | null;
  readonly points: number;
  readonly parametres: Readonly<Record<string, Parametre>> | null;
}

export interface Corrige {
  readonly index?: number;
  readonly indices?: readonly number[];
  readonly vrai?: boolean;
  readonly valeur?: number;
  readonly formule?: string;
  readonly tolerance?: number;
  readonly acceptees?: readonly string[];
}

export interface ElementSujet {
  readonly question_id: string;
  readonly ordre: number;
  readonly kind: GenreQuestion;
  readonly enonce: string;
  readonly choix: string[] | null;
  readonly points: number;
}

export interface Attendu {
  readonly question_id: string;
  readonly attendu: Record<string, unknown>;
  /** Choix affiché i → index d'origine (analyse des distracteurs). */
  readonly permutation: number[] | null;
}

/* -------------------------------------------------------------------------- */
/* Expressions arithmétiques                                                    */
/* -------------------------------------------------------------------------- */

const FONCTIONS: Readonly<Record<string, (x: number) => number>> = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round };

/**
 * Évalue une expression : nombres (virgule ou point), variables, + − × ÷ ^,
 * parenthèses, sqrt, abs, round. Toute autre chose est refusée.
 */
export function evaluerExpression(source: string, valeurs: Readonly<Record<string, number>> = {}): number {
  const s = source.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  let i = 0;
  const espaces = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++;
  };
  const erreur = (m: string): never => {
    throw new Error(`Expression invalide (${m}) : ${source}`);
  };

  const primaire = (): number => {
    espaces();
    const c = s[i];
    if (c === "(") {
      i++;
      const v = somme();
      espaces();
      if (s[i] !== ")") erreur("parenthèse fermante attendue");
      i++;
      return v;
    }
    const nombre = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (nombre) {
      i += nombre[0].length;
      return Number(nombre[0].replace(",", "."));
    }
    const nom = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
    if (nom) {
      i += nom[0].length;
      const f = FONCTIONS[nom[0]];
      if (f) {
        espaces();
        if (s[i] !== "(") erreur(`parenthèse attendue après ${nom[0]}`);
        return f(primaire());
      }
      if (!(nom[0] in valeurs)) erreur(`variable inconnue « ${nom[0]} »`);
      return valeurs[nom[0]]!;
    }
    return erreur(c === undefined ? "fin inattendue" : `caractère « ${c} »`);
  };
  const unaire = (): number => {
    espaces();
    if (s[i] === "-") {
      i++;
      return -unaire();
    }
    if (s[i] === "+") {
      i++;
      return unaire();
    }
    return puissance();
  };
  const puissance = (): number => {
    const base = primaire();
    espaces();
    if (s[i] === "^") {
      i++;
      return base ** unaire();
    }
    return base;
  };
  const produit = (): number => {
    let v = unaire();
    for (;;) {
      espaces();
      const op = s[i];
      if (op !== "*" && op !== "/") return v;
      i++;
      const d = unaire();
      if (op === "/" && d === 0) erreur("division par zéro");
      v = op === "*" ? v * d : v / d;
    }
  };
  const somme = (): number => {
    let v = produit();
    for (;;) {
      espaces();
      const op = s[i];
      if (op !== "+" && op !== "-") return v;
      i++;
      const d = produit();
      v = op === "+" ? v + d : v - d;
    }
  };

  const resultat = somme();
  espaces();
  if (i < s.length) erreur(`reste « ${s.slice(i)} »`);
  if (!Number.isFinite(resultat)) erreur("résultat non fini");
  return Math.round(resultat * 1e6) / 1e6;
}

/** Un nombre à la française : virgule décimale, sans zéros inutiles. */
export function formaterNombre(n: number): string {
  return String(Math.round(n * 1e4) / 1e4).replace(".", ",").replace(/^-/, "−");
}

/** Remplace chaque {expression} par sa valeur. Sans accolade, le texte est rendu tel quel. */
export function rendreTexte(texte: string, valeurs: Readonly<Record<string, number>>): string {
  return texte.replace(/\{([^{}]+)\}/g, (_tout, expr: string) => formaterNombre(evaluerExpression(expr, valeurs)));
}

/* -------------------------------------------------------------------------- */
/* Hasard                                                                       */
/* -------------------------------------------------------------------------- */

export type Alea = () => number;

/** Générateur reproductible à partir d'une graine (tests, aperçus). */
export function aleaDepuisGraine(graine: string): Alea {
  let h = 1779033703 ^ graine.length;
  for (let k = 0; k < graine.length; k++) {
    h = Math.imul(h ^ graine.charCodeAt(k), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une permutation de 0..n−1 (Fisher-Yates). */
export function permutation(n: number, alea: Alea): number[] {
  const p = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(alea() * (k + 1));
    [p[k], p[j]] = [p[j]!, p[k]!];
  }
  return p;
}

export function tirerValeurs(parametres: Readonly<Record<string, Parametre>> | null, alea: Alea): Record<string, number> {
  const valeurs: Record<string, number> = {};
  for (const [nom, p] of Object.entries(parametres ?? {})) {
    const min = Math.ceil(Math.min(p.min, p.max));
    const max = Math.floor(Math.max(p.min, p.max));
    const possibles = Array.from({ length: max - min + 1 }, (_, k) => min + k).filter((v) => !(p.nonNul && v === 0));
    if (possibles.length === 0) throw new Error(`Paramètre « ${nom} » : aucune valeur possible`);
    valeurs[nom] = possibles[Math.floor(alea() * possibles.length)]!;
  }
  return valeurs;
}

/* -------------------------------------------------------------------------- */
/* Une copie                                                                    */
/* -------------------------------------------------------------------------- */

export function genererCopie(
  questions: readonly QuestionModele[],
  corriges: Readonly<Record<string, Corrige>>,
  options: { readonly melangerQuestions: boolean; readonly melangerChoix: boolean },
  alea: Alea,
): { sujet: ElementSujet[]; attendus: Attendu[] } {
  const ordre = options.melangerQuestions ? permutation(questions.length, alea) : questions.map((_, k) => k);
  const sujet: ElementSujet[] = [];
  const attendus: Attendu[] = [];

  ordre.forEach((indexOrigine, position) => {
    const q = questions[indexOrigine]!;
    const c = corriges[q.id] ?? {};
    const valeurs = tirerValeurs(q.parametres, alea);
    let choix: string[] | null = null;
    let perm: number[] | null = null;
    let attendu: Record<string, unknown> = {};

    if (q.kind === "qcm" || q.kind === "qcm_multiple") {
      const origine = q.choix ?? [];
      perm = options.melangerChoix ? permutation(origine.length, alea) : origine.map((_, k) => k);
      choix = perm.map((k) => rendreTexte(origine[k]!, valeurs));
      attendu =
        q.kind === "qcm"
          ? { index: perm.indexOf(c.index ?? -1) }
          : { indices: (c.indices ?? []).map((k) => perm!.indexOf(k)).sort((x, y) => x - y) };
    } else if (q.kind === "vrai_faux") {
      attendu = { vrai: c.vrai === true };
    } else if (q.kind === "numerique") {
      const valeur = c.formule ? evaluerExpression(c.formule, valeurs) : (c.valeur ?? 0);
      attendu = { valeur, tolerance: c.tolerance ?? 0 };
    } else if (q.kind === "courte") {
      attendu = { acceptees: (c.acceptees ?? []).map((a) => rendreTexte(a, valeurs)) };
    }

    sujet.push({ question_id: q.id, ordre: position + 1, kind: q.kind, enonce: rendreTexte(q.enonce, valeurs), choix, points: q.points });
    attendus.push({ question_id: q.id, attendu, permutation: perm });
  });

  return { sujet, attendus };
}

/** Vérifie qu'une question et son corrigé sont cohérents avant distribution ; rend le premier problème. */
export function problemeQuestion(q: QuestionModele, c: Corrige | undefined): string | null {
  try {
    const valeurs = tirerValeurs(q.parametres, aleaDepuisGraine(q.id));
    rendreTexte(q.enonce, valeurs);
    for (const x of q.choix ?? []) rendreTexte(x, valeurs);
    if (q.kind === "qcm" && (c?.index === undefined || c.index < 0 || c.index >= (q.choix?.length ?? 0))) return "Indiquez la bonne réponse du QCM.";
    if (q.kind === "qcm_multiple" && (!c?.indices || c.indices.length === 0)) return "Cochez au moins une bonne réponse.";
    if (q.kind === "vrai_faux" && typeof c?.vrai !== "boolean") return "Indiquez si l'affirmation est vraie ou fausse.";
    if (q.kind === "numerique") {
      if (c?.formule) evaluerExpression(c.formule, valeurs);
      else if (typeof c?.valeur !== "number") return "Indiquez la valeur attendue.";
    }
    if (q.kind === "courte" && (!c?.acceptees || c.acceptees.length === 0)) return "Indiquez au moins une réponse acceptée.";
  } catch (e) {
    return e instanceof Error ? e.message : "Expression invalide.";
  }
  return null;
}

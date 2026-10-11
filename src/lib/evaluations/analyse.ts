/**
 * Notation et analyse d'une évaluation — pur, testé.
 *
 * La note sur 20 et les niveaux de maîtrise sont calculés ici, pour le
 * professeur et pour l'export ; Study n'est pas le carnet de notes officiel.
 * L'analyse répond à trois questions : qui a réussi quoi, quelle erreur
 * revient (la mauvaise réponse la plus choisie), et quoi reprendre en classe.
 */

import type { GenreQuestion } from "./sujet";

export type Niveau = "non_acquis" | "fragile" | "satisfaisant" | "tres_bonne_maitrise";

export const LIBELLES_NIVEAU: Readonly<Record<Niveau, string>> = {
  non_acquis: "Non acquis",
  fragile: "Fragile",
  satisfaisant: "Satisfaisant",
  tres_bonne_maitrise: "Très bonne maîtrise",
};

export const ORDRE_NIVEAUX: readonly Niveau[] = ["non_acquis", "fragile", "satisfaisant", "tres_bonne_maitrise"];

/** Quatre niveaux, comme le livret scolaire : < 25 %, < 50 %, < 75 %, au-delà. */
export function niveauMaitrise(ratio: number): Niveau {
  if (ratio < 0.25) return "non_acquis";
  if (ratio < 0.5) return "fragile";
  if (ratio < 0.75) return "satisfaisant";
  return "tres_bonne_maitrise";
}

/** Note sur 20 arrondie au demi-point le plus proche ; null sans barème. */
export function noteSur20(points: number, maximum: number, pas = 0.5): number | null {
  if (maximum <= 0) return null;
  return Math.round(((points / maximum) * 20) / pas) * pas;
}

/** Un énoncé à variantes, lisible sans valeurs : « f(x) = {a}x + {b} » → « f(x) = ax + b ». */
export function texteModele(t: string): string {
  return t.replace(/\{([^{}]+)\}/g, "$1");
}

export function formaterNote(n: number | null): string {
  return n === null ? "—" : String(n).replace(".", ",");
}

/* -------------------------------------------------------------------------- */
/* Entrées                                                                      */
/* -------------------------------------------------------------------------- */

export interface QuestionAnalyse {
  readonly id: string;
  readonly ordre: number;
  readonly kind: GenreQuestion;
  readonly enonce: string;
  readonly choix: readonly string[] | null;
  readonly points: number;
  readonly notionId: string | null;
  readonly notion: string | null;
}

export interface CopieAnalyse {
  readonly id: string;
  readonly profileId: string;
  readonly prenom: string;
  readonly nom: string;
  readonly commenceeLe: string | null;
  readonly rendueLe: string | null;
  readonly sortiesOnglet: number;
}

export interface LigneCopieQuestion {
  readonly copieId: string;
  readonly questionId: string;
}
export interface AttenduAnalyse extends LigneCopieQuestion {
  readonly permutation: readonly number[] | null;
}
export interface ReponseAnalyse extends LigneCopieQuestion {
  readonly reponse: Readonly<Record<string, unknown>>;
}
export interface CorrectionAnalyse extends LigneCopieQuestion {
  readonly points: number;
  readonly juste: boolean | null;
  readonly automatique: boolean;
  readonly commentaire: string | null;
}

/* -------------------------------------------------------------------------- */
/* Sorties                                                                      */
/* -------------------------------------------------------------------------- */

export type StatutCopie = "absent" | "en_cours" | "a_corriger" | "corrigee";

export interface ResultatEleve {
  readonly copieId: string;
  readonly profileId: string;
  readonly prenom: string;
  readonly nom: string;
  readonly statut: StatutCopie;
  readonly points: number;
  readonly maximum: number;
  readonly note: number | null;
  readonly niveau: Niveau | null;
  readonly aCorriger: number;
  readonly sortiesOnglet: number;
  /** notion → part réussie (0 à 1). */
  readonly parNotion: Readonly<Record<string, number>>;
}

export interface Distracteur {
  readonly index: number;
  readonly libelle: string;
  readonly nombre: number;
  readonly correct: boolean;
}

export interface ResultatQuestion {
  readonly id: string;
  readonly ordre: number;
  readonly enonce: string;
  readonly kind: GenreQuestion;
  readonly points: number;
  readonly notion: string | null;
  readonly reussite: number | null;
  readonly corrigees: number;
  readonly aCorriger: number;
  readonly distracteurs: readonly Distracteur[];
  /** La mauvaise réponse la plus choisie, si elle concerne au moins 2 élèves. */
  readonly erreurPrincipale: { readonly libelle: string; readonly part: number } | null;
}

export interface ResultatNotion {
  readonly notionId: string;
  readonly notion: string;
  readonly reussite: number;
  readonly niveaux: Readonly<Record<Niveau, number>>;
}

export interface Analyse {
  readonly eleves: readonly ResultatEleve[];
  readonly questions: readonly ResultatQuestion[];
  readonly notions: readonly ResultatNotion[];
  readonly aReprendre: readonly ResultatNotion[];
  readonly maximum: number;
  readonly moyenne: number | null;
  readonly rendues: number;
  readonly aCorrigerTotal: number;
}

/* -------------------------------------------------------------------------- */
/* Calcul                                                                       */
/* -------------------------------------------------------------------------- */

const cle = (copie: string, question: string) => `${copie}|${question}`;

export function analyser(entree: {
  readonly questions: readonly QuestionAnalyse[];
  readonly copies: readonly CopieAnalyse[];
  readonly attendus: readonly AttenduAnalyse[];
  readonly reponses: readonly ReponseAnalyse[];
  readonly corrections: readonly CorrectionAnalyse[];
  readonly support: "en_ligne" | "papier";
}): Analyse {
  const { questions, copies } = entree;
  const maximum = questions.reduce((s, q) => s + q.points, 0);
  const corrections = new Map(entree.corrections.map((c) => [cle(c.copieId, c.questionId), c]));
  const reponses = new Map(entree.reponses.map((r) => [cle(r.copieId, r.questionId), r]));
  const attendus = new Map(entree.attendus.map((a) => [cle(a.copieId, a.questionId), a]));

  const eleves: ResultatEleve[] = copies.map((cp) => {
    const lignes = questions.map((q) => corrections.get(cle(cp.id, q.id)));
    const present = cp.rendueLe !== null || lignes.some(Boolean);
    const points = lignes.reduce((s, c) => s + (c?.points ?? 0), 0);
    const aCorriger = present ? lignes.filter((c) => !c).length : 0;
    const statut: StatutCopie = !present ? (cp.commenceeLe ? "en_cours" : "absent") : aCorriger > 0 ? "a_corriger" : "corrigee";

    const parNotion: Record<string, number> = {};
    const cumul = new Map<string, { obtenus: number; max: number }>();
    questions.forEach((q, k) => {
      const c = lignes[k];
      if (!q.notionId || !c) return;
      const n = cumul.get(q.notionId) ?? { obtenus: 0, max: 0 };
      n.obtenus += c.points;
      n.max += q.points;
      cumul.set(q.notionId, n);
    });
    for (const [n, v] of cumul) if (v.max > 0) parNotion[n] = v.obtenus / v.max;

    return {
      copieId: cp.id,
      profileId: cp.profileId,
      prenom: cp.prenom,
      nom: cp.nom,
      statut,
      points,
      maximum,
      note: present ? noteSur20(points, maximum) : null,
      niveau: present && maximum > 0 ? niveauMaitrise(points / maximum) : null,
      aCorriger,
      sortiesOnglet: cp.sortiesOnglet,
      parNotion,
    };
  });

  const presents = eleves.filter((e) => e.statut !== "absent" && e.statut !== "en_cours");

  const resultatsQuestions: ResultatQuestion[] = [...questions]
    .sort((a, b) => a.ordre - b.ordre)
    .map((q) => {
      const corrigees = presents.map((e) => corrections.get(cle(e.copieId, q.id))).filter((c): c is CorrectionAnalyse => Boolean(c));
      const reussite = corrigees.length ? corrigees.reduce((s, c) => s + c.points / q.points, 0) / corrigees.length : null;

      // Distracteurs : on ramène chaque choix affiché à son index d'origine.
      const compte = new Map<number, number>();
      if (q.kind === "qcm" || q.kind === "qcm_multiple") {
        for (const e of presents) {
          const r = reponses.get(cle(e.copieId, q.id));
          const perm = attendus.get(cle(e.copieId, q.id))?.permutation ?? null;
          const affiches =
            q.kind === "qcm"
              ? typeof r?.reponse.index === "number" ? [r.reponse.index] : []
              : Array.isArray(r?.reponse.indices) ? (r.reponse.indices as unknown[]).filter((x): x is number => typeof x === "number") : [];
          for (const a of affiches) {
            const origine = perm ? perm[a] : a;
            if (origine !== undefined) compte.set(origine, (compte.get(origine) ?? 0) + 1);
          }
        }
      }
      const justes = new Set<number>();
      for (const e of presents) {
        const c = corrections.get(cle(e.copieId, q.id));
        const r = reponses.get(cle(e.copieId, q.id));
        const perm = attendus.get(cle(e.copieId, q.id))?.permutation ?? null;
        if (q.kind === "qcm" && c?.juste && typeof r?.reponse.index === "number") {
          const o = perm ? perm[r.reponse.index] : r.reponse.index;
          if (o !== undefined) justes.add(o);
        }
      }
      const distracteurs = (q.choix ?? []).map((libelle, index) => ({ index, libelle, nombre: compte.get(index) ?? 0, correct: justes.has(index) }));
      const pire = q.kind !== "qcm" ? undefined : distracteurs.filter((d) => !d.correct && d.nombre >= 2).sort((a, b) => b.nombre - a.nombre)[0];

      return {
        id: q.id,
        ordre: q.ordre,
        enonce: q.enonce,
        kind: q.kind,
        points: q.points,
        notion: q.notion,
        reussite,
        corrigees: corrigees.length,
        aCorriger: presents.length - corrigees.length,
        distracteurs,
        erreurPrincipale: pire && presents.length ? { libelle: pire.libelle, part: pire.nombre / presents.length } : null,
      };
    });

  const notionsConnues = new Map<string, string>();
  for (const q of questions) if (q.notionId && q.notion) notionsConnues.set(q.notionId, q.notion);
  const notions: ResultatNotion[] = [...notionsConnues].map(([notionId, notion]) => {
    const ratios = presents.map((e) => e.parNotion[notionId]).filter((r): r is number => r !== undefined);
    const niveaux = { non_acquis: 0, fragile: 0, satisfaisant: 0, tres_bonne_maitrise: 0 } as Record<Niveau, number>;
    for (const r of ratios) niveaux[niveauMaitrise(r)] += 1;
    return { notionId, notion, reussite: ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0, niveaux };
  });

  const notes = presents.map((e) => e.note).filter((n): n is number => n !== null);
  return {
    eleves,
    questions: resultatsQuestions,
    notions,
    aReprendre: notions.filter((n) => n.reussite < 0.6).sort((a, b) => a.reussite - b.reussite).slice(0, 3),
    maximum,
    moyenne: notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null,
    rendues: presents.length,
    aCorrigerTotal: eleves.reduce((s, e) => s + e.aCorriger, 0),
  };
}

/** Lignes prêtes à coller dans Pronote (ou à ouvrir dans un tableur) : nom ; prénom ; note ; niveau. */
export function exportNotes(eleves: readonly ResultatEleve[], notation: "sur20" | "maitrise" | "les_deux"): string {
  const entete = ["Nom", "Prénom", ...(notation !== "maitrise" ? ["Note sur 20"] : []), ...(notation !== "sur20" ? ["Maîtrise"] : [])];
  const lignes = [...eleves]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"))
    .map((e) => {
      const absent = e.statut === "absent" || e.statut === "en_cours";
      return [
        e.nom,
        e.prenom,
        ...(notation !== "maitrise" ? [absent ? "Abs" : formaterNote(e.note)] : []),
        ...(notation !== "sur20" ? [absent || !e.niveau ? "Abs" : LIBELLES_NIVEAU[e.niveau]] : []),
      ];
    });
  const echapper = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [entete, ...lignes].map((l) => l.map(echapper).join(";")).join("\r\n");
}

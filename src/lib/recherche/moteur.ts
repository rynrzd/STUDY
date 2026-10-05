import { reciprocalRankFusion } from "../revision/algorithmes.ts";

/**
 * Recherche — dossier Study V6, §7.3, étapes 2 et 5 à 8.
 *
 * Ce module est pur : il reçoit des candidats **déjà autorisés** par la base
 * (RLS dans la sélection, seconde vérification sur les sources vivantes) et
 * ne fait que classer, regrouper, paginer et préparer l'affichage. Il ne
 * décide d'aucun droit et ne peut donc pas en élargir un.
 */

export type GenreResultat = "seance" | "exercice" | "fiche" | "message" | "decision" | "projet";

export interface Candidat {
  readonly doc_id: string;
  readonly kind: GenreResultat;
  readonly source_id: string;
  readonly passage_ref: string;
  readonly page: number | null;
  readonly section: string | null;
  readonly titre: string;
  readonly extrait: string;
  readonly validation: "professeur" | "eleve" | "genere";
  readonly date_source: string;
  readonly rang: number;
  readonly teaching_space_id: string | null;
  readonly class_id: string | null;
  readonly salon_id: string | null;
  readonly project_id: string | null;
}

export interface Passage {
  readonly ref: string;
  readonly page: number | null;
  readonly section: string | null;
  readonly segments: readonly Segment[];
}

/** Un morceau de texte, marqué ou non. Le rendu échappe tout : aucun HTML ici. */
export interface Segment {
  readonly texte: string;
  readonly marque: boolean;
}

export interface Resultat {
  readonly id: string;
  readonly kind: GenreResultat;
  readonly titre: string;
  readonly passages: readonly Passage[];
  readonly validation: Candidat["validation"];
  readonly date: string;
  readonly score: number;
  readonly href: string;
}

export const LONGUEUR_MAX_REQUETE = 500;
export const TAILLE_PAGE = 20;

/** Étape 2 : espaces réduits, longueur bornée. Le texte saisi n'est pas réécrit. */
export function normaliserRequete(brute: string): string {
  return brute.replace(/\s+/gu, " ").trim().slice(0, LONGUEUR_MAX_REQUETE);
}

export function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Les mots significatifs de la requête, pour le surlignage. */
export function termes(requete: string): string[] {
  const vides = new Set(["les", "des", "une", "est", "que", "qui", "dans", "pour", "par", "sur", "avec", "aux", "the"]);
  return [
    ...new Set(
      sansAccents(requete)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((m) => m.length >= 3 && !vides.has(m)),
    ),
  ];
}

/**
 * Découpe un passage en segments, en marquant les mots qui commencent par un
 * terme de la requête (« antecedent » marque « antécédents »). Insensible aux
 * accents pour comparer, fidèle au texte pour afficher. Fenêtre de 280
 * caractères autour de la première occurrence.
 */
export function surligner(texte: string, mots: readonly string[], fenetre = 280): Segment[] {
  // NFD peut allonger la chaîne ; on travaille mot par mot sur l'original.
  // Découpe sur les frontières de mots : la ponctuation ou des chevrons collés
  // à un mot ne l'empêchent pas d'être reconnu.
  const morceaux = texte.split(/([^\p{L}\p{N}]+)/u).filter((m) => m !== "");
  let premier = -1;
  let position = 0;
  const marques = morceaux.map((m) => {
    const cle = sansAccents(m);
    const marque = cle.length >= 3 && mots.some((t) => cle.startsWith(t.slice(0, Math.max(3, t.length - 2))));
    if (marque && premier === -1) premier = position;
    position += m.length;
    return { texte: m, marque };
  });

  const debut = premier <= fenetre / 3 ? 0 : premier - Math.floor(fenetre / 3);
  const segments: Segment[] = [];
  let curseur = 0;
  for (const m of marques) {
    const fin = curseur + m.texte.length;
    if (fin > debut && curseur < debut + fenetre) {
      const dernier = segments[segments.length - 1];
      if (dernier !== undefined && dernier.marque === m.marque) {
        segments[segments.length - 1] = { texte: dernier.texte + m.texte, marque: m.marque };
      } else {
        segments.push({ texte: m.texte, marque: m.marque });
      }
    }
    curseur = fin;
  }
  if (debut > 0 && segments.length > 0) segments.unshift({ texte: "… ", marque: false });
  if (debut + fenetre < texte.length) segments.push({ texte: " …", marque: false });
  return segments;
}

const RANG_VALIDATION: Record<Candidat["validation"], number> = { professeur: 0, eleve: 1, genere: 2 };

/** Lien vers le passage précis, à partir d'identifiants seulement. */
export function lienResultat(c: Candidat): string {
  switch (c.kind) {
    case "seance":
      return `/app/seances/${c.source_id}${c.passage_ref.startsWith("bloc:") ? `#${c.passage_ref.replace(":", "-")}` : ""}`;
    case "exercice":
      return `/app/entrainements/nouveau?exercice=${c.source_id}`;
    case "fiche":
      return `/app/fiches/${c.source_id}`;
    case "message":
      return c.class_id === null || c.salon_id === null
        ? "/app/messagerie"
        : `/app/classes/${c.class_id}/salons/${c.salon_id}?message=${c.source_id}`;
    case "decision":
      return c.class_id === null ? "/app/classe" : `/app/classes/${c.class_id}/delegues#decision-${c.source_id}`;
    case "projet":
      return `/app/projets/${c.project_id ?? c.source_id}`;
  }
}

/**
 * Étapes 5 et 6 : fusion RRF des branches (la sémantique peut être vide),
 * regroupement par ressource avec deux passages au plus, départage par
 * validation, date puis identifiant stable. La popularité n'intervient pas.
 */
export function classer(
  lexical: readonly Candidat[],
  semantique: readonly Candidat[],
  requete: string,
): Resultat[] {
  const parDoc = new Map<string, Candidat>();
  for (const c of [...lexical, ...semantique]) if (!parDoc.has(c.doc_id)) parDoc.set(c.doc_id, c);

  const fusion = reciprocalRankFusion(
    lexical.map((c) => c.doc_id),
    semantique.map((c) => c.doc_id),
  );

  const mots = termes(requete);
  const groupes = new Map<string, { premier: Candidat; score: number; passages: Candidat[] }>();
  for (const { id, score } of fusion) {
    const c = parDoc.get(id);
    if (c === undefined) continue;
    const cle = `${c.kind}:${c.source_id}`;
    const groupe = groupes.get(cle);
    if (groupe === undefined) groupes.set(cle, { premier: c, score, passages: [c] });
    else if (groupe.passages.length < 2) groupe.passages.push(c);
  }

  return [...groupes.values()]
    .map(({ premier, score, passages }) => ({
      id: premier.source_id,
      kind: premier.kind,
      titre: premier.titre,
      validation: premier.validation,
      date: premier.date_source,
      score,
      href: lienResultat(premier),
      passages: passages.map((p) => ({
        ref: p.passage_ref,
        page: p.page,
        section: p.section,
        segments: surligner(p.extrait, mots),
      })),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        RANG_VALIDATION[a.validation] - RANG_VALIDATION[b.validation] ||
        b.date.localeCompare(a.date) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * Étape 7 : curseur stable rattaché à la requête et au périmètre. Il désigne
 * le dernier résultat servi ; une requête différente l'invalide.
 */
export function encoderCurseur(requete: string, perimetre: string, dernier: string): string {
  return Buffer.from(JSON.stringify({ q: requete, p: perimetre, d: dernier }), "utf8").toString("base64url");
}

export function paginer(
  resultats: readonly Resultat[],
  requete: string,
  perimetre: string,
  curseur: string | null,
): { items: Resultat[]; suivant: string | null } {
  let depart = 0;
  if (curseur !== null) {
    try {
      const lu = JSON.parse(Buffer.from(curseur, "base64url").toString("utf8")) as { q?: string; p?: string; d?: string };
      if (lu.q === requete && lu.p === perimetre && typeof lu.d === "string") {
        const index = resultats.findIndex((r) => `${r.kind}:${r.id}` === lu.d);
        depart = index === -1 ? 0 : index + 1;
      }
    } catch {
      depart = 0;
    }
  }
  const items = resultats.slice(depart, depart + TAILLE_PAGE);
  const dernier = items[items.length - 1];
  const suivant =
    depart + TAILLE_PAGE < resultats.length && dernier !== undefined
      ? encoderCurseur(requete, perimetre, `${dernier.kind}:${dernier.id}`)
      : null;
  return { items, suivant };
}

/** Distance d'édition, bornée : au-delà de `max`, on renonce tôt. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j += 1) {
      const valeur = Math.min(
        precedente[j]! + 1,
        courante[j - 1]! + 1,
        precedente[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      courante.push(valeur);
      minimum = Math.min(minimum, valeur);
    }
    if (minimum > max) return max + 1;
    precedente = courante;
  }
  return precedente[b.length]!;
}

/**
 * Étape 8 : une reformulation proposée à partir du **seul vocabulaire
 * visible** par la personne (titres et sections qu'elle peut lire).
 */
export function suggerer(requete: string, vocabulaire: readonly string[]): string | null {
  const mots = sansAccents(requete).split(/\s+/u).filter(Boolean);
  if (mots.length === 0) return null;
  let change = false;
  const corriges = mots.map((mot) => {
    if (mot.length < 4 || vocabulaire.includes(mot)) return mot;
    let meilleur: string | null = null;
    let meilleure = 3;
    for (const candidat of vocabulaire) {
      const d = distance(mot, candidat, mot.length >= 7 ? 2 : 1);
      if (d < meilleure) {
        meilleure = d;
        meilleur = candidat;
      }
    }
    if (meilleur !== null && meilleure <= (mot.length >= 7 ? 2 : 1)) {
      change = true;
      return meilleur;
    }
    return mot;
  });
  return change ? corriges.join(" ") : null;
}

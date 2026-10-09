/** Validation commune à l'enregistrement et au test professeur. Aucun accès aux données. */
export function lireExercice(donnees: FormData) {
  const lire = (nom: string) => String(donnees.get(nom) ?? "").trim();
  const valeurs = { kind: lire("kind"), enonce: lire("enonce"), bonne: lire("bonne"), tolerance: lire("tolerance") || "0", explication: lire("explication"), indice: lire("indice"), exemple: lire("exemple"), notion: lire("notion"), nouvelleNotion: lire("nouvelle_notion"), exercice: lire("exercice") };
  const choix = donnees.getAll("choix").map((c) => String(c).trim());
  // Seules les lignes vides finales sont facultatives. Un trou au milieu
  // est refusé : le supprimer déplacerait la correction vers une autre réponse.
  while (choix.length && choix[choix.length - 1] === "") choix.pop();
  const champs: Record<string, string[]> = {};
  if (!["qcm", "numerique", "texte"].includes(valeurs.kind)) champs.kind = ["Choisissez un type d'exercice."];
  if (valeurs.enonce.length < 3 || valeurs.enonce.length > 4000) champs.enonce = ["L'énoncé doit contenir entre 3 et 4 000 caractères."];
  if (valeurs.explication.length < 3 || valeurs.explication.length > 4000) champs.explication = ["Ajoutez une explication de 3 à 4 000 caractères."];
  if (valeurs.indice.length > 2000) champs.indice = ["L'indice est limité à 2 000 caractères."];
  if (valeurs.exemple.length > 4000) champs.exemple = ["L'exemple est limité à 4 000 caractères."];
  if (valeurs.nouvelleNotion.length > 120) champs.nouvelle_notion = ["La notion est limitée à 120 caractères."];
  let bonne: { index: number } | { valeur: number; tolerance: number } | null = null;
  if (valeurs.kind === "qcm") {
    if (choix.length < 2 || choix.length > 8 || choix.some((c) => !c || c.length > 300)) champs.choix = ["Saisissez de 2 à 8 choix, sans ligne vide entre eux (300 caractères maximum par choix)."];
    else if (new Set(choix.map((c) => c.toLocaleLowerCase("fr"))).size !== choix.length) champs.choix = ["Deux choix sont identiques : reformulez-les."];
    const index = Number(valeurs.bonne) - 1;
    if (!/^\d+$/u.test(valeurs.bonne) || !Number.isInteger(index) || index < 0 || index >= choix.length || !choix[index]) champs.bonne = ["Indiquez le numéro d'un choix renseigné."];
    else bonne = { index };
  }
  if (valeurs.kind === "numerique") {
    const valeur = nombreDecimal(valeurs.bonne);
    const tolerance = nombreDecimal(valeurs.tolerance);
    if (valeur === null) champs.bonne = ["Saisissez un nombre fini, avec une virgule ou un point."];
    if (tolerance === null || tolerance < 0) champs.tolerance = ["La tolérance doit être un nombre positif ou nul."];
    if (valeur !== null && tolerance !== null && tolerance >= 0) bonne = { valeur, tolerance };
  }
  return { valeurs: { ...valeurs, choix: choix.join("\n") }, choix, champs, bonne, valide: Object.keys(champs).length === 0 };
}

export function nombreDecimal(texte: string): number | null {
  const normalise = texte.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/u.test(normalise)) return null;
  const n = Number(normalise);
  return Number.isFinite(n) ? n : null;
}

/** Simulation uniquement, jamais utilisée pour enregistrer une réussite élève. */
export function testerReponse(bonne: ReturnType<typeof lireExercice>["bonne"], reponse: string): boolean | null {
  if (!bonne) return null;
  if ("index" in bonne) return /^\d+$/u.test(reponse) && Number(reponse) === bonne.index;
  const valeur = nombreDecimal(reponse);
  if (valeur === null) return null;
  if (bonne.tolerance === 0) return valeur === bonne.valeur;
  const ecart = Math.abs(valeur - bonne.valeur);
  const arrondi = Number.EPSILON * Math.max(1, Math.abs(valeur), Math.abs(bonne.valeur)) * 4;
  return ecart <= bonne.tolerance + arrondi;
}

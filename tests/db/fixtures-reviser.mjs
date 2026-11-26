import { ACTEURS, OBJETS, lirePour } from "./harness.mjs";

/** Données fictives installées dans la base isolée du banc de tests. */
export async function preparerRevisionLina(db) {
  await db.query("update study.classes set label = '1re STMG 2' where id = $1", [OBJETS.classeA1]);
  await db.query("update study.classes set label = '1re STMG 3' where id = $1", [OBJETS.classeA2]);
  const notion = (await lirePour(db, ACTEURS.profMartin,
    "insert into study.notions (organization_id, teaching_space_id, label, created_by) values ($1,$2,$3,$4) returning id",
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, "Charges fixes et variables", ACTEURS.profMartin]))[0].id;
  const questions = [
    { kind: "qcm", enonce: "Un cinéma loue sa salle chaque mois et paie une commission par billet. Quelle charge varie avec les ventes ?", choix: ["Le loyer mensuel", "La commission par billet"], bonne: { index: 1 }, explication: "Le loyer reste fixe, même si aucun billet n'est vendu. La commission augmente avec chaque billet vendu.", indice: "Compare un mois avec 10 billets et un mois avec 20 billets." },
    { kind: "numerique", enonce: "Dans un atelier, le coût variable passe de 40 € pour 10 pièces à 80 € pour 20 pièces. Le loyer reste de 300 €. De combien d'euros le coût variable augmente-t-il ?", choix: null, bonne: { valeur: 40, tolerance: 0 }, explication: "80 − 40 = 40 €. Le coût variable augmente avec la production, alors que le loyer reste à 300 €.", indice: "Compare seulement les deux montants du coût variable." },
    { kind: "texte", enonce: "Une association paie 200 € pour une salle et 3 € par repas. Explique quelles charges changent si elle prépare davantage de repas.", choix: null, bonne: null, explication: "Critères : identifier la salle comme charge fixe, relier les ingrédients au nombre de repas. Exemple : la location reste à 200 €, tandis que chaque repas ajoute 3 €.", indice: "Que paie l'association même sans servir de repas ?" },
  ];
  const versions = [];
  for (const question of questions) {
    const exercice = (await lirePour(db, ACTEURS.profMartin,
      "insert into study.exercices (organization_id, teaching_space_id, notion_id, created_by) values ($1,$2,$3,$4) returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, notion, ACTEURS.profMartin]))[0].id;
    const version = (await lirePour(db, ACTEURS.profMartin,
      "insert into study.exercice_versions (organization_id, exercice_id, kind, enonce, choix, created_by) values ($1,$2,$3,$4,$5,$6) returning id",
      [ACTEURS.lyceeA, exercice, question.kind, question.enonce, question.choix && JSON.stringify(question.choix), ACTEURS.profMartin]))[0].id;
    await lirePour(db, ACTEURS.profMartin,
      "insert into study.exercice_corriges (organization_id, exercice_version_id, bonne_reponse, explication, indice) values ($1,$2,$3,$4,$5)",
      [ACTEURS.lyceeA, version, JSON.stringify(question.bonne), question.explication, question.indice]);
    await lirePour(db, ACTEURS.profMartin, "select study.exercice_publier($1)", [version]);
    versions.push(version);
  }
  return { notion, versions };
}

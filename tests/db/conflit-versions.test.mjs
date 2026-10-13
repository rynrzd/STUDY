// =============================================================================
// EDIT-07 — conflit entre deux onglets. L'éditeur renvoie la version lue à
// l'ouverture (`updated_at`) ; l'écriture n'aboutit que si elle n'a pas
// changé. Ce test verrouille ce sur quoi le mécanisme repose : le déclencheur
// avance la version à chaque écriture, et une écriture conditionnée à une
// version périmée ne touche aucune ligne.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, lirePour } from "./harness.mjs";

for (const [table, id, colonne, valeur] of [
  ["lessons", OBJETS.seanceA1Brouillon, "title", "Onglet A"],
  ["lesson_blocks", null, "contenu", JSON.stringify({ texte: "Onglet A" })],
]) {
  test(`VER-01 — ${table} : une version périmée n'écrase rien`, async (t) => {
    const db = await baseDeTest();
    t.after(() => db.close());

    let cible = id;
    if (cible === null) {
      // Un bloc de la séance brouillon, créé par son professeur.
      const [b] = await lirePour(
        db,
        ACTEURS.profMartin,
        "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) values ($1, $2, 'texte', 1, '{\"texte\":\"départ\"}', $3) returning id",
        [ACTEURS.lyceeA, OBJETS.seanceA1Brouillon, ACTEURS.profMartin],
      );
      cible = b.id;
    }
    const lire = async () => (await db.query(`select updated_at::text v from study.${table} where id = $1`, [cible])).rows[0].v;
    const v0 = await lire();

    // Onglet A enregistre avec la bonne version : une ligne écrite.
    const a = await lirePour(db, ACTEURS.profMartin, `update study.${table} set ${colonne} = $1 where id = $2 and updated_at = $3::timestamptz returning id`, [valeur, cible, v0]);
    assert.equal(a.length, 1);
    const v1 = await lire();
    assert.notEqual(v1, v0, "la version avance à chaque écriture");

    // Onglet B, ouvert avant, enregistre avec l'ancienne version : rien.
    const b = await lirePour(db, ACTEURS.profMartin, `update study.${table} set ${colonne} = $1 where id = $2 and updated_at = $3::timestamptz returning id`, [colonne === "title" ? "Onglet B" : JSON.stringify({ texte: "Onglet B" }), cible, v0]);
    assert.equal(b.length, 0, "aucune ligne écrasée");
    const final = (await db.query(`select ${colonne}::text x from study.${table} where id = $1`, [cible])).rows[0].x;
    assert.match(final, /Onglet A/);
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { COTE_MAX, densiteDeRendu, PIXELS_MAX } from "../../src/lib/rendu-pdf.ts";

const tient = (l: number, h: number, d: number) => l * d * h * d <= PIXELS_MAX + 1 && l * d <= COTE_MAX + 1 && h * d <= COTE_MAX + 1;

test("PDF-10 — une page A4 garde la netteté d'un écran haute définition", () => {
  assert.equal(densiteDeRendu(595, 842, 2), 2);
  assert.equal(densiteDeRendu(595, 842, 3), 2, "jamais plus de ×2");
  assert.equal(densiteDeRendu(595, 842, 0), 1, "ratio inconnu : ×1");
});

test("PDF-10 — cas extrêmes : affiche, plan géant, bandeau très long", () => {
  for (const [l, h] of [[3370, 4768], [14400, 14400], [200000, 200000], [100000, 20], [20, 100000]] as const) {
    const d = densiteDeRendu(l, h, 2);
    assert.ok(d > 0, `densité positive pour ${l}×${h}`);
    assert.ok(tient(l, h, d), `${l}×${h} tient dans les plafonds (densité ${d})`);
  }
});

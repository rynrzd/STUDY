import assert from "node:assert/strict";
import test from "node:test";
import {
  echeanceLisible,
  seanceDuJour,
  trierDevoirs,
} from "../../src/lib/echeances.ts";

/**
 * Les règles d'affichage de l'espace élève — cahier V2, §7 et §11.
 *
 * Ces fonctions décident ce qu'un élève voit en tête de liste. Une erreur ici
 * ne fait pas planter l'application : elle fait disparaître un devoir de « À
 * faire », ce qui est pire — personne ne signale un devoir qu'il n'a pas vu.
 */

const MAINTENANT = new Date("2026-09-16T10:00:00.000Z");

const devoir = (id: string, due_at: string | null) => ({ id, due_at });

test("un devoir sans date limite reste a faire", () => {
  const { aVenir, passes } = trierDevoirs([devoir("a", null)], MAINTENANT);

  assert.deepEqual(
    aVenir.map((d) => d.id),
    ["a"],
    "sans echeance, un devoir reste a rendre — le ranger dans le passe le ferait disparaitre",
  );
  assert.equal(passes.length, 0);
});

test("l echeance depassee bascule le devoir dans les termines, pas a la poubelle", () => {
  const { aVenir, passes } = trierDevoirs(
    [
      devoir("hier", "2026-09-15T22:00:00.000Z"),
      devoir("demain", "2026-09-17T22:00:00.000Z"),
      devoir("dans-une-heure", "2026-09-16T11:00:00.000Z"),
    ],
    MAINTENANT,
  );

  assert.deepEqual(aVenir.map((d) => d.id), ["demain", "dans-une-heure"]);
  assert.deepEqual(passes.map((d) => d.id), ["hier"]);
});

test("les devoirs passes se lisent du plus recent au plus ancien", () => {
  const { passes } = trierDevoirs(
    [
      devoir("ancien", "2026-09-01T22:00:00.000Z"),
      devoir("recent", "2026-09-14T22:00:00.000Z"),
    ],
    MAINTENANT,
  );

  assert.deepEqual(
    passes.map((d) => d.id),
    ["recent", "ancien"],
    "le devoir rendu la semaine derniere interesse plus que celui du mois dernier",
  );
});

test("la seance du jour se reconnait a sa date, pas a son heure", () => {
  const seances = [
    { id: "hier", scheduled_for: "2026-09-15T08:00:00.000Z" },
    { id: "ce-matin", scheduled_for: "2026-09-16T08:00:00.000Z" },
    { id: "sans-date", scheduled_for: null },
  ];

  assert.equal(seanceDuJour(seances, MAINTENANT)?.id, "ce-matin");
  assert.equal(seanceDuJour([seances[0]!, seances[2]!], MAINTENANT), null);
});

test("une echeance se lit en francais, et en clair", () => {
  assert.equal(echeanceLisible(null, MAINTENANT), "Sans date limite");
  assert.equal(echeanceLisible("2026-09-16T18:00:00.000Z", MAINTENANT), "Pour aujourd'hui");
  assert.equal(echeanceLisible("2026-09-17T18:00:00.000Z", MAINTENANT), "Pour demain");
  assert.equal(echeanceLisible("2026-09-19T18:00:00.000Z", MAINTENANT), "Dans 3 jours");
  assert.equal(echeanceLisible("2026-09-15T18:00:00.000Z", MAINTENANT), "Était pour hier");
  assert.equal(echeanceLisible("2026-09-10T18:00:00.000Z", MAINTENANT), "En retard de 6 jours");
});

test("une echeance lointaine porte sa date, pas un decompte", () => {
  // « Dans 42 jours » n'aide personne à s'organiser : la date, si.
  const lointaine = echeanceLisible("2026-11-03T18:00:00.000Z", MAINTENANT);
  assert.match(lointaine, /^Pour le 3 novembre$/);
});

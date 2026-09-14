// =============================================================================
// Tests unitaires — sessions (AUTH-04, AUTH-05, ch. 23 et 37).
//
// Node 24 exécute ces fichiers TypeScript directement, en retirant les types.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  genererJetonSession,
  empreinteJeton,
  comparerEmpreintes,
  calculerEcheances,
  dureesPour,
  sessionUtilisable,
  reauthRecente,
  prolongerSurActivite,
  cookieSession,
  DUREES,
  FENETRE_REAUTH_MINUTES,
} from "../../src/lib/session.ts";

test("le jeton de session est aleatoire, long, et sans information", () => {
  const a = genererJetonSession();
  const b = genererJetonSession();

  assert.notEqual(a, b, "deux jetons consecutifs different");
  // 32 octets en base64url : 43 caractères, sans remplissage.
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/, "base64url, donc utilisable tel quel dans un cookie");
});

test("seule lempreinte du jeton est stockable, et la comparaison est a temps constant", () => {
  const jeton = genererJetonSession();
  const empreinte = empreinteJeton(jeton);

  assert.equal(empreinte.length, 32, "SHA-256 fait 32 octets");
  assert.ok(comparerEmpreintes(empreinte, empreinteJeton(jeton)));
  assert.ok(!comparerEmpreintes(empreinte, empreinteJeton(genererJetonSession())));

  // L'empreinte ne permet pas de retrouver le jeton : elle ne le contient pas.
  assert.ok(!empreinte.toString("base64url").includes(jeton.slice(0, 12)));
});

test("le cookie de session est opaque, HttpOnly, SameSite=Lax, sur Path=/", () => {
  const jeton = genererJetonSession();
  const cookie = cookieSession(jeton, 3600);

  assert.equal(cookie.httpOnly, true, "inaccessible au JavaScript de la page");
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.path, "/");
  assert.equal(cookie.value, jeton);
  // Le cookie ne porte aucune identite : c'est un pointeur, pas un porteur.
  assert.ok(!cookie.name.includes("user"));
});

test("les durees sont plus courtes pour ladministration et le poste partage", () => {
  const admin = dureesPour({ portee: "etablissement", appareil: "personnel", administratif: true });
  const partage = dureesPour({ portee: "etablissement", appareil: "partage", administratif: false });
  const personnel = dureesPour({ portee: "etablissement", appareil: "personnel", administratif: false });
  const activation = dureesPour({ portee: "activation", appareil: "personnel", administratif: false });

  assert.equal(admin.inactiviteMinutes, 15, "admin : 15 minutes d inactivite (ch. 23)");
  assert.equal(partage.inactiviteMinutes, 30, "poste partage : 30 minutes");
  assert.equal(personnel.inactiviteMinutes, 120, "appareil personnel : 2 heures");
  assert.equal(activation.absolueHeures, 1, "l activation est une fenetre courte");

  // Un compte administratif garde la fenetre courte meme sur son propre appareil.
  const adminSurSonPortable = dureesPour({
    portee: "etablissement", appareil: "personnel", administratif: true,
  });
  assert.equal(adminSurSonPortable.inactiviteMinutes, DUREES.admin!.inactiviteMinutes);
});

test("une session revoquee ou expiree nest plus utilisable, meme une seconde apres", () => {
  const maintenant = new Date("2026-09-14T10:00:00Z");
  const echeances = calculerEcheances(DUREES.personnel!, maintenant);

  assert.ok(sessionUtilisable({ revokedAt: null, ...echeances }, maintenant));

  // Revocation immediate : pas d attente de l expiration d un jeton (AUTH-04).
  assert.ok(!sessionUtilisable(
    { revokedAt: new Date("2026-09-14T10:00:01Z"), ...echeances },
    new Date("2026-09-14T10:00:02Z"),
  ));

  // Inactivite depassee.
  assert.ok(!sessionUtilisable(
    { revokedAt: null, ...echeances },
    new Date("2026-09-14T12:00:01Z"),
  ));

  // Echeance absolue depassee, meme si l inactivite vient d etre repoussee.
  assert.ok(!sessionUtilisable(
    {
      revokedAt: null,
      idleExpiresAt: new Date("2026-09-15T00:00:00Z"),
      absoluteExpiresAt: echeances.absoluteExpiresAt,
    },
    new Date("2026-09-14T22:00:01Z"),
  ));
});

test("lactivite repousse linactivite, jamais lecheance absolue", () => {
  const debut = new Date("2026-09-14T10:00:00Z");
  const echeances = calculerEcheances(DUREES.personnel!, debut);

  const apresActivite = prolongerSurActivite(
    echeances, DUREES.personnel!, new Date("2026-09-14T11:00:00Z"));

  assert.ok(apresActivite.idleExpiresAt > echeances.idleExpiresAt, "l inactivite est repoussee");
  assert.deepEqual(
    apresActivite.absoluteExpiresAt,
    echeances.absoluteExpiresAt,
    "l echeance absolue ne bouge jamais",
  );

  // Tard dans la session, l inactivite ne peut pas depasser l echeance absolue.
  const tard = prolongerSurActivite(
    echeances, DUREES.personnel!, new Date("2026-09-14T21:30:00Z"));
  assert.deepEqual(tard.idleExpiresAt, echeances.absoluteExpiresAt);
});

test("la reauthentification recente a une fenetre stricte", () => {
  const maintenant = new Date("2026-09-14T10:00:00Z");

  assert.ok(!reauthRecente(null, maintenant), "jamais reauthentifie : refus");
  assert.ok(reauthRecente(new Date("2026-09-14T09:57:00Z"), maintenant), "3 minutes : accepte");
  assert.ok(
    !reauthRecente(new Date("2026-09-14T09:54:00Z"), maintenant),
    `au-dela de ${FENETRE_REAUTH_MINUTES} minutes : refus`,
  );
});

// =============================================================================
// Tests unitaires — protection des mutations (WEB-03) et configuration (ch. 40).
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  estMutation,
  genererJetonCsrf,
  jetonsCorrespondent,
  verifierMutation,
  originesAutorisees,
  type RequeteAVerifier,
} from "../../src/lib/csrf.ts";
import {
  diagnostiquer,
  verifierAuDemarrage,
  clesPubliquesSuspectes,
  groupeUtilisable,
  ConfigurationInvalide,
} from "../../src/lib/config.ts";

const ORIGINE = "https://study.exemple.test";

function requete(surcharge: Partial<RequeteAVerifier> = {}): RequeteAVerifier {
  const jeton = "jeton-de-test-suffisamment-long-pour-etre-realiste";
  return {
    methode: "POST",
    origine: ORIGINE,
    referer: null,
    fetchSite: "same-origin",
    fetchMode: "cors",
    jetonEnvoye: jeton,
    jetonCookie: jeton,
    ...surcharge,
  };
}

test("seules les methodes sans effet echappent au controle", () => {
  assert.ok(!estMutation("GET"));
  assert.ok(!estMutation("HEAD"));
  assert.ok(!estMutation("OPTIONS"));
  assert.ok(estMutation("POST"));
  assert.ok(estMutation("put"), "la casse ne doit pas servir a contourner");
  assert.ok(estMutation("DELETE"));
  assert.ok(estMutation("PATCH"));
});

test("une mutation legitime passe les trois defenses", () => {
  const verdict = verifierMutation(requete(), [ORIGINE]);
  assert.equal(verdict.accepte, true);
});

test("une mutation venue dun autre site est refusee avant meme le jeton", () => {
  const verdict = verifierMutation(
    requete({ fetchSite: "cross-site", origine: "https://attaquant.test" }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, false);
  assert.equal(verdict.motif, "contexte_suspect");
});

test("une origine etrangere est refusee meme avec un jeton valide", () => {
  const verdict = verifierMutation(
    // Fetch Metadata absent : navigateur ancien, ou en-tete retire.
    requete({ fetchSite: null, origine: "https://attaquant.test" }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, false);
  assert.equal(verdict.motif, "origine_etrangere");
});

test("le Referer sert de repli quand Origin manque", () => {
  const accepte = verifierMutation(
    requete({ origine: null, referer: `${ORIGINE}/app/devoirs` }),
    [ORIGINE],
  );
  assert.equal(accepte.accepte, true);

  const refuse = verifierMutation(
    requete({ origine: null, referer: "https://attaquant.test/piege" }),
    [ORIGINE],
  );
  assert.equal(refuse.accepte, false);
  assert.equal(refuse.motif, "origine_etrangere");

  const sansRien = verifierMutation(
    requete({ origine: null, referer: null, fetchSite: null }),
    [ORIGINE],
  );
  assert.equal(sansRien.accepte, false);
  assert.equal(sansRien.motif, "origine_absente");
});

test("un jeton absent, vide ou different est refuse", () => {
  for (const surcharge of [
    { jetonEnvoye: null },
    { jetonCookie: null },
    { jetonEnvoye: "" },
    { jetonEnvoye: "un-autre-jeton-completement-different" },
  ]) {
    const verdict = verifierMutation(requete(surcharge), [ORIGINE]);
    assert.equal(verdict.accepte, false, JSON.stringify(surcharge));
  }
});

test("SameSite seul ne suffit pas : une navigation de haut niveau est refusee", () => {
  // « none » : action lancee hors page. Une mutation ne doit jamais arriver la.
  const verdict = verifierMutation(
    requete({ fetchSite: "none", fetchMode: "navigate" }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, false);
  assert.equal(verdict.motif, "contexte_suspect");
});

test("la comparaison de jetons ne se laisse pas avoir par une valeur vide", () => {
  const jeton = genererJetonCsrf();
  assert.ok(jetonsCorrespondent(jeton, jeton));
  assert.ok(!jetonsCorrespondent(jeton, null));
  assert.ok(!jetonsCorrespondent(null, jeton));
  assert.ok(!jetonsCorrespondent("", ""));
  assert.ok(!jetonsCorrespondent(jeton, genererJetonCsrf()));
});

test("aucune origine generique nest acceptee", () => {
  const precedent = process.env.APP_ORIGIN;
  try {
    process.env.APP_ORIGIN = "*";
    assert.deepEqual(originesAutorisees(), [], "« * » est ignore, jamais applique");

    process.env.APP_ORIGIN = "https://study.exemple.test/app/";
    assert.deepEqual(originesAutorisees(), ["https://study.exemple.test"], "seule l origine compte");

    process.env.APP_ORIGIN = "pas-une-url";
    assert.deepEqual(originesAutorisees(), []);
  } finally {
    if (precedent === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = precedent;
  }
});

// -----------------------------------------------------------------------------
// Configuration (ch. 40)
// -----------------------------------------------------------------------------

const BASE_VALIDE: Record<string, string | undefined> = {
  APP_ORIGIN: "https://study.exemple.test",
  APP_ENV: "recette",
};

test("le demarrage est refuse proprement quand une variable requise manque", () => {
  assert.throws(
    () => verifierAuDemarrage({ APP_ENV: "recette" }),
    (erreur: unknown) => {
      assert.ok(erreur instanceof ConfigurationInvalide);
      assert.match(erreur.message, /APP_ORIGIN/);
      return true;
    },
  );
});

test("un message derreur de configuration ne contient jamais de valeur", () => {
  const secret = "valeur-ultra-secrete-a-ne-jamais-afficher";
  try {
    verifierAuDemarrage({
      APP_ENV: "recette",
      SUPABASE_SECRET_KEY: secret,
    });
    assert.fail("aurait du echouer");
  } catch (erreur) {
    assert.ok(erreur instanceof Error);
    assert.ok(!erreur.message.includes(secret), "aucune valeur ne doit fuiter dans le message");
  }
});

test("une cle privilegiee exposee au navigateur bloque le demarrage", () => {
  for (const nom of [
    "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SESSION_ENCRYPTION_KEY",
    "NEXT_PUBLIC_WORKER_DATABASE_URL",
    "NEXT_PUBLIC_CRON_SECRET",
  ]) {
    const source = { ...BASE_VALIDE, [nom]: "peu importe" };
    assert.deepEqual(clesPubliquesSuspectes(source), [nom]);
    assert.throws(() => verifierAuDemarrage(source), /NEXT_PUBLIC/);
  }
});

test("la cle publique du fournisseur nest pas signalee a tort", () => {
  const source = {
    ...BASE_VALIDE,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clef-publique-assumee",
  };
  assert.deepEqual(clesPubliquesSuspectes(source), []);
  assert.doesNotThrow(() => verifierAuDemarrage(source));
});

test("un groupe incomplet rend sa fonction indisponible, sans empecher le demarrage", () => {
  assert.doesNotThrow(() => verifierAuDemarrage(BASE_VALIDE));

  assert.equal(groupeUtilisable("base", BASE_VALIDE), true);
  assert.equal(groupeUtilisable("worker", BASE_VALIDE), false);
  assert.equal(groupeUtilisable("donnees", BASE_VALIDE), false);

  const etat = diagnostiquer(BASE_VALIDE);
  assert.equal(etat.demarrable, true);
  assert.ok(etat.groupes.some((groupe) => !groupe.complet), "des fonctions restent indisponibles");
});

test("le diagnostic nexpose aucune valeur", () => {
  const secret = "cle-privilegiee-qui-ne-doit-pas-sortir";
  const etat = diagnostiquer({
    ...BASE_VALIDE,
    SUPABASE_SECRET_KEY: secret,
    WORKER_DATABASE_URL: "postgres://utilisateur:mot-de-passe-bdd@hote/base",
  });

  const serialise = JSON.stringify(etat);
  assert.ok(!serialise.includes(secret));
  assert.ok(!serialise.includes("mot-de-passe-bdd"));
});

test("une cle de chiffrement de session mal formee est signalee comme invalide", () => {
  const source = {
    ...BASE_VALIDE,
    SESSION_ENCRYPTION_KEY: "trop-courte",
  };

  const etat = diagnostiquer(source);
  const sessions = etat.groupes.find((groupe) => groupe.groupe === "sessions")!;
  assert.equal(sessions.complet, false);
  assert.deepEqual(sessions.invalides, ["SESSION_ENCRYPTION_KEY"]);
  assert.deepEqual(sessions.manquantes, [], "presente mais invalide : la nuance compte");
});

test("un deploiement d apercu accepte sa propre origine, la production non", () => {
  // Trouve en recette : l adresse d une Preview Vercel est tiree au hasard a
  // chaque commit, donc absente d APP_ORIGIN. Sans exception, le garde-fou CSRF
  // refusait TOUTE mutation sur une Preview — et la recette avant fusion, qui
  // est tout l interet d une Preview, devenait impossible.
  const preview = "https://study-6tamfjkpd-exemple.vercel.app";
  const canonique = "https://avecstudy.test";

  // Production : seule l origine canonique passe.
  assert.deepEqual(
    originesAutorisees(preview, { APP_ORIGIN: canonique, VERCEL_ENV: "production" }),
    [canonique],
    "en production, l origine du deploiement n est pas acceptee",
  );

  // Apercu : l origine canonique ET celle du deploiement.
  assert.deepEqual(
    originesAutorisees(preview, { APP_ORIGIN: canonique, VERCEL_ENV: "preview" }),
    [canonique, preview],
  );

  // L exception ne vaut que pour l origine du deploiement lui-meme : une
  // origine tierce n est jamais acceptee, meme en apercu.
  const acceptees = originesAutorisees(preview, {
    APP_ORIGIN: canonique,
    VERCEL_ENV: "preview",
  });
  assert.equal(
    acceptees.includes("https://site-malveillant.test"),
    false,
    "une origine tierce reste refusee en apercu",
  );

  // Hors Vercel, rien ne change.
  assert.deepEqual(originesAutorisees(preview, { APP_ORIGIN: canonique }), [canonique]);

  // Sans origine de requete, l exception ne s applique pas.
  assert.deepEqual(
    originesAutorisees(null, { APP_ORIGIN: canonique, VERCEL_ENV: "preview" }),
    [canonique],
  );
});

test("une mutation d apercu est acceptee par verifierMutation", () => {
  const preview = "https://study-6tamfjkpd-exemple.vercel.app";
  const acceptees = originesAutorisees(preview, {
    APP_ORIGIN: "https://avecstudy.test",
    VERCEL_ENV: "preview",
  });

  const requete: RequeteAVerifier = {
    methode: "POST",
    origine: preview,
    referer: null,
    fetchSite: "same-origin",
    fetchMode: "cors",
    jetonEnvoye: "jeton-identique",
    jetonCookie: "jeton-identique",
  };

  assert.equal(verifierMutation(requete, acceptees).accepte, true);

  // La meme requete venue d ailleurs reste refusee.
  const etrangere: RequeteAVerifier = { ...requete, origine: "https://ailleurs.test" };
  assert.equal(verifierMutation(etrangere, acceptees).accepte, false);
});

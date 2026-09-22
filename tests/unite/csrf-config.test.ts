// =============================================================================
// Tests unitaires — protection des mutations (WEB-03) et configuration (ch. 40).
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  estMutation,
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
  return {
    methode: "POST",
    origine: ORIGINE,
    referer: null,
    fetchSite: "same-origin",
    fetchMode: "cors",
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

test("une mutation legitime passe", () => {
  const verdict = verifierMutation(requete(), [ORIGINE]);
  assert.equal(verdict.accepte, true);
});

test("une mutation venue dun autre site est refusee d emblee", () => {
  const verdict = verifierMutation(
    requete({ fetchSite: "cross-site", origine: "https://attaquant.test" }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, false);
  assert.equal(verdict.motif, "contexte_suspect");
});

test("une origine etrangere est refusee, Fetch Metadata absent ou non", () => {
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

test("F-06 — une requete qui ne presente rien du tout est refusee", () => {
  // Le cas reproduit en production le 23 septembre 2026 : un POST sans
  // `Origin` ni `Sec-Fetch-Site` franchissait la barriere (HTTP 200), parce
  // que le proxy portait sa propre copie, plus indulgente, de cette regle.
  // La fonction, elle, disait deja non — et personne ne l appelait.
  const verdict = verifierMutation(
    requete({ origine: null, referer: null, fetchSite: null, fetchMode: null }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, false);
  assert.equal(verdict.motif, "origine_absente");
});

test("un navigateur qui affirme same-origin est cru, meme sans Origin", () => {
  // Contrepartie du test precedent, et elle compte autant : certains POST de
  // formulaire n emportent pas `Origin`. `Sec-Fetch-Site` est pose par le
  // navigateur lui-meme, hors de portee de la page appelante : refuser ce cas
  // casserait des envois legitimes sans rien fermer.
  const verdict = verifierMutation(
    requete({ origine: null, referer: null, fetchSite: "same-origin", fetchMode: "navigate" }),
    [ORIGINE],
  );
  assert.equal(verdict.accepte, true);
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
  };

  assert.equal(verifierMutation(requete, acceptees).accepte, true);

  // La meme requete venue d ailleurs reste refusee.
  const etrangere: RequeteAVerifier = { ...requete, origine: "https://ailleurs.test" };
  assert.equal(verifierMutation(etrangere, acceptees).accepte, false);
});

/* -------------------------------------------------------------------------- */
/* Le domaine canonique declare par l hebergeur                               */
/*                                                                            */
/* Ces tests viennent d une panne reelle : en production, APP_ORIGIN ne        */
/* correspondait pas a l adresse reellement servie, et TOUTES les mutations    */
/* etaient refusees — formulaire de devis compris. Rien ne le signalait : la   */
/* compilation passait, les tests locaux passaient, la page d accueil          */
/* repondait 200.                                                             */
/* -------------------------------------------------------------------------- */

test("le domaine canonique de l hebergeur est accepte, en plus d APP_ORIGIN", () => {
  const acceptees = originesAutorisees(null, {
    APP_ORIGIN: "https://avecstudy.test",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "etude.vercel.app",
  });

  assert.deepEqual(acceptees, ["https://avecstudy.test", "https://etude.vercel.app"]);
});

test("il suffit a lui seul quand APP_ORIGIN manque ou se trompe", () => {
  // Le cas constate : APP_ORIGIN pointe ailleurs, le site repond quand meme.
  const acceptees = originesAutorisees(null, {
    APP_ORIGIN: "http://localhost:3100",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "etude.vercel.app",
  });

  const requete: RequeteAVerifier = {
    methode: "POST",
    origine: "https://etude.vercel.app",
    referer: null,
    fetchSite: "same-origin",
    fetchMode: "cors",
  };

  assert.equal(verifierMutation(requete, acceptees).accepte, true);
});

test("il ne vient jamais de la requete : une origine tierce reste refusee", () => {
  const acceptees = originesAutorisees("https://attaquant.test", {
    APP_ORIGIN: "https://avecstudy.test",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "etude.vercel.app",
  });

  assert.ok(!acceptees.includes("https://attaquant.test"));

  const requete: RequeteAVerifier = {
    methode: "POST",
    origine: "https://attaquant.test",
    referer: null,
    fetchSite: null,
    fetchMode: null,
  };

  assert.equal(verifierMutation(requete, acceptees).motif, "origine_etrangere");
});

test("une valeur d hebergeur illisible est ignoree, pas devinee", () => {
  assert.deepEqual(
    originesAutorisees(null, {
      APP_ORIGIN: "https://avecstudy.test",
      VERCEL_PROJECT_PRODUCTION_URL: "pas une url du tout",
    }),
    ["https://avecstudy.test"],
  );

  assert.deepEqual(
    originesAutorisees(null, { VERCEL_PROJECT_PRODUCTION_URL: "" }),
    [],
  );
});

test("le protocole est ajoute quand l hebergeur donne un domaine nu", () => {
  assert.deepEqual(
    originesAutorisees(null, { VERCEL_PROJECT_PRODUCTION_URL: "etude.vercel.app" }),
    ["https://etude.vercel.app"],
  );

  // Et une valeur deja complete n est pas doublee.
  assert.deepEqual(
    originesAutorisees(null, { VERCEL_PROJECT_PRODUCTION_URL: "https://etude.vercel.app" }),
    ["https://etude.vercel.app"],
  );
});

#!/usr/bin/env node
// =============================================================================
// La recette complète — `npm run recette:complete`
//
// Une seule commande, qui répond à une seule question : **peut-on livrer ?**
//
// Elle enchaîne ce qui existe déjà — tests unitaires, tests RLS, recette
// réelle contre la base de production, vérifications du site déployé, tests
// navigateur — et garantit une chose que ces outils, pris séparément, ne
// garantissaient pas : qu'il ne reste rien en production quand elle se
// termine, quelle que soit la façon dont elle se termine.
//
// Trois principes.
//
// **Le nettoyage est dans un `finally`.** Une interruption, une erreur, un
// `Ctrl-C` : le balai passe quand même. C'est la différence entre une recette
// et une pollution.
//
// **Un nettoyage muet est un échec.** Le balai vérifie ce qu'il a supprimé et
// signale ce qui résiste. La recette ressort alors en état CRITIQUE, même si
// tous les contrôles fonctionnels étaient au vert : laisser des comptes en
// production est plus grave qu'un test rouge.
//
// **Rien n'est déclaré réussi sans avoir été joué.** Une étape qui ne peut pas
// s'exécuter est annoncée « non jouée », jamais comptée comme un succès.
// =============================================================================

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";
import { residuDeRecette } from "./nettoyage.mjs";

chargerEnv();

/**
 * Le marqueur de cette exécution.
 *
 * Daté et suffixé : daté pour qu'un résidu se rattache à un jour précis quand
 * on le retrouve des semaines plus tard, suffixé pour que deux recettes
 * lancées le même jour ne se marchent pas dessus.
 */
const JOUR = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const MARQUEUR = `RECETTE_${JOUR}_${randomBytes(3).toString("hex").toUpperCase()}`;

const CIBLE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");

const etapes = [];

function noter(nom, etat, detail = "") {
  etapes.push({ nom, etat, detail });
  const pastille = { ok: "  ok   ", echec: "  ECHEC", absent: "  (non joue)" }[etat];
  console.log(`${pastille} ${nom}${detail ? ` — ${detail}` : ""}`);
}

/** Lance une commande npm et rend son code de sortie, sans jamais jeter. */
function lancer(nom, arguments_) {
  return new Promise((resoudre) => {
    // On évite le shell : lui passer des arguments les concatène sans les
    // échapper, et l'habitude finit toujours par rencontrer une chaîne venue
    // d'ailleurs.
    //
    // Mais on ne peut pas non plus lancer `npm.cmd` directement : depuis
    // Node 20, exécuter un `.cmd` sans shell est refusé (EINVAL), précisément
    // à cause de ce risque d'injection. La bonne porte est le CLI de npm en
    // JavaScript, que npm expose dans `npm_execpath` — on l'exécute avec le
    // même Node, sans shell du tout.
    const cliNpm = process.env.npm_execpath;
    const parJavaScript = typeof cliNpm === "string" && cliNpm.endsWith(".js");

    const processus = parJavaScript
      ? spawn(process.execPath, [cliNpm, "run", ...arguments_], {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, RECETTE_MARQUEUR: MARQUEUR },
        })
      : spawn("npm", ["run", ...arguments_], {
          stdio: ["ignore", "pipe", "pipe"],
          shell: process.platform === "win32",
          env: { ...process.env, RECETTE_MARQUEUR: MARQUEUR },
        });

    let sortie = "";
    processus.stdout.on("data", (bloc) => (sortie += bloc));
    processus.stderr.on("data", (bloc) => (sortie += bloc));

    processus.on("close", (code) => resoudre({ code: code ?? 1, sortie, nom }));
    processus.on("error", (erreur) => resoudre({ code: 1, sortie: erreur.message, nom }));
  });
}

/**
 * Ce qu'il faut retenir d'une sortie : d'abord ce qui a échoué.
 *
 * Garder seulement la dernière ligne donnait « 2 defaut(s) » sans jamais dire
 * lesquels : il fallait rejouer la suite à la main pour le savoir. Un rapport
 * qui oblige à refaire le travail pour être compris n'est pas un rapport.
 */
function resume(sortie) {
  const lignes = sortie.split(/\r?\n/).map((ligne) => ligne.trim());

  const fautes = lignes.filter(
    (ligne) => ligne.startsWith("NON ") || ligne.startsWith("ECHEC") || ligne.includes("CRITIQUE"),
  );
  if (fautes.length > 0) {
    const tete = fautes.slice(0, 4).join(" | ");
    const reste = fautes.length > 4 ? ` (+${fautes.length - 4})` : "";
    return `${tete}${reste}`.slice(0, 600);
  }

  const utiles = lignes.filter((ligne) => ligne !== "");
  return utiles.slice(-1)[0]?.slice(0, 120) ?? "";
}

/* -------------------------------------------------------------------------- */

titre(`AvecStudy — recette complete\n${MARQUEUR}`);
console.log(CIBLE === "" ? "cible : aucune (SITE_BASE absente)" : `cible : ${CIBLE}`);

let critique = false;

try {
  console.log("\n1. Ce qui se verifie sans reseau");

  for (const [nom, script] of [
    ["types", "typecheck"],
    ["style", "lint"],
    ["tests unitaires", "test:unite"],
    ["tests RLS sur PostgreSQL reel", "test:rls"],
  ]) {
    const resultat = await lancer(nom, [script]);
    noter(nom, resultat.code === 0 ? "ok" : "echec", resultat.code === 0 ? "" : resume(resultat.sortie));
  }

  console.log("\n2. Contre la base de production");

  const reelle = await lancer("recette reelle", ["recette:reelle"]);
  noter(
    "parcours complet, joue et nettoye",
    reelle.code === 0 ? "ok" : "echec",
    resume(reelle.sortie),
  );
  if (/CRITIQUE/.test(reelle.sortie)) critique = true;

  console.log("\n3. Contre le site deploye");

  if (CIBLE === "") {
    noter("verifications du site deploye", "absent", "SITE_BASE absente de l environnement");
  } else {
    // D'abord : **quel** code est servi. Tout ce qui suit ne vaut que pour ce
    // déploiement-là, et une vérification qui ne sait pas ce qu'elle mesure ne
    // vaut rien — c'est arrivé.
    const servi = await lancer("code servi", ["verifier:deploiement"]);
    noter(
      "l origine repond et la construction servie est identifiee",
      servi.code === 0 ? "ok" : "echec",
      resume(servi.sortie),
    );

    for (const [nom, script] of [
      ["balisage, SEO et CSP", "verifier:site"],
      ["landing conforme a la reference", "verifier:landing"],
      ["responsive public, clavier et cibles tactiles", "verifier:responsive"],
      ["parcours navigateur publics", "test:navigateur"],
    ]) {
      const resultat = await lancer(nom, [script]);
      noter(nom, resultat.code === 0 ? "ok" : "echec", resultat.code === 0 ? "" : resume(resultat.sortie));
    }

    // Les parcours connectés : le Studio, les devoirs, l'entraide, la case
    // « fait », les imports, les fichiers, le formulaire, le responsive des
    // espaces fermés. Ils bâtissent et démontent leur propre terrain.
    const connectee = await lancer("parcours connectes", ["recette:connectee"]);
    noter(
      "parcours connectes (§1 a §8)",
      connectee.code === 0 ? "ok" : "echec",
      resume(connectee.sortie),
    );
    if (/CRITIQUE/.test(connectee.sortie)) critique = true;

    // Les formes de requête : elles ne se voient pas sous PGlite, qui n'a pas
    // PostgREST. Trois fonctionnalités ont rendu une liste vide sans rien dire
    // avant que ce contrôle existe.
    const requetes = await lancer("formes de requete", ["verifier:requetes"]);
    noter(
      "les requetes du produit restent resolvables",
      requetes.code === 0 ? "ok" : "echec",
      resume(requetes.sortie),
    );

    // La matrice des promesses : une page publique est un engagement, et une
    // promesse sans scenario reussi ne doit pas pouvoir rester en ligne.
    const promesses = await lancer("matrice des promesses", ["verifier:promesses"]);
    noter(
      "chaque promesse publique a un scenario qui la joue",
      promesses.code === 0 ? "ok" : "echec",
      resume(promesses.sortie),
    );

    const journal = await lancer("journal d audit", ["verifier:journal"]);
    noter(
      "le journal d audit ne porte aucun secret et reste immuable",
      journal.code === 0 ? "ok" : "echec",
      resume(journal.sortie),
    );
  }
} finally {
  // Le balai passe quoi qu'il arrive : interruption, erreur, ou succes.
  console.log("\n4. Nettoyage (execute meme en cas d interruption)");

  const balai = await lancer("balai", ["recette:balai", "--", "--appliquer"]);
  const restait = /etablissement\(s\) de recette|demande\(s\) de recette/.test(balai.sortie);

  if (balai.code !== 0) {
    critique = true;
    noter("production rendue propre", "echec", resume(balai.sortie));
  } else {
    noter("production rendue propre", "ok", restait ? "des traces subsistaient, elles ont ete balayees" : "rien a balayer");
  }

  // Le seau d'objets, que la base ne voit pas.
  //
  // « La production est propre » se disait jusqu'ici sans jamais avoir compare
  // le stockage a la base : dix-huit octets orphelins ont ainsi survecu a
  // plusieurs recettes declarees sans defaut. Un orphelin n'apparait dans aucun
  // ecran — personne ne peut donc le trouver, ni le supprimer, autrement qu'ici.
  //
  // `--ramasser` ne retire que ce qui a plus de deux heures et qu'aucune ligne
  // ne designe : un depot en cours n'est pas un orphelin, et effacer pendant
  // qu'on ecrit est la meilleure facon de creer le probleme qu'on evitait.
  const stockage = await lancer("stockage", ["verifier:stockage", "--", "--ramasser"]);
  noter(
    "le stockage et la base disent la meme chose",
    stockage.code === 0 ? "ok" : "echec",
    resume(stockage.sortie),
  );
  if (stockage.code !== 0) critique = true;

  // Et le dernier mot revient a la base, pas au script qui vient de nettoyer.
  const sql = new pg.Client({
    connectionString: process.env.WORKER_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    application_name: "recette-complete",
  });

  try {
    await sql.connect();
    const restes = await residuDeRecette(sql);

    const { rows } = await sql.query(`
      select
        (select count(*)::int from study.profiles)                                as profils,
        (select count(*)::int from study.organization_memberships)                as adhesions,
        -- Les sessions de recette : celles d un compte autre que l exploitant.
        -- La sienne n est pas un residu.
        (select count(*)::int from study_prive.sessions s
          where s.revoked_at is null
            and not exists (select 1 from study_prive.editor_staff e
                             where e.profile_id = s.profile_id))                  as sessions,
        (select count(*)::int from study.commercial_requests)                     as demandes
    `);

    console.log(
      `\n  etat final : ${rows[0].profils} profil(s), ${rows[0].adhesions} adhesion(s), ` +
        `${rows[0].sessions} session(s) vivante(s), ${rows[0].demandes} demande(s).`,
    );

    if (restes.length > 0) {
      critique = true;
      console.log("  CRITIQUE : il reste des traces de recette en production :");
      for (const reste of restes) console.log(`    - ${reste}`);
    }

    // Le compte exact du §12, vérifié par le script dédié : il connaît les
    // douze compteurs attendus, et il est le seul endroit où ils sont écrits.
    const final = await lancer("etat final", ["verifier:etat-final"]);
    if (final.code !== 0) {
      critique = true;
      console.log("  CRITIQUE : l etat final ne correspond pas a ce qui est attendu.");
      for (const ligne of final.sortie.split(/\r?\n/).filter((l) => l.includes("NON "))) {
        console.log(`    ${ligne.trim()}`);
      }
    } else {
      console.log("  etat final conforme : un seul compte, et rien d autre.");
    }
  } catch (erreur) {
    critique = true;
    console.log(`  CRITIQUE : l etat final n a pas pu etre verifie — ${erreur.message}`);
  } finally {
    await sql.end().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */

const echecs = etapes.filter((etape) => etape.etat === "echec");
const absents = etapes.filter((etape) => etape.etat === "absent");

console.log("\n" + "-".repeat(72));

if (critique) {
  console.log("CRITIQUE — la recette a laisse des traces, ou n a pas pu le verifier.");
  console.log("Ne pas livrer. Passer « npm run recette:balai -- --appliquer » et recommencer.");
  process.exitCode = 2;
} else if (echecs.length > 0) {
  console.log(`${echecs.length} etape(s) en echec :`);
  for (const etape of echecs) console.log(`  - ${etape.nom}`);
  process.exitCode = 1;
} else if (absents.length > 0) {
  console.log(`Aucun defaut, mais ${absents.length} etape(s) non jouee(s) :`);
  for (const etape of absents) console.log(`  - ${etape.nom} (${etape.detail})`);
  console.log("Une etape non jouee n est pas une etape reussie.");
  process.exitCode = 0;
} else {
  console.log("Recette complete : aucun defaut, et la production est propre.");
  process.exitCode = 0;
}

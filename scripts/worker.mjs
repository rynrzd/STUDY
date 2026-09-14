#!/usr/bin/env node
// =============================================================================
// Worker de traitements longs — chapitre 39.
//
// Prise atomique par study_prive.prendre_job (FOR UPDATE SKIP LOCKED), bail
// limité, battement de cœur, reprise après crash, nombre d'essais plafonné.
//
//   node scripts/worker.mjs                    tous les types
//   node scripts/worker.mjs --types import_eleves,analyse_fichier
//   node scripts/worker.mjs --une-fois         traite la file puis sort
//
// Chaque gestionnaire revérifie la portée et les conditions de l'opération : on
// ne fait jamais confiance au contenu du job pour décider d'un droit.
// =============================================================================

import { chargerEnv, titre, exiger, connecter } from "./_commun.mjs";

const TYPES_CONNUS = [
  "import_eleves",
  "import_enseignants",
  "analyse_fichier",
  "lot_pdf",
  "publication_differee",
  "purge",
  "notification",
  "rapprochement_facture",
];

const BAIL_SECONDES = 300;
const ATTENTE_FILE_VIDE_MS = 2000;

function lireArgument(nom) {
  const index = process.argv.indexOf(`--${nom}`);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

/**
 * Gestionnaires.
 *
 * Aucun n'est implémenté : les traitements dépendent du stockage et du
 * fournisseur d'identité, qui ne sont pas raccordés. Le worker le dit, marque
 * le job en échec avec un motif lisible, et ne le rejoue pas indéfiniment —
 * plutôt que de le déclarer terminé sans rien faire.
 */
const GESTIONNAIRES = {
  async import_eleves() {
    throw new Error("import de comptes : le fournisseur d'identite n'est pas raccorde");
  },
  async import_enseignants() {
    throw new Error("import de comptes : le fournisseur d'identite n'est pas raccorde");
  },
  async analyse_fichier() {
    throw new Error("analyse antivirus : aucun moteur d'analyse n'est configure");
  },
  async lot_pdf() {
    throw new Error("generation de lots PDF : non implementee");
  },
  async publication_differee() {
    throw new Error("publication differee : non implementee");
  },
  async purge() {
    throw new Error("purge : non implementee");
  },
  async notification() {
    throw new Error("notifications : le fournisseur d'email n'est pas raccorde");
  },
  async rapprochement_facture() {
    throw new Error("rapprochement de factures : la facturation n'est pas raccordee");
  },
};

let arretDemande = false;

async function traiter(client, job) {
  const gestionnaire = GESTIONNAIRES[job.kind];
  if (gestionnaire === undefined) {
    await echouer(client, job, `type de job inconnu : ${job.kind}`);
    return;
  }

  // Battement de cœur pendant le traitement : un job long ne doit pas voir son
  // bail expirer et être repris par un second worker.
  const battement = setInterval(() => {
    client
      .query(
        `update study_prive.jobs
            set heartbeat_at = now(), locked_until = now() + make_interval(secs => $2)
          where id = $1`,
        [job.id, BAIL_SECONDES],
      )
      .catch(() => {});
  }, (BAIL_SECONDES / 3) * 1000);

  try {
    await gestionnaire(client, job);
    await client.query(
      "update study_prive.jobs set state = 'termine', finished_at = now() where id = $1",
      [job.id],
    );
    console.log(`  [ok]     ${job.kind} ${job.id}`);
  } catch (erreur) {
    await echouer(client, job, erreur.message);
  } finally {
    clearInterval(battement);
  }
}

async function echouer(client, job, motif) {
  // Essais plafonnés : au-delà, le job est abandonné et devient visible dans
  // l'administration. Les erreurs n'entraînent pas une boucle de coût illimitée.
  const definitif = job.attempts >= job.max_attempts;
  await client.query(
    `update study_prive.jobs
        set state = $2,
            last_error = $3,
            finished_at = case when $2 = 'abandonne' then now() else null end,
            scheduled_at = case
              when $2 = 'echoue' then now() + make_interval(secs => least(300, power(2, attempts)::int * 10))
              else scheduled_at end,
            locked_until = null,
            locked_by = null
      where id = $1`,
    [job.id, definitif ? "abandonne" : "echoue", motif.slice(0, 500)],
  );
  console.log(`  [${definitif ? "abandon" : "echec"}] ${job.kind} ${job.id} — ${motif}`);
}

async function principal() {
  chargerEnv();
  exiger(["WORKER_DATABASE_URL"], "le worker a besoin d'un role SQL restreint sur la base.");

  const demandes = lireArgument("types");
  const types = demandes === null ? TYPES_CONNUS : demandes.split(",").map((t) => t.trim());
  const uneFois = process.argv.includes("--une-fois");
  const nom = `worker-${process.pid}`;

  titre(
    `study. — worker\n` +
    `identite : ${nom}\n` +
    `types    : ${types.join(", ")}\n` +
    `mode     : ${uneFois ? "file puis sortie" : "continu (Ctrl+C pour arreter)"}`,
  );

  const client = await connecter(process.env.WORKER_DATABASE_URL, { application: nom });
  // Le worker s'annonce : c'est cette session qui a le droit de déclarer un
  // fichier « propre » (ch. 38).
  await client.query("select set_config('study.worker', 'on', false)");

  const arreter = () => {
    if (arretDemande) process.exit(1);
    arretDemande = true;
    console.log("\nArret demande : le job en cours se termine avant la sortie.");
  };
  process.on("SIGINT", arreter);
  process.on("SIGTERM", arreter);

  let traites = 0;
  try {
    while (!arretDemande) {
      const resultat = await client.query(
        "select * from study_prive.prendre_job($1, $2, $3)",
        [types, nom, BAIL_SECONDES],
      );
      const job = resultat.rows[0];

      if (job === undefined || job.id === null) {
        if (uneFois) break;
        await new Promise((resoudre) => setTimeout(resoudre, ATTENTE_FILE_VIDE_MS));
        continue;
      }

      await traiter(client, job);
      traites += 1;
    }
  } finally {
    await client.end();
    console.log(`\n${traites} job(s) traite(s).`);
  }
}

principal().catch((erreur) => {
  console.error(`worker : ${erreur.message}`);
  process.exit(1);
});

#!/usr/bin/env node
// =============================================================================
// Application des migrations — chapitres 36 et 40.
//
//   node scripts/migrations.mjs --verifier    liste ce qui reste a appliquer
//   node scripts/migrations.mjs --appliquer   applique, une transaction par fichier
//
// Le script affiche TOUJOURS l'environnement vise et la liste du SQL a
// appliquer avant d'ecrire quoi que ce soit (ch. 36 §5). En production, il
// exige une confirmation explicite par variable, parce qu'une migration
// appliquee par megarde sur le projet des eleves ne se rattrape pas.
// =============================================================================

import { createHash } from "node:crypto";
import {
  chargerEnv, titre, exiger, abandonner, listerMigrations, lireSql, connecter,
} from "./_commun.mjs";

const TABLE_SUIVI = "study_migrations_appliquees";

async function assurerTableSuivi(client) {
  await client.query(`
    create table if not exists public.${TABLE_SUIVI} (
      nom          text primary key,
      empreinte    text not null,
      appliquee_le timestamptz not null default now()
    )
  `);
}

function empreinte(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex").slice(0, 16);
}

async function principal() {
  chargerEnv();

  const appliquer = process.argv.includes("--appliquer");
  const environnement = (process.env.APP_ENV ?? "(non defini)").trim();

  exiger(
    ["WORKER_DATABASE_URL"],
    "appliquer des migrations demande une connexion PostgreSQL.",
  );

  titre(
    `study. — migrations\n` +
    `environnement : ${environnement}\n` +
    `mode          : ${appliquer ? "APPLICATION" : "verification (aucune ecriture)"}`,
  );

  // Garde-fou : en production, il faut le dire deux fois.
  if (appliquer && environnement === "production" &&
      process.env.CONFIRMER_PRODUCTION !== "oui") {
    abandonner(
      "application en production sans confirmation. " +
        "Relancer avec CONFIRMER_PRODUCTION=oui apres avoir sauvegarde la base (ch. 36 §5).",
    );
  }

  const client = await connecter(process.env.WORKER_DATABASE_URL, {
    application: "study-migrations",
  });

  try {
    await assurerTableSuivi(client);
    const deja = await client.query(`select nom, empreinte from public.${TABLE_SUIVI}`);
    const connues = new Map(deja.rows.map((ligne) => [ligne.nom, ligne.empreinte]));

    const fichiers = listerMigrations();
    const aAppliquer = [];
    let modifiees = 0;

    for (const fichier of fichiers) {
      const sql = lireSql(fichier.chemin);
      const signature = empreinte(sql);
      const connue = connues.get(fichier.nom);

      if (connue === undefined) {
        aAppliquer.push({ ...fichier, sql, signature });
        console.log(`  [ a appliquer ] ${fichier.nom}`);
      } else if (connue !== signature) {
        modifiees += 1;
        console.log(`  [ MODIFIEE    ] ${fichier.nom} — deja appliquee sous une autre forme`);
      } else {
        console.log(`  [ deja        ] ${fichier.nom}`);
      }
    }

    if (modifiees > 0) {
      abandonner(
        `${modifiees} migration(s) deja appliquee(s) ont ete modifiees depuis. ` +
          "Une migration appliquee ne se reecrit pas : ajouter une migration corrective (ch. 40).",
      );
    }

    console.log("");
    if (aAppliquer.length === 0) {
      console.log("Rien a appliquer : le schema est a jour.");
      return;
    }

    if (!appliquer) {
      console.log(
        `${aAppliquer.length} migration(s) en attente. ` +
          "Relancer avec --appliquer pour ecrire.",
      );
      process.exitCode = 2;
      return;
    }

    for (const fichier of aAppliquer) {
      process.stdout.write(`  application de ${fichier.nom} … `);
      // Une transaction par fichier : une migration qui echoue ne laisse pas
      // le schema a moitie applique.
      await client.query("begin");
      try {
        await client.query(fichier.sql);
        await client.query(
          `insert into public.${TABLE_SUIVI} (nom, empreinte) values ($1, $2)`,
          [fichier.nom, fichier.signature],
        );
        await client.query("commit");
        console.log("ok");
      } catch (erreur) {
        await client.query("rollback");
        console.log("ECHEC");
        abandonner(`${fichier.nom} : ${erreur.message}`);
      }
    }

    console.log(`\n${aAppliquer.length} migration(s) appliquee(s).`);
  } finally {
    await client.end();
  }
}

principal().catch((erreur) => {
  console.error(`migrations : ${erreur.message}`);
  process.exit(1);
});

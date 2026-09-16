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

/**
 * Empreinte d'une migration.
 *
 * Les fins de ligne sont normalisees avant le calcul. Sans cela, l'empreinte
 * n'est pas celle du SQL mais celle de la copie de travail : un `git checkout`
 * sur une machine ou `core.autocrlf` est actif reecrit les fichiers en CRLF, et
 * toutes les migrations deja appliquees passent d'un coup pour « modifiees ».
 * C'est arrive, et le diagnostic couteux valait cette ligne.
 */
function empreinte(sql) {
  return createHash("sha256")
    .update(sql.replaceAll("\r\n", "\n"), "utf8")
    .digest("hex")
    .slice(0, 16);
}

/** L'ancienne empreinte, sensible aux fins de ligne. Sert au re-scellement. */
function empreinteHeritee(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex").slice(0, 16);
}

/**
 * Le fichier porte-t-il le meme SQL que ce qui a ete applique, aux fins de
 * ligne pres ? On compare l'empreinte stockee a l'ancienne formule, appliquee
 * aux deux formes possibles du fichier. Si l'une correspond, le SQL est
 * identique et seule la forme a bouge.
 */
function estLaMemeAuxFinsDeLignePres(sql, empreinteStockee) {
  const enLf = sql.replaceAll("\r\n", "\n");
  const enCrlf = enLf.replaceAll("\n", "\r\n");
  return (
    empreinteStockee === empreinteHeritee(enLf) ||
    empreinteStockee === empreinteHeritee(enCrlf)
  );
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
    `AvecStudy — migrations\n` +
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
    const aResceller = [];
    let modifiees = 0;

    for (const fichier of fichiers) {
      const sql = lireSql(fichier.chemin);
      const signature = empreinte(sql);
      const connue = connues.get(fichier.nom);

      if (connue === undefined) {
        aAppliquer.push({ ...fichier, sql, signature });
        console.log(`  [ a appliquer ] ${fichier.nom}`);
      } else if (connue === signature) {
        console.log(`  [ deja        ] ${fichier.nom}`);
      } else if (estLaMemeAuxFinsDeLignePres(sql, connue)) {
        // Le SQL est le meme, seule la forme du fichier a change. On re-scelle
        // au lieu d'exiger une migration corrective qui ne corrigerait rien.
        aResceller.push({ nom: fichier.nom, signature });
        console.log(`  [ re-scellee  ] ${fichier.nom} — meme SQL, fins de ligne differentes`);
      } else {
        modifiees += 1;
        console.log(`  [ MODIFIEE    ] ${fichier.nom} — deja appliquee sous une autre forme`);
      }
    }

    if (aResceller.length > 0) {
      if (!appliquer) {
        console.log(
          `
${aResceller.length} migration(s) a re-sceller (meme SQL, autre forme de fichier). ` +
            "Relancer avec --appliquer pour mettre le suivi a jour.",
        );
      } else {
        for (const ligne of aResceller) {
          await client.query(
            `update public.${TABLE_SUIVI} set empreinte = $2 where nom = $1`,
            [ligne.nom, ligne.signature],
          );
        }
        console.log(`
${aResceller.length} empreinte(s) mise(s) a jour dans le suivi.`);
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

    // PostgREST garde en memoire un cache du schema. Sans ce signal, une
    // fonction ou une table creee a l instant lui reste invisible, avec un
    // message trompeur : « Could not find the function ... in the schema
    // cache ». On le previent systematiquement, meme si une migration l a
    // deja fait : le signal est idempotent.
    await client.query("notify pgrst, 'reload schema'");
    await client.query("notify pgrst, 'reload config'");

    console.log(`\n${aAppliquer.length} migration(s) appliquee(s).`);
    console.log("PostgREST a ete prevenu de relire le schema.");
  } finally {
    await client.end();
  }
}

principal().catch((erreur) => {
  console.error(`migrations : ${erreur.message}`);
  process.exit(1);
});

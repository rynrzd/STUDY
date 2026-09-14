#!/usr/bin/env node
// =============================================================================
// Jeu de recette — chapitre 36 §4.
//
// « Le script seed ne contient que des données fictives et refuse la
// production. » Ce refus n'est pas une politesse : c'est la seule chose qui
// empêche de déverser des « Camille Petit » fictifs dans le lycée d'un client.
//
//   node scripts/seed-test.mjs
// =============================================================================

import path from "node:path";
import {
  RACINE, chargerEnv, titre, exiger, abandonner, refuserProduction, lireSql, connecter,
} from "./_commun.mjs";

async function principal() {
  chargerEnv();

  const environnement = refuserProduction("charger le jeu de recette");
  exiger(["WORKER_DATABASE_URL"], "charger le jeu de recette demande une connexion PostgreSQL.");

  titre(
    `study. — jeu de recette (donnees entierement fictives)\n` +
    `environnement : ${environnement}`,
  );

  const client = await connecter(process.env.WORKER_DATABASE_URL, { application: "study-seed" });

  try {
    // Deuxième garde-fou, côté données : si la base contient des personnes qui
    // ne viennent pas du jeu de recette, on s'arrête. Un environnement
    // « recette » mal étiqueté reste possible ; des comptes inconnus, non.
    const compte = await client.query(`
      select count(*)::int as n
        from study.profiles
       where professional_email is null
          or professional_email not like '%@exemple-recette.test'
    `);

    if (compte.rows[0].n > 0) {
      abandonner(
        `la base contient ${compte.rows[0].n} personne(s) hors du jeu de recette. ` +
          "Le seed ne s'applique que sur une base jetable.",
      );
    }

    const sql = lireSql(path.join(RACINE, "supabase", "seed", "seed_recette.sql"));
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");

    const resume = await client.query(`
      select
        (select count(*) from study.organizations)             as lycees,
        (select count(*) from study.classes)                   as classes,
        (select count(*) from study.profiles)                  as personnes,
        (select count(*) from study.lessons)                   as seances
    `);
    const ligne = resume.rows[0];
    console.log(
      `Charge : ${ligne.lycees} lycees, ${ligne.classes} classes, ` +
        `${ligne.personnes} personnes fictives, ${ligne.seances} seances.`,
    );
    console.log("Aucune de ces personnes n'existe. Ne jamais appliquer ailleurs qu'en recette.");
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    abandonner(erreur.message);
  } finally {
    await client.end();
  }
}

principal().catch((erreur) => {
  console.error(`seed : ${erreur.message}`);
  process.exit(1);
});

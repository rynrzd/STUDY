#!/usr/bin/env node
// =============================================================================
// Provisionnement des buckets — chapitre 36 §7.
//
// « Les buckets étant aussi de la configuration/donnée, leur existence doit
// être provisionnée par un script idempotent, pas simplement supposée à partir
// des migrations de tables. »
//
//   node scripts/provisionner-buckets.mjs --verifier
//   node scripts/provisionner-buckets.mjs --appliquer
//
// La liste de référence vit dans study.storage_buckets_attendus : une seule
// source, lue par ce script comme par la recette.
// =============================================================================

import { chargerEnv, titre, exiger, abandonner, connecter } from "./_commun.mjs";

async function principal() {
  chargerEnv();

  const appliquer = process.argv.includes("--appliquer");

  exiger(
    ["WORKER_DATABASE_URL"],
    "lire la liste des buckets attendus demande une connexion PostgreSQL.",
  );

  titre(
    `AvecStudy — buckets de stockage\n` +
    `mode : ${appliquer ? "APPLICATION" : "verification (aucune ecriture)"}`,
  );

  const client = await connecter(process.env.WORKER_DATABASE_URL, {
    application: "study-buckets",
  });

  let attendus;
  try {
    const resultat = await client.query(
      `select nom, public, taille_max_octets, types_autorises, description
         from study.storage_buckets_attendus order by nom`,
    );
    attendus = resultat.rows;
  } finally {
    await client.end();
  }

  console.log("Buckets attendus, tous prives :\n");
  for (const bucket of attendus) {
    const mo = Math.round(Number(bucket.taille_max_octets) / (1024 * 1024));
    console.log(`  ${bucket.nom}`);
    console.log(`    prive            : ${bucket.public ? "NON — anomalie" : "oui"}`);
    console.log(`    taille max       : ${mo} Mo par fichier`);
    console.log(`    types autorises  : ${bucket.types_autorises.length} type(s)`);
    console.log(`    role             : ${bucket.description}`);
    console.log("");
  }

  const publics = attendus.filter((bucket) => bucket.public);
  if (publics.length > 0) {
    abandonner(
      `${publics.length} bucket(s) declare(s) publics. ` +
        "Aucun bucket de AvecStudy ne doit etre public (ch. 38).",
    );
  }

  if (!appliquer) {
    console.log("Verification seule : rien n'a ete cree.");
    return;
  }

  exiger(
    ["SUPABASE_URL", "SUPABASE_SECRET_KEY"],
    "creer les buckets demande l'API d'administration du fournisseur de stockage.",
  );

  abandonner(
    "le fournisseur de stockage n'est pas raccorde. " +
      "La creation des buckets, de leurs limites et de leurs politiques d'acces se fera " +
      "par cette commande une fois le projet ouvert ; elle est idempotente par conception. " +
      "Ne jamais resoudre un echec d'acces en passant un bucket en public (ch. 38).",
  );
}

principal().catch((erreur) => {
  console.error(`buckets : ${erreur.message}`);
  process.exit(1);
});

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

  await creerBuckets(attendus);
}

/**
 * Crée ou met à jour les buckets chez le fournisseur.
 *
 * Idempotent par conception : un bucket déjà présent est mis à jour, jamais
 * recréé — le recréer supprimerait les fichiers qu'il contient.
 *
 * Un bucket existant trouvé **public** est ramené en privé et signalé. C'est le
 * seul cas où ce script modifie une configuration sans qu'on la lui demande :
 * un bucket de copies d'élèves ouvert au public est un incident, pas une
 * préférence (ch. 38).
 */
async function creerBuckets(attendus) {
  const base = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SECRET_KEY;

  const entetes = {
    apikey: cle,
    authorization: `Bearer ${cle}`,
    "content-type": "application/json",
  };

  const existants = await lireExistants(base, entetes);

  let crees = 0;
  let ajustes = 0;
  let inchanges = 0;
  /** Buckets dont la limite déclarée dépasse le plafond du projet. */
  const plafonnes = [];

  for (const bucket of attendus) {
    const corps = {
      id: bucket.nom,
      name: bucket.nom,
      public: false,
      file_size_limit: Number(bucket.taille_max_octets),
      allowed_mime_types: bucket.types_autorises,
    };

    const present = existants.get(bucket.nom);

    if (present === undefined) {
      let reponse = await fetch(new URL("/storage/v1/bucket", base), {
        method: "POST",
        headers: entetes,
        body: JSON.stringify(corps),
      });

      // Le plan du projet plafonne la taille des objets. Une limite de bucket
      // au-dessus de ce plafond est refusee. On cree alors le bucket sans
      // limite propre — il herite du plafond du projet — et on le DIT, plutot
      // que de laisser croire que la valeur declaree est appliquee.
      if (!reponse.ok) {
        const detail = await reponse.text();

        if (detail.includes("EntityTooLarge") || detail.includes("exceeded the maximum")) {
          plafonnes.push(bucket);
          reponse = await fetch(new URL("/storage/v1/bucket", base), {
            method: "POST",
            headers: entetes,
            body: JSON.stringify({ ...corps, file_size_limit: null }),
          });
        }

        if (!reponse.ok) {
          const second = await reponse.text();
          abandonner(
            `creation du bucket ${bucket.nom} refusee (HTTP ${reponse.status}) : ${second}`,
          );
        }
      }

      console.log(`  cree     ${bucket.nom}`);
      crees += 1;
      continue;
    }

    const conforme =
      present.public === false &&
      Number(present.file_size_limit) === Number(bucket.taille_max_octets) &&
      memesTypes(present.allowed_mime_types, bucket.types_autorises);

    if (conforme) {
      console.log(`  conforme ${bucket.nom}`);
      inchanges += 1;
      continue;
    }

    if (present.public === true) {
      console.log(`  ALERTE   ${bucket.nom} etait PUBLIC — remis en prive`);
    }

    const reponse = await fetch(new URL(`/storage/v1/bucket/${bucket.nom}`, base), {
      method: "PUT",
      headers: entetes,
      body: JSON.stringify({
        public: false,
        file_size_limit: Number(bucket.taille_max_octets),
        allowed_mime_types: bucket.types_autorises,
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      abandonner(`mise a jour du bucket ${bucket.nom} refusee (HTTP ${reponse.status}) : ${detail}`);
    }

    console.log(`  ajuste   ${bucket.nom}`);
    ajustes += 1;
  }

  console.log(`\n${crees} cree(s), ${ajustes} ajuste(s), ${inchanges} deja conforme(s).`);

  if (plafonnes.length > 0) {
    console.log("\nLimites declarees NON appliquees, plafonnees par le plan du projet :");
    for (const bucket of plafonnes) {
      const mo = Math.round(Number(bucket.taille_max_octets) / (1024 * 1024));
      console.log(`  ${bucket.nom} : ${mo} Mo demandes, plafond du projet applique a la place.`);
    }
    console.log(
      "\nCes buckets existent et restent prives ; seule leur limite par fichier\n" +
        "differe de ce que declare study.storage_buckets_attendus. Deux sorties :\n" +
        "  - relever le plafond du projet (Settings > Storage) ;\n" +
        "  - ou abaisser la valeur declaree par une migration, pour que la base\n" +
        "    et le fournisseur disent la meme chose.",
    );
  }

  // Aucun bucket hors liste ne doit traîner : un bucket oublié est un endroit
  // où des fichiers vivent sans que personne n'en surveille les accès.
  const attendusNoms = new Set(attendus.map((b) => b.nom));
  const enTrop = [...existants.keys()].filter((nom) => !attendusNoms.has(nom));

  if (enTrop.length > 0) {
    console.log(
      `\nBuckets presents mais hors liste : ${enTrop.join(", ")}.\n` +
        "Ce script ne les supprime pas — supprimer un bucket supprime ses fichiers.\n" +
        "Les traiter a la main apres avoir verifie ce qu'ils contiennent.",
    );
  }
}

async function lireExistants(base, entetes) {
  const reponse = await fetch(new URL("/storage/v1/bucket", base), { headers: entetes });

  if (!reponse.ok) {
    const detail = await reponse.text();
    abandonner(
      `le fournisseur de stockage a refuse la lecture des buckets (HTTP ${reponse.status}) : ${detail}`,
    );
  }

  const liste = await reponse.json();
  return new Map(liste.map((bucket) => [bucket.name ?? bucket.id, bucket]));
}

function memesTypes(presents, attendus) {
  if (!Array.isArray(presents)) return false;
  if (presents.length !== attendus.length) return false;
  const a = [...presents].sort();
  const b = [...attendus].sort();
  return a.every((valeur, index) => valeur === b[index]);
}

principal().catch((erreur) => {
  console.error(`buckets : ${erreur.message}`);
  process.exit(1);
});

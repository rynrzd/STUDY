#!/usr/bin/env node
// =============================================================================
// Le balai — `npm run recette:balai`
//
// Une recette interrompue (coupure réseau, fenêtre fermée, processus tué)
// laisse derrière elle un établissement et des comptes. Personne ne les
// cherchera : ils ne gênent rien, et c'est précisément le problème — ils
// s'accumulent jusqu'au jour où l'on ne sait plus lesquels sont réels.
//
// Ce script ne supprime que ce qui est **marqué comme recette** : un code
// d'établissement commençant par `RECETTE`, une demande adressée à
// `exemple.invalid`, ou un compte de connexion que plus aucune ligne de la
// base ne désigne. Il ne cible jamais un compte par son prénom ni par son
// rôle.
//
// Par défaut il n'écrit rien et se contente de dire ce qu'il trouve. Il faut
// `--appliquer` pour qu'il agisse.
//
// **Il ne sort jamais en plein vol.** `process.exit()` coupe court alors qu'une
// requête HTTP garde un socket ouvert, et libuv y répond sur Windows par une
// assertion : le script meurt avec un code non nul après avoir pourtant fini
// son travail. La recette ressortait alors CRITIQUE sur un nettoyage réussi —
// un outil qui déclare un échec après avoir réussi fait recommencer pour rien.
// =============================================================================

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { chargerEnv, titre } from "../_commun.mjs";
import {
  demonterComptesOrphelins,
  demonterDemandes,
  demonterEtablissement,
  demonterProfils,
  residuDeRecette,
} from "./nettoyage.mjs";

chargerEnv();

const APPLIQUER = process.argv.includes("--appliquer");

titre("AvecStudy — balai de recette");
console.log(APPLIQUER ? "mode : SUPPRESSION" : "mode : inventaire (ajouter --appliquer pour agir)");

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "avecstudy-balai",
});

const fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

/**
 * Les comptes de connexion que plus aucune ligne ne rattache.
 *
 * Trois conditions, toutes structurelles : aucun profil, pas de qualité
 * d'exploitant, plus de deux heures. Jamais un prénom, jamais un rôle. Le
 * délai protège un compte en cours de provision — la création écrit le compte
 * puis le profil, et supprimer entre les deux créerait le problème qu'on
 * cherche à éviter.
 */
async function comptesOrphelins() {
  const { data, error } = await fournisseur.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error !== null || data === null) return null;

  const { rows: connus } = await sql.query("select id from study.profiles");
  const { rows: duSite } = await sql.query("select profile_id from study_prive.editor_staff");

  const avecProfil = new Set(connus.map((ligne) => ligne.id));
  const exploitants = new Set(duSite.map((ligne) => ligne.profile_id));
  const veille = Date.now() - 2 * 60 * 60 * 1000;

  return data.users.filter((compte) => {
    if (avecProfil.has(compte.id) || exploitants.has(compte.id)) return false;
    const cree = Date.parse(compte.created_at ?? "");
    return Number.isFinite(cree) && cree <= veille;
  }).length;
}

/**
 * Tout le travail, dans une fonction : on en sort par `return`, jamais par
 * `process.exit`. Le code de sortie est posé sur `process.exitCode`, et la
 * boucle d'événements se vide d'elle-même.
 */
async function balayer() {
  await sql.connect();

  const { rows: etablissements } = await sql.query(`
    select id, name, public_code, state, created_at
      from study.organizations
     where public_code like 'RECETTE%'
     order by created_at
  `);

  // Les demandes de démonstration laissées par une recette comptent autant : on
  // les reconnaît au domaine `exemple.invalid`, réservé par la RFC 2606 et donc
  // impossible à porter pour un vrai lycée.
  const { rows: demandes } = await sql.query(
    "select reference from study.commercial_requests where contact_email like '%@exemple.invalid'",
  );

  // Un compte orphelin est une trace au même titre qu'un établissement, et
  // c'est même la seule que plus aucune ligne ne désigne. Le balai sortait
  // auparavant avant de regarder : « aucune trace de recette » se disait avec
  // trois comptes ouverts chez le fournisseur.
  const orphelins = await comptesOrphelins();

  if (orphelins === null) {
    console.log("\n  (comptes de connexion illisibles : le balayage ne peut pas les verifier)");
  } else if (orphelins > 0) {
    console.log(
      `\n${orphelins} compte(s) de connexion sans profil ni qualite d exploitant,` +
        " de plus de deux heures.",
    );
  }

  if (etablissements.length === 0 && demandes.length === 0 && (orphelins ?? 0) === 0) {
    console.log("\nAucune trace de recette. Rien a balayer.");
    return;
  }

  if (demandes.length > 0) {
    console.log(
      `\n${demandes.length} demande(s) de recette : ${demandes.map((d) => d.reference).join(", ")}`,
    );
  }

  console.log(`\n${etablissements.length} etablissement(s) de recette :`);
  for (const etablissement of etablissements) {
    const { rows: membres } = await sql.query(
      "select count(*)::int as n from study.organization_memberships where organization_id = $1",
      [etablissement.id],
    );
    console.log(
      `  ${etablissement.public_code.padEnd(18)} « ${etablissement.name} » — ` +
        `${membres[0].n} compte(s), cree le ${etablissement.created_at.toISOString().slice(0, 10)}`,
    );
  }

  if (!APPLIQUER) {
    console.log("\nRien n a ete supprime. Relancer avec --appliquer pour balayer.");
    return;
  }

  // Les profils sont relevés **avant** le démontage : une fois les adhésions
  // supprimées, plus rien ne relie le compte à l'établissement, et on ne
  // saurait plus lesquels supprimer.
  const profils = new Set();
  for (const etablissement of etablissements) {
    const { rows } = await sql.query(
      "select profile_id from study.organization_memberships where organization_id = $1",
      [etablissement.id],
    );
    for (const ligne of rows) profils.add(ligne.profile_id);
  }

  // Garde-fou : l'exploitant n'est membre d'aucun établissement de recette, mais
  // une erreur de requête ne doit jamais pouvoir emporter son compte.
  const { rows: exploitants } = await sql.query("select profile_id from study_prive.editor_staff");
  for (const ligne of exploitants) {
    if (profils.delete(ligne.profile_id)) {
      console.log("\n  (epargne) le compte de l exploitant n est jamais supprime.");
    }
  }

  console.log("\nDemontage :");
  for (const etablissement of etablissements) {
    console.log(`  ${etablissement.public_code} :`);
    await demonterEtablissement(sql, etablissement.id, { trace: (l) => console.log(l) });
  }

  await demonterProfils(sql, [...profils], { trace: (l) => console.log(l) });
  await demonterDemandes(sql, { trace: (l) => console.log(l) });

  let comptesFournisseur = 0;
  for (const profil of profils) {
    const { error } = await fournisseur.auth.admin.deleteUser(profil);
    if (error === null) comptesFournisseur += 1;
  }
  console.log(`    comptes de connexion chez le fournisseur : ${comptesFournisseur}`);

  const orphelinsRetires = await demonterComptesOrphelins(sql, fournisseur, {
    trace: (l) => console.log(l),
  });
  if (orphelinsRetires === 0 && (orphelins ?? 0) > 0) {
    console.log("    NON  les comptes orphelins n ont pas pu etre retires.");
  }

  const restes = await residuDeRecette(sql, {
    organisations: etablissements.map((e) => e.id),
    profils: [...profils],
  });

  console.log("\n" + "-".repeat(72));
  if (restes.length === 0) {
    console.log("Balayage termine : plus aucune trace de recette en production.");
  } else {
    console.log("CRITIQUE : il reste des traces de recette :");
    for (const reste of restes) console.log(`  - ${reste}`);
    process.exitCode = 1;
  }
}

try {
  await balayer();
} catch (erreur) {
  console.log(`\nCRITIQUE : le balayage a echoue — ${erreur.message}`);
  process.exitCode = 1;
} finally {
  await sql.end().catch(() => {});
}

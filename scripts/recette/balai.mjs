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
// d'établissement commençant par `RECETTE`. Un établissement réel n'en porte
// jamais. Il ne cible jamais un compte par son prénom ni par son rôle.
//
// Par défaut il n'écrit rien et se contente de dire ce qu'il trouve. Il faut
// `--appliquer` pour qu'il agisse.
// =============================================================================

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { chargerEnv, titre } from "../_commun.mjs";
import {
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

if (etablissements.length === 0 && demandes.length === 0) {
  console.log("\nAucune trace de recette. Rien a balayer.");
  await sql.end();
  process.exit(0);
}

if (demandes.length > 0) {
  console.log(`\n${demandes.length} demande(s) de recette : ${demandes.map((d) => d.reference).join(", ")}`);
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
  await sql.end();
  process.exit(0);
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
const { rows: exploitants } = await sql.query(
  "select profile_id from study_prive.editor_staff",
);
for (const ligne of exploitants) {
  if (profils.delete(ligne.profile_id)) {
    console.log(`\n  (epargne) le compte de l exploitant n est jamais supprime.`);
  }
}

console.log("\nDemontage :");
for (const etablissement of etablissements) {
  console.log(`  ${etablissement.public_code} :`);
  await demonterEtablissement(sql, etablissement.id, { trace: (l) => console.log(l) });
}

await demonterProfils(sql, [...profils], { trace: (l) => console.log(l) });
await demonterDemandes(sql, { trace: (l) => console.log(l) });

const fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});
let comptesFournisseur = 0;
for (const profil of profils) {
  const { error } = await fournisseur.auth.admin.deleteUser(profil);
  if (error === null) comptesFournisseur += 1;
}
console.log(`    comptes de connexion chez le fournisseur : ${comptesFournisseur}`);

const restes = await residuDeRecette(sql, {
  organisations: etablissements.map((e) => e.id),
  profils: [...profils],
});

console.log("\n" + "-".repeat(72));
if (restes.length === 0) {
  console.log("Balayage termine : plus aucune trace de recette en production.");
  process.exitCode = 0;
} else {
  console.log("CRITIQUE : il reste des traces de recette :");
  for (const reste of restes) console.log(`  - ${reste}`);
  process.exitCode = 1;
}

await sql.end();

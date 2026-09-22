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

// Le fournisseur d'identité est ouvert ici, avant toute décision de sortie :
// un compte de connexion orphelin est une trace de recette au même titre qu'un
// établissement, et c'est même la seule que plus aucune ligne ne désigne.
const fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

/**
 * Combien de comptes de connexion ne sont rattachés à rien.
 *
 * Le balai relevait ses profils depuis les adhésions d'un établissement de
 * recette. Un compte dont la ligne `profiles` a déjà disparu n'est donc dans
 * aucune liste — et la sortie anticipée ci-dessous le rendait définitivement
 * inatteignable : « aucune trace de recette » se disait avec trois comptes
 * ouverts chez le fournisseur.
 */
async function compterComptesOrphelins() {
  const { data, error } = await fournisseur.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error !== null || data === null) return null;

  const { rows: connus } = await sql.query("select id from study.profiles");
  const { rows: duSite } = await sql.query("select profile_id from study_prive.editor_staff");

  const avecProfil = new Set(connus.map((l) => l.id));
  const exploitants = new Set(duSite.map((l) => l.profile_id));
  const veille = Date.now() - 2 * 60 * 60 * 1000;

  return data.users.filter((compte) => {
    if (avecProfil.has(compte.id) || exploitants.has(compte.id)) return false;
    const cree = Date.parse(compte.created_at ?? "");
    return Number.isFinite(cree) && cree <= veille;
  }).length;
}

const orphelins = await compterComptesOrphelins();

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

let comptesFournisseur = 0;
for (const profil of profils) {
  const { error } = await fournisseur.auth.admin.deleteUser(profil);
  if (error === null) comptesFournisseur += 1;
}
console.log(`    comptes de connexion chez le fournisseur : ${comptesFournisseur}`);

// Et ceux que plus aucune ligne ne designe. Reconnus par trois conditions
// structurelles — aucun profil, pas exploitant, plus de deux heures — jamais
// par un prenom, un role ou un nom d adresse.
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
  process.exitCode = 0;
} else {
  console.log("CRITIQUE : il reste des traces de recette :");
  for (const reste of restes) console.log(`  - ${reste}`);
  process.exitCode = 1;
}

await sql.end();

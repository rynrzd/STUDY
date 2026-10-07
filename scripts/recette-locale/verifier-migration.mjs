#!/usr/bin/env node
// =============================================================================
// Étape 1.4 du plan de récupération, sur une base de recette locale RESTAURÉE
// depuis la sauvegarde réelle (niveau 0044) :
//
//   node scripts/recette-locale/verifier-migration.mjs recette_reelle
//
// La base restaurée n'est jamais modifiée : le script en fait deux copies
// (`<base>_migree`, `<base>_retour`), migre la première de 0045 à 0060, joue
// les parcours, puis exécute les trois scripts de retour sur la seconde.
//
// N'affiche que des comptes et des états, jamais un nom, un identifiant ou un
// contenu : la sortie peut être partagée sans exposer de données d'élèves.
// =============================================================================

import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { lireCatalogue } from "../engendrer-retour-arriere.mjs";
import { DEPOT, client, migrer } from "./environnement.mjs";

const base = process.argv[2] ?? "";
if (!/^[a-z_][a-z0-9_]{0,40}$/.test(base)) {
  console.error("Usage : node scripts/recette-locale/verifier-migration.mjs <base restauree>");
  process.exit(1);
}
const resultats = [];
const dire = (ok, texte) => {
  resultats.push(ok);
  console.log(`${ok ? "  ok " : "  NON"} ${texte}`);
};
const essai = async (nom, f) => {
  try {
    dire(true, `${nom} : ${await f()}`);
  } catch (e) {
    dire(false, `${nom} : ${e.message}`);
  }
};

async function enTantQue(db, profil, sql, params = [], mfa = false) {
  await db.query("set role authenticated");
  await db.query("select set_config('study.user_id', $1, false), set_config('study.niveau_assurance', $2, false)", [profil, mfa ? "aal2" : "aal1"]);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.query("reset role; select set_config('study.user_id', '', false)");
  }
}

const admin = await client("postgres");
for (const suffixe of ["_migree", "_retour"]) {
  await admin.query(`drop database if exists ${base}${suffixe} with (force)`);
  await admin.query(`create database ${base}${suffixe} template ${base}`);
}
await admin.end();

const source = await client(base);
const cat0044 = await lireCatalogue(source);
const tables = cat0044.tables.filter((x) => x.k === "r");
const contenu = async (db) => {
  const r = {};
  for (const { s, t } of tables) {
    const cols = cat0044.colonnes.filter((c) => c.s === s && c.t === t).map((c) => `'${c.col}', x."${c.col}"`).join(", ");
    r[`${s}.${t}`] = (await db.query(`select md5(coalesce(string_agg(v::text, '|' order by v::text), '')) h from (select jsonb_build_object(${cols}) v from "${s}"."${t}" x) y`)).rows[0].h;
  }
  return r;
};
const avant = await contenu(source);
const comptes = async (db) => (await db.query("select to_regclass('auth.users') is not null e")).rows[0].e ? (await db.query("select count(*)::int n from auth.users")).rows[0].n : null;
const comptesAvant = await comptes(source);
const membres = (await source.query(`select o.public_code as code, m.local_login, m.profile_id, m.organization_id, m.roles::text[] as roles
  from study.organization_memberships m join study.organizations o on o.id = m.organization_id where m.state = 'active' and m.account_state = 'actif'`)).rows;
const resolutionAvant = new Map();
for (const m of membres) resolutionAvant.set(`${m.code}/${m.local_login}`, JSON.stringify((await source.query("select * from study.auth_resoudre_identifiant($1, $2)", [m.code, m.local_login])).rows));
console.log(`Base ${base} : ${tables.length} tables, ${membres.length} adhesions actives, ${comptesAvant ?? "aucun"} compte(s) auth.`);

// --- Migration ------------------------------------------------------------------
console.log("\nMigration 0045 a 0060 (copie)");
const mig = await client(`${base}_migree`);
const t0 = Date.now();
try {
  const temps = await migrer(mig, "0044", "0061");
  dire(true, `${temps.length} migrations en ${Date.now() - t0} ms (${temps.join(" ")})`);
} catch (e) {
  dire(false, `migration : ${e.message}`);
  process.exit(1);
}
const apres = await contenu(mig);
const modifiees = Object.keys(avant).filter((k) => avant[k] !== apres[k]);
dire(modifiees.length === 0, `valeurs des tables 0044 modifiees par la migration : ${modifiees.length ? modifiees.join(", ") : "aucune"}`);
dire((await comptes(mig)) === comptesAvant, `comptes auth intacts : ${await comptes(mig)}`);

// --- Parcours -------------------------------------------------------------------
console.log("\nParcours (donnees reelles, aucune donnee affichee)");
const ip = createHash("sha256").update(randomBytes(8)).digest();
const codes = [...new Set(membres.map((m) => m.code))];
let trouves = 0;
for (const code of codes) if ((await mig.query("select etat from study.etablissement_decouvrir($1, $2)", [code, ip])).rows[0]?.etat === "trouve") trouves += 1;
dire(trouves === codes.length, `connexion, etape etablissement : ${trouves}/${codes.length} etablissements trouves`);
let identiques = 0;
for (const m of membres) {
  const r = JSON.stringify((await mig.query("select * from study.auth_resoudre_identifiant($1, $2)", [m.code, m.local_login])).rows);
  if (r === resolutionAvant.get(`${m.code}/${m.local_login}`)) identiques += 1;
}
dire(identiques === membres.length, `connexion, etape identifiant : resolution identique a 0044 pour ${identiques}/${membres.length} adhesions`);

const parRole = (role) => membres.filter((m) => m.roles.includes(role));
const echantillon = (liste) => liste.slice(0, 25);
const autresOrgs = async (m) => (await mig.query("select count(*)::int n from study.organization_memberships where organization_id <> $1", [m.organization_id])).rows[0].n;
for (const [role, mfa] of [["eleve", false], ["professeur", false], ["admin_etablissement", true]]) {
  const liste = echantillon(parRole(role));
  if (liste.length === 0) {
    dire(true, `${role} : aucun compte actif de ce role`);
    continue;
  }
  // Un contexte est une classe : un élève en a un si et seulement s'il a une
  // inscription ouverte ; un professeur ou un administrateur sans classe n'en
  // a aucun, ce qui est attendu (compte rendu informatif).
  await essai(`${role} — contextes de classe (${liste.length} comptes)`, async () => {
    let avec = 0;
    let incoherents = 0;
    for (const m of liste) {
      const n = (await enTantQue(mig, m.profile_id, "select * from study.mes_contextes()", [], mfa)).length;
      if (n > 0) avec += 1;
      if (role === "eleve") {
        const inscrit = (await mig.query("select exists (select 1 from study.class_enrollments where profile_id = $1 and (ends_on is null or ends_on >= current_date)) e", [m.profile_id])).rows[0].e;
        if (inscrit !== n > 0) incoherents += 1;
      }
    }
    if (incoherents > 0) throw new Error(`${incoherents} eleve(s) dont les contextes ne correspondent pas aux inscriptions ouvertes`);
    return `${avec}/${liste.length} avec au moins une classe${role === "eleve" ? ", conforme aux inscriptions ouvertes" : ""}`;
  });
  await essai(`${role} — salons accessibles`, async () => {
    let n = 0;
    for (const m of liste) n += (await enTantQue(mig, m.profile_id, "select id from study.mes_salons()", [], mfa)).length;
    return `${n} acces au total`;
  });
  await essai(`${role} — etancheite entre etablissements`, async () => {
    let fuites = 0;
    for (const m of liste) {
      if ((await autresOrgs(m)) === 0) continue;
      fuites += (await enTantQue(mig, m.profile_id, "select count(*)::int n from study.organization_memberships where organization_id <> $1", [m.organization_id], mfa))[0].n;
    }
    if (fuites > 0) throw new Error(`${fuites} adhesion(s) d'un autre etablissement visible(s)`);
    return "aucune adhesion d'un autre etablissement visible";
  });
}
const admins = parRole("admin_etablissement");
if (admins.length > 0) {
  await essai("administration — demandes de recuperation (second facteur)", async () => `${(await enTantQue(mig, admins[0].profile_id, "select * from study.recuperation_a_traiter()", [], true)).length} demande(s)`);
  await essai("administration — sans second facteur", async () => {
    const n = (await enTantQue(mig, admins[0].profile_id, "select * from study.recuperation_a_traiter()")).length;
    if (n !== 0) throw new Error(`${n} demande(s) visibles sans second facteur`);
    return "0 ligne";
  });
  await essai("administration — apercu d'annee", async () => `${JSON.stringify((await enTantQue(mig, admins[0].profile_id, "select study.annee_organisation_admin() o", [], true))[0].o) === "null" ? "aucune" : "organisation resolue"}`);
}
const cat0060 = await lireCatalogue(mig);
const sig = (f) => `${f.s}.${f.nom}(${f.args}) ${f.retour}`;
const perdues = cat0044.fonctions.filter((f) => !cat0060.fonctions.some((g) => sig(g) === sig(f)));
dire(perdues.length === 0, `code de main : ${cat0044.fonctions.length - perdues.length}/${cat0044.fonctions.length} fonctions 0044 inchangees`);
await mig.end();

// --- Retour arrière ---------------------------------------------------------------
console.log("\nRetour arriere complet (autre copie, migree puis ramenee)");
const ret = await client(`${base}_retour`);
await migrer(ret, "0044", "0061");
for (const f of ["retour-0061.sql", "retour-0060.sql", "retour-0059-0058.sql", "retour-0057-0045.sql"]) {
  await ret.query(readFileSync(path.join(DEPOT, "supabase", "retour-arriere", f), "utf8"));
}
const catRetour = await lireCatalogue(ret);
const parties = Object.keys(cat0044).filter((k) => JSON.stringify(catRetour[k]) !== JSON.stringify(cat0044[k]));
dire(parties.length === 0, `catalogue identique a 0044 apres retour${parties.length ? " — differences : " + parties.join(", ") : ""}`);
const apresRetour = await contenu(ret);
const changees = Object.keys(avant).filter((k) => avant[k] !== apresRetour[k]);
dire(changees.length === 0, `valeurs des tables 0044 identiques apres retour : ${changees.length ? "differences dans " + changees.join(", ") : "oui"}`);
await ret.end();
await source.end();

const fautes = resultats.filter((x) => !x).length;
console.log(`\n${resultats.length - fautes}/${resultats.length} verifications reussies. Copies conservees : ${base}_migree, ${base}_retour (a supprimer apres lecture).`);
process.exitCode = fautes ? 1 : 0;

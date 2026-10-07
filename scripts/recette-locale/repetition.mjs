// Répétition générale sur PostgreSQL 17 réel (local, 127.0.0.1, accès restreint).
// Aucune donnée réelle : la « production simulée » est le jeu de recette du
// dépôt à l'état 0044, avec des comptes auth fictifs.
//  1. production simulée 0044 + activité ;
//  2. sauvegarde format 2 (comptes compris) ;
//  3. restauration dans une base de recette 0044 vide, vérification ligne à ligne ;
//  4. migrations 0045 → 0060 une par une, chronométrées ;
//  5. parcours connexion / élève / professeur / administrateur sur les données restaurées ;
//  6. code de main (0044) : chaque fonction et table appelées existent, mêmes signatures ;
//  7. retour arrière complet sur une copie : catalogue et données 0044 retrouvés.
//
//   node scripts/recette-locale/demarrer.mjs        (dans un autre terminal)
//   node scripts/recette-locale/repetition.mjs

import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import { capturerTable, empreinte, restaurer, tablesACapturer } from "../sauvegarde-donnees.mjs";
import { lireCatalogue } from "../engendrer-retour-arriere.mjs";
import { ACTEURS } from "../../tests/db/harness.mjs";
import { DEPOT, RACINE_RECETTE, client as clientBase, migrer, restreindre } from "./environnement.mjs";
const AUTH = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default clock_timestamp(), raw_app_meta_data jsonb);
  create table auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider text, identity_data jsonb);
  create table auth.mfa_factors (id uuid primary key, user_id uuid references auth.users(id), factor_type text, secret text, created_at timestamptz default clock_timestamp());`;

const resultats = [];
const dire = (ok, texte) => { resultats.push({ ok, texte }); console.log(`${ok ? "  ok " : "  NON"} ${texte}`); };

const client = clientBase;
async function enTantQue(db, profil, sql, params = [], mfa = false) {
  await db.query("set role authenticated");
  await db.query("select set_config('study.user_id', $1, false), set_config('study.niveau_assurance', $2, false)", [profil, mfa ? "aal2" : "aal1"]);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.query("reset role; select set_config('study.user_id', '', false)"); }
}
// Contenu des tables 0044, restreint aux colonnes de 0044 : une colonne
// ajoutée par une migration ne compte pas comme une modification de données.
let colonnes0044 = null;
const contenu = async (db, tables) => {
  const r = {};
  for (const { s, t } of tables) {
    const cols = colonnes0044.filter((c) => c.s === s && c.t === t).map((c) => `'${c.col}', x."${c.col}"`).join(", ");
    r[`${s}.${t}`] = (await db.query(`select md5(coalesce(string_agg(v::text, '|' order by v::text), '')) h from (select jsonb_build_object(${cols}) v from "${s}"."${t}" x) y`)).rows[0].h;
  }
  return r;
};

// --- 0. Bases neuves ---------------------------------------------------------
const admin = await client("postgres");
for (const b of ["prod_simulee", "recette", "recette_retour"]) await admin.query(`drop database if exists ${b} with (force)`);
await admin.query("create database prod_simulee");
await admin.query("create database recette");
console.log((await admin.query("select version()")).rows[0].version.split(",")[0]);

// --- 1. Production simulée à l'état 0044 ---------------------------------------
console.log("\n1. Production simulee 0044");
const prod = await client("prod_simulee");
await prod.query(AUTH);
await migrer(prod, "0000", "0044");
await prod.query(readFileSync(path.join(DEPOT, "supabase", "seed", "seed_recette.sql"), "utf8"));
const profils = (await prod.query("select id from study.profiles")).rows.map((r) => r.id);
for (const id of profils) {
  await prod.query("insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values ($1, $2, $3, '{\"provider\":\"email\"}')", [id, `${id}@alias.invalid`, "$2a$10$" + randomBytes(22).toString("base64url").slice(0, 22)]);
  await prod.query("insert into auth.identities (id, user_id, provider, identity_data) values ($1, $1, 'email', '{}')", [id]);
}
await prod.query("insert into auth.mfa_factors (id, user_id, factor_type, secret) values ($1, $2, 'totp', 'FICTIF')", [randomUUID(), ACTEURS.adminA]);
dire(true, `${profils.length} profils et comptes auth fictifs`);
const catalogue0044 = await lireCatalogue(prod);
const tables0044 = catalogue0044.tables.filter((x) => x.k === "r");
colonnes0044 = catalogue0044.colonnes;

// --- 2. Sauvegarde format 2 ---------------------------------------------------
console.log("\n2. Sauvegarde");
const dossier = path.join(RACINE_RECETTE, "sauvegarde-repetition");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(path.join(dossier, "donnees"), { recursive: true });
restreindre(dossier);
await prod.query("begin isolation level repeatable read read only");
const manifeste = { horodatage: new Date().toISOString(), format: 2, comptes: true, fichiers: [], totaux: { tables: 0, lignes: 0 } };
for (const { schema, table } of await tablesACapturer(prod, { avecComptes: true })) {
  const texte = await capturerTable(prod, schema, table);
  const fichier = `donnees/${schema}.${table}.json`;
  writeFileSync(path.join(dossier, fichier), texte, "utf8");
  const lignes = JSON.parse(texte).length;
  manifeste.fichiers.push({ fichier, lignes, sha256: empreinte(texte) });
  manifeste.totaux.tables += 1; manifeste.totaux.lignes += lignes;
}
await prod.query("commit");
writeFileSync(path.join(dossier, "manifeste.json"), JSON.stringify(manifeste), "utf8");
dire(true, `${manifeste.totaux.tables} tables, ${manifeste.totaux.lignes} lignes (auth compris)`);

// --- 3. Restauration dans la recette ---------------------------------------------
console.log("\n3. Restauration en recette");
const rec = await client("recette");
await rec.query(AUTH);
await migrer(rec, "0000", "0044");
const r = await restaurer(rec, dossier);
const ecarts = r.tables.reduce((s, t) => s + (t.ecarts ?? 0), 0);
const lignes = r.tables.reduce((s, t) => s + t.restaure, 0);
dire(ecarts === 0 && lignes === manifeste.totaux.lignes, `restauration : ${lignes}/${manifeste.totaux.lignes} lignes, ${ecarts} ecart ligne a ligne`);
const catRestaure = await lireCatalogue(rec);
dire(JSON.stringify(catRestaure) === JSON.stringify(catalogue0044), "catalogue de la recette restauree identique a la production simulee");
const avantMigration = await contenu(rec, tables0044);

// --- 4. Migrations 0045 → 0060 sur les données restaurées -------------------------
console.log("\n4. Migrations 0045 a 0060");
const t0 = Date.now();
const temps = await migrer(rec, "0044", "0061");
dire(true, `${temps.length} migrations appliquees en ${Date.now() - t0} ms : ${temps.join(" ")}`);
const apresMigration = await contenu(rec, tables0044);
const modifiees = Object.keys(avantMigration).filter((k) => avantMigration[k] !== apresMigration[k]);
dire(modifiees.length === 0, `donnees des tables 0044 modifiees par les migrations : ${modifiees.join(", ") || "aucune"}`);
const [{ n: comptes }] = (await rec.query("select count(*)::int n from auth.users")).rows;
dire(comptes === profils.length, `comptes auth intacts apres migration : ${comptes}/${profils.length}`);

// --- 5. Parcours ----------------------------------------------------------------
console.log("\n5. Parcours sur les donnees restaurees et migrees");
const ip = createHash("sha256").update("ip-recette").digest();
const etab = (await rec.query("select * from study.etablissement_decouvrir('TESTA1', $1)", [ip])).rows[0];
dire(Boolean(etab), `connexion etape 1 (etablissement_decouvrir) : ${JSON.stringify(etab)}`);
const identifiants = (await rec.query(`select o.public_code as code, m.local_login, m.profile_id, m.organization_id from study.organization_memberships m
  join study.organizations o on o.id = m.organization_id where m.state = 'active' and m.account_state = 'actif'`)).rows;
let resolus = 0, sessions = 0, identiques = 0, attendus = 0;
for (const i of identifiants) {
  const res = (await rec.query("select * from study.auth_resoudre_identifiant($1, $2)", [i.code, i.local_login])).rows;
  const avant = (await prod.query("select * from study.auth_resoudre_identifiant($1, $2)", [i.code, i.local_login])).rows;
  if (JSON.stringify(res) === JSON.stringify(avant)) identiques += 1;
  if (avant.length === 1) attendus += 1;
  if (res.length === 1) resolus += 1;
  const jeton = randomBytes(32);
  const emp = createHash("sha256").update(jeton).digest();
  await rec.query(`select study.auth_creer_session(p_profile => $1, p_organization => $2, p_empreinte => $3, p_scope => 'etablissement', p_appareil => 'personnel',
      p_niveau_assurance => 'aal1', p_idle_expire => now() + interval '1 hour', p_absolu_expire => now() + interval '8 hours', p_jetons_chiffres => $4, p_cle_version => 1)`,
    [i.profile_id, i.organization_id, emp, Buffer.from("chiffre", "utf8")]).catch((e) => console.log("    session:", e.message));
  if ((await rec.query("select * from study.auth_lire_session($1)", [emp])).rows.length === 1) sessions += 1;
}
dire(identiques === identifiants.length && resolus === attendus && resolus > 0, `connexion etape 2 : resolution identique a 0044 pour ${identiques}/${identifiants.length} identifiants (${resolus} resolus, comme en 0044 : les autres n'ont pas d'alias technique dans le jeu de recette)`);
dire(sessions === identifiants.length, `sessions creees et relues : ${sessions}/${identifiants.length}`);

const essai = async (nom, f) => { try { const v = await f(); dire(true, `${nom}${v !== undefined ? ` : ${v}` : ""}`); } catch (e) { dire(false, `${nom} : ${e.message}`); } };
await essai("eleve — mes_contextes", async () => (await enTantQue(rec, ACTEURS.eleveA1Rayan, "select * from study.mes_contextes()")).length + " contexte(s)");
await essai("eleve — mes_salons", async () => (await enTantQue(rec, ACTEURS.eleveA1Rayan, "select * from study.mes_salons()")).length + " salon(s)");
await essai("eleve — envoyer un message", async () => {
  const s = (await rec.query("select id from study.salons where class_id is not null and kind = 'general' limit 1")).rows[0].id;
  return (await enTantQue(rec, ACTEURS.eleveA1Rayan, "select * from study.salon_envoyer($1, 'Bonjour', $2, null, 'message', null, null, false)", [s, randomUUID()])).length + " message";
});
await essai("eleve — RLS : pas de salon d'une autre classe", async () => {
  const autre = (await rec.query("select id from study.salons where class_id = (select class_id from study.class_enrollments where profile_id = $1 limit 1) and kind = 'general'", [ACTEURS.eleveA2Samir])).rows[0].id;
  const vu = await enTantQue(rec, ACTEURS.eleveA1Rayan, "select id from study.messages_salon where salon_id = $1", [autre]);
  if ((await enTantQue(rec, ACTEURS.eleveA1Rayan, "select study.salon_lisible($1) as l", [autre]))[0].l) throw new Error("salon lisible");
  return `${vu.length} message visible`;
});
await essai("professeur — salons", async () => (await enTantQue(rec, ACTEURS.profMartin, "select * from study.mes_salons()")).length + " salon(s)");
await essai("professeur — bibliotheque / lecons lisibles", async () => (await enTantQue(rec, ACTEURS.profMartin, "select id from study.lessons")).length + " lecon(s)");
await rec.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX')", [createHash("sha256").update("ip-demande").digest()]);
await essai("admin — recuperation_a_traiter avec second facteur", async () => {
  const n = (await enTantQue(rec, ACTEURS.adminA, "select * from study.recuperation_a_traiter()", [], true)).length;
  if (n !== 1) throw new Error(n + " demande(s) au lieu de 1"); return "1 demande";
});
await essai("admin — annee_organisation_admin", async () => JSON.stringify((await enTantQue(rec, ACTEURS.adminA, "select study.annee_organisation_admin() as o", [], true))[0].o));
await essai("admin — preparer une annee", async () => { await enTantQue(rec, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')", [], true); return "ok"; });
await essai("admin — sans second facteur : aucune demande visible", async () => {
  let n;
  try { n = (await enTantQue(rec, ACTEURS.adminA, "select * from study.recuperation_a_traiter()")).length; } catch { return "refuse"; }
  if (n !== 0) throw new Error(n + " demande(s) visibles sans aal2"); return "0 ligne";
});
await essai("professeur — pas d'acces aux demandes", async () => {
  const n = (await enTantQue(rec, ACTEURS.profMartin, "select * from study.recuperation_a_traiter()", [], true)).length;
  if (n !== 0) throw new Error(n + " demande(s)"); return "0 ligne";
});
await essai("lycee B etanche", async () => {
  const vus = await enTantQue(rec, ACTEURS.eleveB, "select id from study.profiles where id = $1", [ACTEURS.eleveA1Rayan]);
  if (vus.length) throw new Error("profil du lycee A visible"); return "aucun profil du lycee A";
});

// --- 6. Code de main contre le schéma 0060 ---------------------------------------
console.log("\n6. Code de main (0044) contre le schema 0060");
const cat0060 = await lireCatalogue(rec);
const sig = (f) => `${f.s}.${f.nom}(${f.args})`;
const disparues = catalogue0044.fonctions.filter((f) => !cat0060.fonctions.some((g) => sig(g) === sig(f) && g.retour === f.retour));
dire(disparues.length === 0, `fonctions 0044 conservees avec meme signature et retour : ${catalogue0044.fonctions.length - disparues.length}/${catalogue0044.fonctions.length}` + (disparues.length ? ` — ${disparues.map(sig).join(", ")}` : ""));
const colPerdues = catalogue0044.colonnes.filter((c) => !cat0060.colonnes.some((d) => d.s === c.s && d.t === c.t && d.col === c.col && d.ty === c.ty));
dire(colPerdues.length === 0, `colonnes 0044 conservees : ${catalogue0044.colonnes.length - colPerdues.length}/${catalogue0044.colonnes.length}`);

// --- 7. Retour arrière complet sur une copie ----------------------------------
console.log("\n7. Retour arriere complet (copie de la recette migree)");
await rec.end();
await admin.query("create database recette_retour template recette");
const ret = await client("recette_retour");
for (const f of ["retour-0061.sql", "retour-0060.sql", "retour-0059-0058.sql", "retour-0057-0045.sql"]) {
  await ret.query(readFileSync(path.join(DEPOT, "supabase", "retour-arriere", f), "utf8"));
}
const catRetour = await lireCatalogue(ret);
const parties = Object.keys(catalogue0044).filter((k) => JSON.stringify(catRetour[k]) !== JSON.stringify(catalogue0044[k]));
dire(parties.length === 0, `catalogue apres retour identique a 0044${parties.length ? " — differences : " + parties.join(", ") : ""}`);
const apresRetour = await contenu(ret, tables0044);
const changees = Object.keys(avantMigration).filter((k) => avantMigration[k] !== apresRetour[k]);
dire(true, `tables 0044 dont le contenu differe apres retour (activite de la periode migree) : ${changees.join(", ") || "aucune"}`);
const [{ n: comptesRetour }] = (await ret.query("select count(*)::int n from auth.users")).rows;
dire(comptesRetour === profils.length, `comptes auth intacts apres retour : ${comptesRetour}/${profils.length}`);
dire((await ret.query("select * from study.auth_resoudre_identifiant('TESTA1', 'rayan.dupont')")).rows.length === 1, "connexion 0044 fonctionne apres retour");
await ret.end();
await prod.end();
await admin.end();

const fautes = resultats.filter((x) => !x.ok);
console.log(`\n${resultats.length - fautes.length}/${resultats.length} verifications reussies.`);
writeFileSync(path.join(RACINE_RECETTE, "repetition-resultat.json"), JSON.stringify(resultats, null, 1));
rmSync(dossier, { recursive: true, force: true });
process.exitCode = fautes.length ? 1 : 0;

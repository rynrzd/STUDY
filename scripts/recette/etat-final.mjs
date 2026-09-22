#!/usr/bin/env node
// =============================================================================
// §12 — L'état final obligatoire.
//
//   npm run verifier:etat-final
//
// Ce que la production doit être quand tout est retombé : **un seul compte**,
// celui de l'administrateur du site, et rien d'autre. Pas un établissement, pas
// une classe, pas un élève, pas une session, pas une demande.
//
// Le journal d'audit fait exception, et c'est voulu : il conserve ses
// événements légitimes — y compris ceux des recettes, qui sont la preuve
// qu'elles ont eu lieu. Il est vérifié séparément par `verifier:journal`, qui
// s'assure qu'aucun secret ne s'y trouve.
//
// Ce script ne corrige rien. Il compte, et il dit non.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "etat-final",
});
await sql.connect();

titre("AvecStudy — etat final de la production");

const { rows } = await sql.query(`
  select
    (select count(*)::int from study.profiles)                                        as profils,
    (select count(*)::int from study_prive.editor_staff where state = 'active')       as admins_site,
    (select count(*)::int from study.organizations)                                   as organisations,
    (select count(*)::int from study.organization_memberships)                        as adhesions,
    (select count(*)::int from study.organization_memberships
      where roles && array['professeur']::study.role_type[])                          as professeurs,
    (select count(*)::int from study.organization_memberships
      where roles && array['eleve']::study.role_type[])                               as eleves,
    (select count(*)::int from study.classes)                                         as classes,
    -- Les sessions **de recette** : celles d un compte autre que l exploitant.
    -- Sa propre session n est pas un residu, et la compter comme tel ferait
    -- echouer un etat conforme chaque fois qu il se connecte.
    (select count(*)::int from study_prive.sessions s
      where s.revoked_at is null
        and not exists (select 1 from study_prive.editor_staff e
                         where e.profile_id = s.profile_id))                      as sessions_vivantes,
    (select count(*)::int from study.commercial_requests)                             as demandes,
    (select count(*)::int from study.files where state <> 'supprime')                 as fichiers,
    (select count(*)::int from study.import_batches)                                  as lots,
    -- Le cycle des devoirs, compté pour lui-même. Un établissement démonté
    -- dont les copies survivraient serait un établissement à moitié démonté,
    -- et « organisations = 0 » ne le dirait pas.
    (select count(*)::int from study.assignments)                                     as devoirs,
    (select count(*)::int from study.submission_versions)                             as remises,
    (select count(*)::int from study.feedback)                                        as corrections_individuelles,
    (select count(*)::int from study.assignment_corrections)                          as corrections_communes,
    (select count(*)::int from study.reports)                                         as signalements,
    (select count(*)::int from study.nouveautes)                                      as nouveautes,
    (select count(*)::int from study.audit_events)                                    as journal
`);

const etat = rows[0];

/**
 * Ce qui doit valoir zéro, et ce qui doit valoir un.
 *
 * `comptes_auth` n'est pas lisible depuis la base : les comptes de connexion
 * vivent chez le fournisseur d'identité. On vérifie à la place qu'aucun profil
 * n'existe sans adhésion ni qualité d'exploitant — c'est la même question, posée
 * là où l'on peut y répondre.
 */
const ATTENDUS = [
  ["profils", etat.profils, 1],
  ["admins_site", etat.admins_site, 1],
  ["organisations", etat.organisations, 0],
  ["adhesions", etat.adhesions, 0],
  ["professeurs", etat.professeurs, 0],
  ["eleves", etat.eleves, 0],
  ["classes", etat.classes, 0],
  ["sessions_temporaires", etat.sessions_vivantes, 0],
  ["demandes", etat.demandes, 0],
  ["fichiers_de_recette", etat.fichiers, 0],
  ["lots_de_recette", etat.lots, 0],
  ["devoirs_de_recette", etat.devoirs, 0],
  ["remises_de_recette", etat.remises, 0],
  ["corrections_individuelles", etat.corrections_individuelles, 0],
  ["corrections_communes", etat.corrections_communes, 0],
  ["signalements_de_recette", etat.signalements, 0],
  ["nouveautes_de_recette", etat.nouveautes, 0],
];

let defauts = 0;

console.log("");
for (const [nom, valeur, attendu] of ATTENDUS) {
  const ok = valeur === attendu;
  if (!ok) defauts += 1;
  console.log(`  ${ok ? "ok  " : "NON "} ${nom.padEnd(24)} = ${valeur}${ok ? "" : `   (attendu ${attendu})`}`);
}

/* --- Les orphelins : ce qui reste sans plus rien pour le rattacher --------- */

const { rows: orphelins } = await sql.query(`
  select
    (select count(*)::int from study.profiles p
      where not exists (select 1 from study.organization_memberships m where m.profile_id = p.id)
        and not exists (select 1 from study_prive.editor_staff e where e.profile_id = p.id))     as profils_sans_rattachement,
    (select count(*)::int from study.lessons)                                                     as seances,
    (select count(*)::int from study.assignments)                                                 as devoirs,
    (select count(*)::int from study.lesson_blocks)                                               as blocs,
    (select count(*)::int from study.fils_entraide)                                               as fils_entraide,
    (select count(*)::int from study.travaux_faits)                                               as travaux_faits,
    (select count(*)::int from study.teaching_spaces)                                             as cours,
    -- Un alias n'est orphelin que si son profil a disparu. Le compte du site en
    -- porte un, sans établissement : le compter comme un résidu ferait échouer
    -- un état pourtant conforme, et l'on apprendrait à ignorer l'alerte.
    (select count(*)::int from study_prive.auth_aliases a
      where not exists (select 1 from study.profiles p where p.id = a.profile_id))                as alias_orphelins
`);

const restes = orphelins[0];
const total = Object.values(restes).reduce((somme, valeur) => somme + valeur, 0);

console.log("");
if (total === 0) {
  console.log("  ok   donnees_orphelines       = 0");
} else {
  defauts += 1;
  console.log("  NON  donnees_orphelines       = " + total);
  for (const [nom, valeur] of Object.entries(restes)) {
    if (valeur > 0) console.log(`         ${nom} : ${valeur}`);
  }
}

console.log(`\n  (conserve) journal d audit     = ${etat.journal} evenement(s) legitimes`);

/* --- Les garde-fous sont-ils tous en place ? ------------------------------- */

// Le nettoyage met trois declencheurs en sommeil le temps d un demontage. Si
// une recette est interrompue au mauvais moment, ils pourraient rester
// eteints — et personne ne s en apercevrait avant le premier incident.
const { rows: gardes } = await sql.query(`
  select t.tgname, t.tgenabled
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname = 'study'
     and t.tgname in ('memberships_guard_last_admin', 'submission_versions_immutable',
                      'files_freeze_tenant', 'audit_events_immutable',
                      'audit_events_sans_secret')
   order by t.tgname
`);

console.log("");
for (const garde of gardes) {
  const actif = garde.tgenabled === "O";
  if (!actif) defauts += 1;
  console.log(`  ${actif ? "ok  " : "NON "} declencheur ${garde.tgname}`);
}

if (gardes.length < 5) {
  defauts += 1;
  console.log(`  NON  seuls ${gardes.length} garde-fous sur 5 sont presents`);
}

/* --- Ce que la base ne peut pas voir -------------------------------------- */
//
// Deux compteurs du cahier vivent hors de PostgreSQL : les comptes de
// connexion, qui sont chez le fournisseur d'identité, et les octets, qui sont
// dans le seau. Les ignorer permettait de déclarer « rien d'autre » en
// laissant derrière soi un compte de recette capable de se connecter, ou des
// fichiers que plus aucun écran ne désigne.

const CONFIGURE =
  typeof process.env.SUPABASE_URL === "string" &&
  typeof process.env.SUPABASE_SECRET_KEY === "string" &&
  process.env.SUPABASE_URL !== "" &&
  process.env.SUPABASE_SECRET_KEY !== "";

if (!CONFIGURE) {
  defauts += 1;
  console.log("\n  NON  comptes_auth et objets_orphelins : acces au fournisseur absent");
} else {
  const fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /* Les comptes de connexion. */
  const { data: comptesAuth, error: refusAuth } = await fournisseur.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (refusAuth !== null) {
    defauts += 1;
    console.log(`\n  NON  comptes_auth illisibles — ${refusAuth.message}`);
  } else {
    const nombre = comptesAuth.users.length;
    const conforme = nombre === 1;
    if (!conforme) defauts += 1;
    console.log(
      `\n  ${conforme ? "ok  " : "NON "} comptes_auth              = ${nombre}` +
        (conforme ? "" : "   (attendu 1)"),
    );
  }

  /* Les objets du seau, comparés aux lignes de la base. */
  const { rows: cles } = await sql.query("select storage_key from study.files");
  const connus = new Set(cles.map((ligne) => ligne.storage_key));

  const lister = async (prefixe = "", profondeur = 0) => {
    if (profondeur > 3) return [];
    const { data, error } = await fournisseur.storage
      .from("course-materials")
      .list(prefixe, { limit: 1000 });
    if (error !== null || data === null) return [];

    const trouves = [];
    for (const entree of data) {
      const chemin = prefixe === "" ? entree.name : `${prefixe}/${entree.name}`;
      // Un « dossier » n'a pas de métadonnées : c'est ainsi qu'on les distingue.
      if (entree.id === null) trouves.push(...(await lister(chemin, profondeur + 1)));
      else trouves.push({ chemin, cree: entree.created_at ?? null });
    }
    return trouves;
  };

  const objets = await lister();
  const orphelins = objets.filter((objet) => !connus.has(objet.chemin));

  // **La même règle que `verifier:stockage`, et pour la même raison.**
  //
  // Un objet de moins de deux heures qu'aucune ligne ne désigne peut être un
  // dépôt en cours : les trois temps du dépôt — réserver, transférer,
  // finaliser — laissent une fenêtre où les octets existent avant la ligne.
  // Le compter comme une fuite ferait échouer un état parfaitement conforme
  // chaque fois qu'un élève rend une copie pendant la vérification.
  //
  // Les deux scripts disaient auparavant des choses différentes du même
  // objet : l'un le tolérait, l'autre le déclarait CRITIQUE. Deux règles pour
  // une même question, c'est une de trop — et c'est celle qui parle le plus
  // fort qu'on finit par ignorer.
  const VEILLE = Date.now() - 2 * 60 * 60 * 1000;
  const murs = orphelins.filter((objet) => {
    const cree = Date.parse(objet.cree ?? "");
    return !Number.isFinite(cree) || cree <= VEILLE;
  });
  const recents = orphelins.length - murs.length;

  const sansOrphelin = murs.length === 0;
  if (!sansOrphelin) defauts += 1;

  console.log(
    `  ${sansOrphelin ? "ok  " : "NON "} objets_orphelins          = ${murs.length}` +
      (sansOrphelin ? "" : "   (attendu 0, voir verifier:stockage --ramasser)"),
  );

  if (recents > 0) {
    console.log(
      `       note ${recents} objet(s) de moins de deux heures sans ligne :` +
        " un depot en cours n est pas un orphelin.",
    );
  }
}

/* --- Qui est ce compte unique ? -------------------------------------------- */

const { rows: comptes } = await sql.query(
  "select first_name, last_name, study.auth_second_facteur_exige(id) as mfa from study.profiles order by created_at",
);

console.log("\nLe ou les comptes restants :");
for (const compte of comptes) {
  console.log(
    `  ${compte.first_name} ${compte.last_name} — second facteur ${compte.mfa ? "exige" : "non exige"}`,
  );
}

await sql.end();

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Etat final conforme : un seul compte, et rien d autre."
    : `Etat final : ${defauts} ecart(s) a corriger.`,
);
process.exitCode = defauts === 0 ? 0 : 1;

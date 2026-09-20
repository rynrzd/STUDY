// =============================================================================
// Nettoyage d'une recette — §2 du cahier.
//
// Une recette qui laisse des traces en production n'est pas une recette : c'est
// une pollution. Ce module démonte entièrement un établissement de recette et
// les comptes qu'il a fait naître, **puis vérifie que plus rien ne reste** et
// échoue bruyamment si ce n'est pas le cas.
//
// Deux règles qui ne se négocient pas.
//
// **Le journal d'audit n'est jamais touché.** `study.audit_events` ne porte
// aucune clé étrangère vers `organizations` : rien n'oblige techniquement à
// l'effacer pour supprimer un établissement. L'ancienne version le vidait tout
// de même, en neutralisant le déclencheur d'immutabilité — ce qui revenait à
// désactiver la serrure pour prouver qu'on a la clé. Les traces d'une recette
// sont la preuve que la recette a eu lieu : elles restent.
//
// **On ne neutralise que le garde-fou précis qui gêne.** Supprimer le dernier
// administrateur d'un établissement est refusé par
// `memberships_guard_last_admin` — une protection juste, qui n'a simplement
// pas de sens sur un établissement qu'on démonte en entier. On le met en
// sommeil nommément, dans la transaction, et il est rétabli avant la fin.
// Aucun réglage global de session, aucune suspension en bloc.
// =============================================================================

/** Le journal : on le lit, on ne le réécrit jamais. */
const INTOUCHABLES = new Set(["audit_events"]);

/**
 * Les tables qui portent un `organization_id`, découvertes dans le catalogue.
 *
 * Découvertes plutôt qu'énumérées : une liste écrite à la main vieillit mal.
 * La table ajoutée l'an prochain serait oubliée, et la recette recommencerait à
 * laisser des traces sans que personne le remarque.
 */
async function tablesLieesAUnEtablissement(sql) {
  const { rows } = await sql.query(`
    select c.table_schema as schema, c.table_name as table
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.column_name = 'organization_id'
       and c.table_schema in ('study', 'study_prive')
       and t.table_type = 'BASE TABLE'
     order by c.table_schema, c.table_name
  `);

  return rows.filter((ligne) => !INTOUCHABLES.has(ligne.table));
}

/**
 * Supprime tout ce qui se rattache à un établissement, puis l'établissement.
 *
 * Les dépendances sont en « on delete restrict » : plutôt que de deviner un
 * ordre, on répète les suppressions tant qu'elles progressent. Ce qui résiste
 * encore au bout de plusieurs passes est signalé, pas ignoré.
 */
export async function demonterEtablissement(sql, organisation, { trace = () => {} } = {}) {
  const tables = await tablesLieesAUnEtablissement(sql);
  const supprimees = new Map();

  await sql.query("begin");

  try {
    // Le seul garde-fou neutralisé, et il est nommé.
    await sql.query(
      "alter table study.organization_memberships disable trigger memberships_guard_last_admin",
    );

    let reste = tables;
    for (let passe = 0; passe < 4 && reste.length > 0; passe += 1) {
      const bloquees = [];

      for (const { schema, table } of reste) {
        // Une erreur empoisonne toute la transaction PostgreSQL : chaque
        // suppression est donc encadrée par un point de reprise, pour qu'une
        // dépendance encore pleine ne fasse pas tomber le reste du démontage.
        await sql.query("savepoint essai");
        try {
          const { rowCount } = await sql.query(
            `delete from ${schema}.${table} where organization_id = $1`,
            [organisation],
          );
          await sql.query("release savepoint essai");
          if (rowCount > 0) {
            supprimees.set(`${schema}.${table}`, (supprimees.get(`${schema}.${table}`) ?? 0) + rowCount);
          }
        } catch (erreur) {
          await sql.query("rollback to savepoint essai");
          await sql.query("release savepoint essai");
          bloquees.push({ schema, table, motif: erreur.message });
        }
      }

      const progresse = bloquees.length < reste.length;
      reste = bloquees;
      // Aucune progression d'une passe à l'autre : insister ne changerait rien.
      if (!progresse) break;
    }

    const { rowCount: organisations } = await sql.query(
      "delete from study.organizations where id = $1",
      [organisation],
    );
    supprimees.set("study.organizations", organisations);

    await sql.query(
      "alter table study.organization_memberships enable trigger memberships_guard_last_admin",
    );

    await sql.query("commit");
  } catch (erreur) {
    await sql.query("rollback").catch(() => {});
    throw erreur;
  }

  // Le déclencheur est rétabli même si la transaction a été défaite : sans
  // cela, un échec de nettoyage laisserait la production sans sa protection.
  await sql
    .query("alter table study.organization_memberships enable trigger memberships_guard_last_admin")
    .catch(() => {});

  for (const [table, nombre] of supprimees) trace(`    ${table} : ${nombre}`);
  return supprimees;
}

/** Supprime les profils d'une recette, et ce qui s'y rattache. */
export async function demonterProfils(sql, profils, { trace = () => {} } = {}) {
  if (profils.length === 0) return 0;

  const { rows } = await sql.query(`
    select c.table_schema as schema, c.table_name as table
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.column_name = 'profile_id'
       and c.table_schema in ('study', 'study_prive')
       and t.table_type = 'BASE TABLE'
  `);

  await sql.query("begin");
  try {
    for (const { schema, table } of rows) {
      if (INTOUCHABLES.has(table)) continue;
      await sql
        .query(`delete from ${schema}.${table} where profile_id = any($1::uuid[])`, [profils])
        .catch(() => {});
    }

    const { rowCount } = await sql.query("delete from study.profiles where id = any($1::uuid[])", [
      profils,
    ]);
    await sql.query("commit");
    trace(`    study.profiles : ${rowCount}`);
    return rowCount;
  } catch (erreur) {
    await sql.query("rollback").catch(() => {});
    throw erreur;
  }
}

/**
 * Ce qui reste, après coup.
 *
 * C'est le contrôle qui donne sa valeur au reste : sans lui, un nettoyage
 * silencieusement inopérant se raconte comme un succès. Le rapport d'une
 * recette ne vaut que s'il peut dire « non ».
 */
export async function residuDeRecette(sql, { organisations = [], profils = [] } = {}) {
  const restes = [];

  if (organisations.length > 0) {
    const { rows } = await sql.query(
      "select id, name, public_code from study.organizations where id = any($1::uuid[])",
      [organisations],
    );
    for (const ligne of rows) restes.push(`etablissement « ${ligne.name} » (${ligne.public_code})`);
  }

  if (profils.length > 0) {
    const { rows } = await sql.query(
      "select id, first_name, last_name from study.profiles where id = any($1::uuid[])",
      [profils],
    );
    for (const ligne of rows) restes.push(`profil ${ligne.first_name} ${ligne.last_name}`);
  }

  // Et le filet large : ce qu'un run interrompu a laissé derrière lui, et que
  // personne ne cherchera jamais si ce n'est pas nommé ici. Les marqueurs sont
  // les mêmes que ceux que la recette pose — jamais un prénom, jamais un rôle.
  const { rows: errants } = await sql.query(`
    select name, public_code from study.organizations
     where public_code like 'RECETTE%' or name ilike '%recette%'
     order by name
  `);
  for (const ligne of errants) {
    restes.push(`etablissement de recette errant « ${ligne.name} » (${ligne.public_code})`);
  }

  const { rows: demandes } = await sql.query(`
    select reference from study.commercial_requests
     where contact_email like '%@exemple.invalid'
     order by created_at
  `);
  for (const ligne of demandes) {
    restes.push(`demande de recette errante ${ligne.reference}`);
  }

  return restes;
}

/**
 * Supprime les demandes commerciales de recette.
 *
 * Reconnues à leur adresse : le domaine `exemple.invalid` est réservé par la
 * RFC 2606 et ne peut appartenir à personne. Aucun lycée réel ne dépose une
 * demande depuis une adresse qui n'existe pas.
 */
export async function demonterDemandes(sql, { trace = () => {} } = {}) {
  const { rowCount } = await sql.query(
    "delete from study.commercial_requests where contact_email like '%@exemple.invalid'",
  );
  if (rowCount > 0) trace(`    study.commercial_requests : ${rowCount}`);
  return rowCount;
}

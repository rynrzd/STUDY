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
// **On ne neutralise que les garde-fous précis qui gênent.** Trois, nommés un
// par un, pour la durée d une transaction : le dernier administrateur d un
// lycée, l immutabilité d une copie remise, et le gel de l établissement d un
// fichier. Chacun est une bonne règle que le démontage d un établissement
// entier rend sans objet. Ils sont rétablis avant la fin — et même si la
// transaction échoue, sans quoi la production resterait sans ses protections.
// Aucun réglage global de session, aucune suspension en bloc.
// =============================================================================

/** Le journal : on le lit, on ne le réécrit jamais. */
const INTOUCHABLES = new Set(["audit_events"]);

/**
 * Les garde-fous mis en sommeil le temps d un demontage, nommes un par un.
 *
 * La liste est courte et le restera : chaque entree doit pouvoir se justifier
 * en une phrase. Ce qui n y figure pas reste actif, y compris l immutabilite
 * du journal d audit.
 */
const GARDES_EN_SOMMEIL = [
  ["study.organization_memberships", "memberships_guard_last_admin"],
  ["study.submission_versions", "submission_versions_immutable"],
  ["study.files", "files_freeze_tenant"],
];

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
    // Les garde-fous neutralisés sont **nommés**, un par un, et pour la durée
    // de cette transaction seulement. Aucun réglage global, aucune suspension
    // en bloc, et le journal d'audit n'en fait pas partie.
    //
    // Chacun est une bonne règle que le démontage d'un établissement entier
    // rend sans objet :
    //
    //   - `memberships_guard_last_admin` refuse de retirer le dernier
    //     administrateur d'un lycée vivant ;
    //   - `submission_versions_immutable` refuse d'effacer une copie remise,
    //     ce qui est exactement ce qu'on veut le reste du temps ;
    //   - `files_freeze_tenant` interdit de changer l'établissement d'un
    //     fichier, et bloque aussi sa suppression.
    for (const [table, garde] of GARDES_EN_SOMMEIL) {
      await sql.query(`alter table ${table} disable trigger ${garde}`);
    }

    // Chaque passe retire au moins une couche de dependances. La chaine
    // s est allongee avec les remises — devoir, copie, version, fichier,
    // correction — et quatre passes ne suffisaient plus : le nettoyage
    // echouait a la fin, sur la suppression de l etablissement. On en laisse
    // largement assez, la boucle s arretant des qu elle ne progresse plus.
    let reste = tables;
    for (let passe = 0; passe < 12 && reste.length > 0; passe += 1) {
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

    for (const [table, garde] of GARDES_EN_SOMMEIL) {
      await sql.query(`alter table ${table} enable trigger ${garde}`);
    }

    await sql.query("commit");
  } catch (erreur) {
    await sql.query("rollback").catch(() => {});
    throw erreur;
  }

  // Les déclencheurs sont rétablis même si la transaction a été défaite : sans
  // cela, un échec de nettoyage laisserait la production sans ses protections,
  // et personne ne s en apercevrait avant le premier incident.
  for (const [table, garde] of GARDES_EN_SOMMEIL) {
    await sql.query(`alter table ${table} enable trigger ${garde}`).catch(() => {});
  }

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
 * Le balayage complet : tout ce qui porte une marque de recette.
 *
 * C'est la seule forme de nettoyage sur laquelle on puisse compter, parce
 * qu'elle ne dépend pas de ce que l'appelant a pensé à noter. Un terrain
 * créé puis abandonné par une erreur survenue trois lignes plus loin n'est
 * dans aucune liste — mais il porte son code `RECETTE`.
 *
 * Les profils sont relevés **avant** le démontage : une fois les adhésions
 * supprimées, plus rien ne relie un compte à son établissement.
 */
export async function balayer(sql, fournisseur, { trace = () => {} } = {}) {
  const { rows: etablissements } = await sql.query(
    "select id, public_code, name from study.organizations where public_code like 'RECETTE%' order by created_at",
  );

  // Les chemins de stockage sont releves **avant** le demontage : une fois les
  // lignes de `files` supprimees, plus rien ne dit ou sont les octets, et ils
  // restent dans le seau sans que rien ne les designe.
  const aRetirerDuStockage = [];
  for (const etablissement of etablissements) {
    const { rows } = await sql.query(
      "select storage_key from study.files where organization_id = $1",
      [etablissement.id],
    );
    for (const ligne of rows) aRetirerDuStockage.push(ligne.storage_key);
  }

  const profils = new Set();
  for (const etablissement of etablissements) {
    const { rows } = await sql.query(
      "select profile_id from study.organization_memberships where organization_id = $1",
      [etablissement.id],
    );
    for (const ligne of rows) profils.add(ligne.profile_id);
  }

  // L'exploitant n'est membre d'aucun établissement de recette. Ce garde-fou
  // existe pour le cas où une requête le ramènerait par erreur : le compte du
  // site ne doit jamais pouvoir être emporté par un nettoyage.
  const { rows: exploitants } = await sql.query("select profile_id from study_prive.editor_staff");
  for (const ligne of exploitants) {
    if (profils.delete(ligne.profile_id)) trace("    (epargne) le compte de l exploitant");
  }

  for (const etablissement of etablissements) {
    trace(`    ${etablissement.public_code} « ${etablissement.name} »`);
    await demonterEtablissement(sql, etablissement.id, { trace });
  }

  await demonterProfils(sql, [...profils], { trace });
  await demonterDemandes(sql, { trace });

  let comptes = 0;
  let objets = 0;
  if (fournisseur !== undefined && fournisseur !== null) {
    for (const profil of profils) {
      const { error } = await fournisseur.auth.admin.deleteUser(profil);
      if (error === null) comptes += 1;
    }
    if (comptes > 0) trace(`    comptes de connexion chez le fournisseur : ${comptes}`);

    // Les octets, enfin. Ils partent en dernier : tant que la base n est pas
    // nettoyee, un objet retire laisserait une ligne qui le designe sans
    // pouvoir le servir — l inverse exact de ce qu on veut.
    if (aRetirerDuStockage.length > 0) {
      const { error } = await fournisseur.storage
        .from("course-materials")
        .remove(aRetirerDuStockage);
      if (error === null) objets = aRetirerDuStockage.length;
      trace(`    objets retires du stockage : ${objets}`);
    }
  }

  return { etablissements: etablissements.length, profils: profils.size, comptes, objets };
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

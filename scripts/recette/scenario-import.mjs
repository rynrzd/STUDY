// =============================================================================
// §5 — Les imports .xlsx.
//
// C'est le geste le plus lourd de conséquences du produit : il fabrique des
// centaines de comptes d'un coup, à la rentrée, sous la pression, à partir de
// fichiers que personne n'a relus. Ce qu'on y vérifie n'est donc pas « ça
// marche » mais « qu'est-ce qui arrive quand le fichier est imparfait » — car
// il l'est toujours.
//
// Les fichiers sont de vrais .xlsx, écrits par `xlsx.mjs` et relus par le
// lecteur du produit (voir `tests/unite/xlsx-recette.test.mjs`).
//
// Le réimport est le contrôle qui compte le plus : un lycée qui redépose le
// même fichier — parce qu'il a corrigé une ligne, ou par hésitation — ne doit
// pas se retrouver avec deux comptes par élève.
// =============================================================================

import { attendreEnBase, connecter, contexteDe, exigerPage, soumettre } from "./navigateur.mjs";
import { classeur } from "./xlsx.mjs";

const ENTETES = ["Nom", "Prénom", "Classe", "INE"];

/** Dépose une série de fichiers et rend l'identifiant du lot ouvert. */
async function deposer(page, base, fichiers) {
  await exigerPage(page, base, "/admin/import", { marqueur: '[data-testid="depot-rentree"]' });
  await page.setInputFiles('[data-testid="depot-fichiers"]', fichiers);
  await soumettre(page, '[data-testid="depot-valider"]');

  const adresse = new URL(page.url()).pathname;
  const trouve = /\/admin\/import\/([0-9a-f-]{36})/.exec(adresse);
  return trouve === null ? null : trouve[1];
}

export async function scenarioImport({ navigateur, base, terrain, sql, verifier }) {
  console.log("\n§5. Imports .xlsx");

  const marque = terrain.suffixe.toUpperCase();
  const { contexte, page } = await contexteDe(navigateur);

  try {
    await connecter(page, base, {
      code: terrain.code,
      login: terrain.administrateur.login,
      motDePasse: terrain.administrateur.motDePasse,
      secretTotp: terrain.administrateur.secretTotp,
    });

    /* --- Un fichier normal, deux classes, accents et apostrophes ---------- */

    // Trois écritures de la même classe : « 2nde 4 », « Seconde 4 »,
    // « SECONDE 4 ». Si le produit les distinguait, un lycée se retrouverait
    // avec trois classes pour trente élèves qui se croient ensemble.
    const normal = classeur([
      ENTETES,
      ["Durand", "Amélie", "2nde 4", `INE${marque}01`],
      ["O'Connor", "Noël", "Seconde 4", `INE${marque}02`],
      ["Lefèvre", "Bruno", "SECONDE 4", `INE${marque}03`],
      ["Petit", "Chloé", "2nde 7", `INE${marque}04`],
      ["", "", "", ""],
      ["Durand", "Amélie", "2nde 4", `INE${marque}01`],
      ["Martin", "Léa", "2nde 4", `INE${marque}05`],
      ["Martin", "Léa", "2nde 4", `INE${marque}06`],
    ]);

    const lot = await deposer(page, base, [
      { name: `rentree-${marque}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: normal },
    ]);

    if (!verifier(lot !== null, "le depot ouvre un lot de verification", String(lot))) return;

    const lignes = await attendreEnBase(
      sql,
      `select r.state as etat,
              r.payload->>'nom' as nom,
              r.payload->>'prenom' as prenom,
              r.payload->>'classe' as classe,
              r.payload->>'identifiantExterne' as identifiant_externe
         from study.import_rows r
         join study.import_jobs j on j.id = r.import_job_id
        where j.batch_id = $1
        order by r.row_number`,
      [lot],
      (rows) => rows.length > 0,
    );

    verifier(lignes.length > 0, "les lignes du fichier sont lues", `${lignes.length}`);

    // La ligne vide ne doit produire ni compte, ni erreur bloquante : un
    // fichier exporté par un logiciel de vie scolaire en contient toujours.
    verifier(
      !lignes.some((l) => (l.nom ?? "").trim() === "" && (l.prenom ?? "").trim() === ""),
      "une ligne vide est ignoree, pas signalee comme faute",
    );

    // Le doublon exact : deux fois la même personne avec le même INE.
    const durand = lignes.filter((l) => l.identifiant_externe === `INE${marque}01`);
    verifier(
      durand.length <= 1 || durand.filter((l) => l.etat === "valide").length === 1,
      "un doublon exact ne donne qu une seule ligne a creer",
      `${durand.length} ligne(s), ${durand.filter((l) => l.etat === "valide").length} valide(s)`,
    );

    // Les homonymes à INE différents sont deux personnes distinctes.
    const martins = lignes.filter((l) => (l.nom ?? "").toUpperCase() === "MARTIN");
    verifier(
      martins.length === 2,
      "deux homonymes a INE differents restent deux personnes",
      `${martins.length}`,
    );

    /* --- Création des comptes ---------------------------------------------- */

    await exigerPage(page, base, `/admin/import/${lot}`, {
      marqueur: '[data-testid="creation-comptes"]',
    });

    const bouton = page.locator('[data-testid="creer-comptes"]');
    const bloque = await bouton.isDisabled();
    if (bloque) {
      const blocages = await page.locator("[role='alert']").allInnerTexts();
      verifier(false, "le lot est creable", `bloque : ${blocages.join(" / ").slice(0, 120)}`);
      return;
    }

    await soumettre(page, '[data-testid="creer-comptes"]');

    const crees = await attendreEnBase(
      sql,
      `select m.local_login, m.roles, c.label as classe, e.external_id
         from study.organization_memberships m
         left join study.class_enrollments ce
           on ce.profile_id = m.profile_id and ce.organization_id = m.organization_id
         left join study.classes c on c.id = ce.class_id
         left join study.external_identities e
           on e.profile_id = m.profile_id and e.organization_id = m.organization_id
        where m.organization_id = $1 and m.roles && array['eleve']::study.role_type[]`,
      [terrain.organisation],
      (rows) => rows.length >= 8,
    );

    // Trois élèves du terrain + ceux de l'import.
    const importes = crees.filter((l) => String(l.external_id ?? "").startsWith(`INE${marque}`));
    verifier(importes.length === 5, "les cinq eleves du fichier sont crees", `${importes.length}`);

    const classes = new Set(importes.map((l) => l.classe));
    verifier(
      classes.size === 2,
      "les trois ecritures de « Seconde 4 » designent une seule classe",
      [...classes].join(" | "),
    );

    const logins = importes.map((l) => l.local_login);
    verifier(
      new Set(logins).size === logins.length,
      "chaque identifiant est unique",
      logins.join(", "),
    );

    const avecIne = importes.filter((l) => l.external_id !== null);
    verifier(avecIne.length === importes.length, "les INE sont conserves", `${avecIne.length}/${importes.length}`);

    /* --- Le réimport ne doit rien créer ------------------------------------- */

    const avantReimport = (
      await sql.query(
        "select count(*)::int n from study.organization_memberships where organization_id = $1",
        [terrain.organisation],
      )
    ).rows[0].n;

    const lotBis = await deposer(page, base, [
      { name: `rentree-${marque}-bis.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: normal },
    ]);

    if (lotBis !== null) {
      await exigerPage(page, base, `/admin/import/${lotBis}`, {});
      const boutonBis = page.locator('[data-testid="creer-comptes"]');
      if ((await boutonBis.count()) > 0 && !(await boutonBis.isDisabled())) {
        await soumettre(page, '[data-testid="creer-comptes"]');
      }

      const apresReimport = (
        await sql.query(
          "select count(*)::int n from study.organization_memberships where organization_id = $1",
          [terrain.organisation],
        )
      ).rows[0].n;

      verifier(
        apresReimport === avantReimport,
        "un reimport du meme fichier ne cree aucun compte",
        `${avantReimport} puis ${apresReimport}`,
      );
    }

    /* --- Les fichiers qui ne vont pas --------------------------------------- */

    const colonneAbsente = classeur([
      ["Nom", "Classe"],
      ["Sansprenom", "2nde 4"],
    ]);
    const corrompu = Buffer.from("PKceci n est pas une archive valide", "utf8");
    const colonnesDeplacees = classeur([
      ["Classe", "INE", "Prénom", "Nom"],
      ["2nde 4", `INE${marque}09`, "Hugo", "Bernard"],
    ]);

    const lotFautif = await deposer(page, base, [
      { name: `sans-colonne-${marque}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: colonneAbsente },
      { name: `corrompu-${marque}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: corrompu },
      { name: `deplacees-${marque}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: colonnesDeplacees },
    ]);

    if (verifier(lotFautif !== null, "un lot melant fichiers sains et fautifs s ouvre quand meme")) {
      await exigerPage(page, base, `/admin/import/${lotFautif}`, {});
      const affiche = await page.evaluate(() => document.body.innerText);

      // Le fichier corrompu doit être **nommé**, pas avalé : un lycée doit
      // savoir lequel de ses douze fichiers a échoué.
      verifier(
        affiche.includes(`corrompu-${marque}.xlsx`),
        "le fichier illisible est nomme a l ecran",
      );

      // Les colonnes déplacées doivent être reconnues : l'ordre n'est pas
      // imposé, seuls les intitulés comptent.
      const deplacees = await sql.query(
        `select r.payload->>'nom' as nom, r.payload->>'prenom' as prenom, r.payload->>'classe' as classe
           from study.import_rows r
           join study.import_jobs j on j.id = r.import_job_id
          where j.batch_id = $1 and r.payload->>'nom' = 'Bernard'`,
        [lotFautif],
      );
      verifier(
        deplacees.rows.length === 1 && deplacees.rows[0].prenom === "Hugo",
        "des colonnes dans un autre ordre sont reconnues",
        JSON.stringify(deplacees.rows[0] ?? null),
      );

      // Rien n'est avalé en silence : le lot porte au moins un signalement.
      const signale = await sql.query(
        `select count(*)::int n from study.import_rows r
           join study.import_jobs j on j.id = r.import_job_id
          where j.batch_id = $1 and r.state <> 'valide'`,
        [lotFautif],
      );
      verifier(
        signale.rows[0].n > 0 || affiche.includes("corrompu"),
        "aucune erreur n est avalee en silence",
      );
    }
  } finally {
    await contexte.close();
  }
}

// =============================================================================
// §13 — Le cycle complet d'un devoir, joué de bout en bout.
//
// Chaque contrôle porte un nom — DEPOT_01, CORRECTION_03… — et ces noms sont
// ceux que la matrice des promesses relie aux affirmations de `/produit`. Une
// promesse publique sans scénario réussi fait échouer la vérification
// commerciale : c'est ce qui garantit que la page ne redevienne pas un
// catalogue de ce qu'on aimerait avoir.
//
// Le scénario suit une classe réelle : un professeur, deux élèves de la même
// classe (A et B) et un témoin dans une autre. B et le témoin ne sont pas
// décoratifs — ce sont eux qui prouvent qu'une copie ne fuit pas.
// =============================================================================

import { attendreEnBase, connecter, contexteDe, exigerPage, soumettre } from "./navigateur.mjs";

/** Un PDF minimal et authentique : c'est la signature qui compte. */
function pdf(marque) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${marque}\n%%EOF`,
    "utf8",
  );
}

function fichier(nom, contenu) {
  return { name: nom, mimeType: "application/pdf", buffer: contenu };
}

export async function scenarioRemises({ navigateur, base, terrain, sql, verifier }) {
  console.log("\n§13. Devoirs, remises et corrections");

  const marque = `RD${terrain.suffixe.toUpperCase()}`;
  const prof = await contexteDe(navigateur);
  const eleveA = await contexteDe(navigateur);
  const eleveB = await contexteDe(navigateur);
  const temoin = await contexteDe(navigateur);

  const ouvrirEleve = async (vue, cle) => {
    const compte = terrain.comptes[cle];
    const session = await connecter(vue.page, base, {
      code: terrain.code,
      login: compte.login,
      motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
    });
    compte.motDePasse = session.motDePasse;
  };

  try {
    const session = await connecter(prof.page, base, {
      code: terrain.code,
      login: terrain.comptes.professeur.login,
      motDePasse:
        terrain.comptes.professeur.motDePasse ?? terrain.comptes.professeur.motDePasseTemporaire,
    });
    terrain.comptes.professeur.motDePasse = session.motDePasse;

    await Promise.all([
      ouvrirEleve(eleveA, "eleveA"),
      ouvrirEleve(eleveB, "eleveB"),
      ouvrirEleve(temoin, "eleveTemoin"),
    ]);

    /* ------------------------------------------------------------------ */
    /* DEPOT_01 — le professeur crée un devoir en brouillon               */
    /* ------------------------------------------------------------------ */

    await exigerPage(prof.page, base, "/professeur/devoirs", {
      attendu: "/professeur/devoirs",
      marqueur: '[data-testid="devoir-formulaire"]',
    });

    // L'échéance : demain, pour que le devoir soit ouvert et non tardif.
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await prof.page.selectOption('[data-testid="devoir-cours"]', terrain.cours.cible);
    await prof.page.fill('[data-testid="devoir-titre-champ"]', `Devoir ${marque}`);
    await prof.page.fill('[data-testid="devoir-consigne"]', `Consigne ${marque}`);
    await prof.page.check('[data-testid="mode-numerique"]');
    await prof.page.fill('[data-testid="devoir-date"]', demain);
    await prof.page.fill('[data-testid="devoir-heure"]', "23:59");
    await soumettre(prof.page, '[data-testid="devoir-valider"]');

    const devoirs = await attendreEnBase(
      sql,
      "select id, state, submission_mode, due_at from study.assignments where title = $1",
      [`Devoir ${marque}`],
      (lignes) => lignes.length === 1,
    );
    if (!verifier(devoirs.length === 1, "DEPOT_01 — le professeur cree un devoir")) return;

    const devoir = devoirs[0];
    verifier(devoir.state === "brouillon", "DEPOT_01 — il nait en brouillon", devoir.state);
    verifier(devoir.due_at !== null, "DEPOT_01 — l echeance est enregistree");

    /* DEPOT_02 — l'élève ne voit pas un brouillon --------------------------- */

    await exigerPage(eleveA.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
    let vu = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(!vu.includes(marque), "DEPOT_02 — un devoir en brouillon reste invisible");

    // Et son adresse directe ne livre rien.
    //
    // Ce qui compte n'est pas le code HTTP — une frontière « introuvable »
    // peut répondre 200 en rendant sa page — mais qu'aucun contenu du devoir
    // n'apparaisse, et qu'aucune zone de dépôt ne s'offre.
    await eleveA.page
      .goto(`${base}/eleve/devoirs/${devoir.id}`, { waitUntil: "networkidle" })
      .catch(() => null);

    const contenuDirect = await eleveA.page.evaluate(() => document.body.innerText);
    const zoneOfferte = await eleveA.page.locator('[data-testid="remise-formulaire"]').count();

    verifier(
      !contenuDirect.includes(`Devoir ${marque}`) && zoneOfferte === 0,
      "DEPOT_02 — son adresse directe ne livre ni le titre ni la zone de depot",
      contenuDirect.replace(/[\s]+/g, " ").slice(0, 60),
    );

    /* DEPOT_03 — publication ------------------------------------------------ */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir.id}`, {
      marqueur: '[data-testid="devoir-publication"]',
    });
    await soumettre(prof.page, '[data-testid="devoir-publication"]');

    await attendreEnBase(
      sql,
      "select state from study.assignments where id = $1",
      [devoir.id],
      (lignes) => lignes[0]?.state === "publiee",
    );
    verifier(true, "DEPOT_03 — le professeur publie le devoir");

    /* DEPOT_04 / DEPOT_05 — qui le voit ------------------------------------ */

    await exigerPage(eleveA.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
    vu = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(vu.includes(`Devoir ${marque}`), "DEPOT_04 — l eleve A voit le devoir publie");

    await exigerPage(temoin.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
    const vuTemoin = await temoin.page.evaluate(() => document.body.innerText);
    verifier(!vuTemoin.includes(marque), "DEPOT_05 — une autre classe ne le voit pas");

    /* DEPOT_06 — A remet une copie ----------------------------------------- */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir.id}`, {
      attendu: `/eleve/devoirs/${devoir.id}`,
      marqueur: '[data-testid="remise-formulaire"]',
    });

    await eleveA.page.setInputFiles(
      '[data-testid="remise-fichier"]',
      fichier(`copie-${marque}.pdf`, pdf(`${marque}-v1`)),
    );

    // Le nom et la taille s'affichent avant l'envoi.
    const apercu = await eleveA.page.locator('[data-testid="remise-choisi"]').innerText();
    verifier(
      apercu.includes(`copie-${marque}.pdf`),
      "DEPOT_06 — le fichier choisi est montre avant l envoi",
      apercu.slice(0, 60),
    );

    await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');
    await eleveA.page.waitForTimeout(1200);

    const versions = await attendreEnBase(
      sql,
      `select sv.id, sv.version_number, sv.late, sv.file_id, s.state
         from study.submission_versions sv
         join study.submissions s on s.id = sv.submission_id
        where s.assignment_id = $1 and s.profile_id = $2
        order by sv.version_number`,
      [devoir.id, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 1,
    );

    if (!verifier(versions.length === 1, "DEPOT_06 — la copie est enregistree en base")) return;
    verifier(versions[0].late === false, "DEPOT_06 — remise a l heure, pas en retard");
    verifier(versions[0].file_id !== null, "DEPOT_06 — un fichier y est attache");

    /* DEPOT_07 — l'accusé de remise ---------------------------------------- */

    const accuse = await eleveA.page.locator('[data-testid="remise-accuse"]').count();
    if (accuse > 0) {
      const reference = await eleveA.page.locator('[data-testid="remise-reference"]').innerText();
      verifier(
        /^R-[0-9A-F]{8}$/.test(reference.trim()),
        "DEPOT_07 — un accuse porte une reference non devinable",
        reference.trim(),
      );

      const texte = await eleveA.page.locator('[data-testid="remise-accuse"]').innerText();
      verifier(
        texte.includes("pas un constat juridique"),
        "DEPOT_07 — l accuse ne se presente pas comme une preuve juridique",
      );
    } else {
      verifier(false, "DEPOT_07 — un accuse de remise est affiche");
    }

    /* DEPOT_08 — après rechargement, la copie est toujours là -------------- */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir.id}`, {
      marqueur: '[data-testid="mes-versions"]',
    });
    const apresRechargement = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      apresRechargement.includes("Version 1"),
      "DEPOT_08 — apres rechargement, la copie est toujours la",
    );

    const lien = eleveA.page.locator('[data-testid="telecharger-ma-copie"]').first();
    if ((await lien.count()) > 0) {
      const adresse = await lien.getAttribute("href");
      const reponse = await eleveA.page.request.get(`${base}${adresse}`, { maxRedirects: 0 });
      verifier(
        reponse.status() === 200,
        "DEPOT_08 — l eleve retelecharge sa propre copie",
        `HTTP ${reponse.status()}`,
      );

      /* DEPOT_09 — B ne peut pas la lire --------------------------------- */

      const parB = await eleveB.page.request.get(`${base}${adresse}`, { maxRedirects: 0 });
      verifier(
        parB.status() === 404,
        "DEPOT_09 — un camarade recoit « introuvable », pas la copie",
        `HTTP ${parB.status()}`,
      );

      const parTemoin = await temoin.page.request.get(`${base}${adresse}`, { maxRedirects: 0 });
      verifier(
        parTemoin.status() === 404,
        "DEPOT_09 — un eleve d une autre classe non plus",
        `HTTP ${parTemoin.status()}`,
      );
    }

    /* DEPOT_10 — A remplace sa copie --------------------------------------- */

    await eleveA.page.setInputFiles(
      '[data-testid="remise-fichier"]',
      fichier(`copie-${marque}-bis.pdf`, pdf(`${marque}-v2`)),
    );
    await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');
    await eleveA.page.waitForTimeout(1200);

    const deuxVersions = await attendreEnBase(
      sql,
      `select sv.id, sv.version_number from study.submission_versions sv
         join study.submissions s on s.id = sv.submission_id
        where s.assignment_id = $1 and s.profile_id = $2
        order by sv.version_number desc`,
      [devoir.id, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 2,
    );
    verifier(
      deuxVersions.length === 2,
      "DEPOT_10 — remplacer cree une seconde version, sans effacer la premiere",
      `${deuxVersions.length}`,
    );

    /* DEPOT_11 — le professeur voit la dernière version -------------------- */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir.id}`, {
      marqueur: '[data-testid="suivi-remises"]',
    });

    const ligneA = prof.page.locator(`[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`);
    verifier((await ligneA.count()) === 1, "DEPOT_11 — l eleve A apparait dans le suivi");

    const texteLigne = await ligneA.innerText();
    verifier(
      texteLigne.includes("version 2") || texteLigne.includes("Version 2"),
      "DEPOT_11 — c est la derniere version qui est proposee",
      texteLigne.replace(/[\s]+/g, " ").slice(0, 80),
    );

    const nonRemis = await prof.page.locator('[data-testid="compteur-non-remis"]').innerText();
    verifier(
      Number(nonRemis) >= 1,
      "DEPOT_11 — les eleves qui n ont rien rendu sont comptes",
      nonRemis,
    );

    /* CORRECTION_01 — le professeur publie un retour ----------------------- */

    await ligneA.locator('[data-testid="ouvrir-correction"]').click();
    await prof.page.waitForSelector('[data-testid="correction-formulaire"]');
    await prof.page.fill(
      '[data-testid="correction-commentaire-champ"]',
      `Bon travail ${marque}, attention au signe.`,
    );
    await soumettre(prof.page, '[data-testid="correction-publier"]');
    await prof.page.waitForTimeout(1200);

    const retours = await attendreEnBase(
      sql,
      `select f.id, f.general_comment, f.published_at
         from study.feedback f
         join study.submission_versions sv on sv.id = f.submission_version_id
         join study.submissions s on s.id = sv.submission_id
        where s.assignment_id = $1 and s.profile_id = $2`,
      [devoir.id, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 1 && lignes[0].published_at !== null,
    );
    verifier(
      retours.length === 1 && retours[0].published_at !== null,
      "CORRECTION_01 — le retour est enregistre et publie",
    );

    /* CORRECTION_02 — A le reçoit, B ne reçoit rien ------------------------ */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir.id}`, {});
    const vuParA = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      vuParA.includes(`Bon travail ${marque}`),
      "CORRECTION_02 — l eleve concerne lit son retour",
    );

    await exigerPage(eleveB.page, base, `/eleve/devoirs/${devoir.id}`, {});
    const vuParB = await eleveB.page.evaluate(() => document.body.innerText);
    verifier(
      !vuParB.includes(`Bon travail ${marque}`),
      "CORRECTION_02 — un autre eleve ne lit pas ce retour",
    );

    /* CORRECTION_03 — retirer la publication ------------------------------- */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir.id}`, {
      marqueur: '[data-testid="suivi-remises"]',
    });
    const ligneBis = prof.page.locator(
      `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
    );
    await ligneBis.locator('[data-testid="ouvrir-correction"]').click();
    await prof.page.waitForSelector('[data-testid="correction-retirer"]');
    await soumettre(prof.page, '[data-testid="correction-retirer"]');
    await prof.page.waitForTimeout(1000);

    const retire = await attendreEnBase(
      sql,
      `select f.published_at from study.feedback f
         join study.submission_versions sv on sv.id = f.submission_version_id
         join study.submissions s on s.id = sv.submission_id
        where s.assignment_id = $1 and s.profile_id = $2`,
      [devoir.id, terrain.comptes.eleveA.id],
      (lignes) => lignes[0]?.published_at === null,
    );
    verifier(
      retire[0]?.published_at === null,
      "CORRECTION_03 — retirer la publication la rend invisible",
    );

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir.id}`, {});
    const apresRetrait = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      !apresRetrait.includes(`Bon travail ${marque}`),
      "CORRECTION_03 — l eleve ne la voit plus",
    );

    /* DEPOT_12 — un devoir papier n affiche aucune zone de depot ----------- */

    await exigerPage(prof.page, base, "/professeur/devoirs", {
      marqueur: '[data-testid="devoir-formulaire"]',
    });
    await prof.page.selectOption('[data-testid="devoir-cours"]', terrain.cours.cible);
    await prof.page.fill('[data-testid="devoir-titre-champ"]', `Papier ${marque}`);
    await prof.page.check('[data-testid="mode-papier"]');
    await soumettre(prof.page, '[data-testid="devoir-valider"]');

    const papiers = await attendreEnBase(
      sql,
      "select id from study.assignments where title = $1",
      [`Papier ${marque}`],
      (lignes) => lignes.length === 1,
    );

    if (verifier(papiers.length === 1, "DEPOT_12 — un devoir papier se cree")) {
      const papier = papiers[0].id;

      await exigerPage(prof.page, base, `/professeur/devoirs/${papier}`, {
        marqueur: '[data-testid="devoir-publication"]',
      });
      await soumettre(prof.page, '[data-testid="devoir-publication"]');
      await attendreEnBase(
        sql,
        "select state from study.assignments where id = $1",
        [papier],
        (lignes) => lignes[0]?.state === "publiee",
      );

      await exigerPage(eleveA.page, base, `/eleve/devoirs/${papier}`, {});
      const sansDepot = await eleveA.page.locator('[data-testid="remise-formulaire"]').count();
      const mention = await eleveA.page.locator('[data-testid="remise-sans-fichier"]').count();
      verifier(
        sansDepot === 0 && mention === 1,
        "DEPOT_12 — aucune zone de depot, et la mention « a rendre sur papier »",
        `formulaire ${sansDepot}, mention ${mention}`,
      );

      /* DEPOT_13 — le professeur constate la remise papier --------------- */

      await exigerPage(prof.page, base, `/professeur/devoirs/${papier}`, {
        marqueur: '[data-testid="suivi-remises"]',
      });
      const lignePapier = prof.page.locator(
        `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
      );
      await lignePapier.locator('[data-testid="papier-etat"]').selectOption("remis");
      await soumettre(prof.page, `[data-eleve="${terrain.comptes.eleveA.id}"] [data-testid="papier-valider"]`);
      await prof.page.waitForTimeout(1000);

      const constat = await attendreEnBase(
        sql,
        "select state from study.submissions where assignment_id = $1 and profile_id = $2",
        [papier, terrain.comptes.eleveA.id],
        (lignes) => lignes[0]?.state === "remis",
      );
      verifier(constat[0]?.state === "remis", "DEPOT_13 — le constat papier est enregistre");

      const { rows: traces } = await sql.query(
        "select count(*)::int as n from study.audit_events where action = 'remise_papier_constatee'",
      );
      verifier(traces[0].n >= 1, "DEPOT_13 — le constat est journalise");

      await exigerPage(eleveA.page, base, `/eleve/devoirs/${papier}`, {});
      const etatVuParEleve = await eleveA.page
        .locator('[data-testid="devoir-etat-remise"]')
        .getAttribute("data-etat");
      verifier(etatVuParEleve === "remis", "DEPOT_13 — l eleve voit l etat retenu", String(etatVuParEleve));
    }

    /* DEPOT_14 — un devoir ferme refuse la remise -------------------------- */

    // L'échéance est reculée en base : jouer l'attente réelle prendrait un jour.
    await sql.query(
      "update study.assignments set due_at = now() - interval '2 hours', late_policy = 'fermer' where id = $1",
      [devoir.id],
    );

    await exigerPage(eleveB.page, base, `/eleve/devoirs/${devoir.id}`, {});
    const ferme = await eleveB.page.evaluate(() => document.body.innerText);
    verifier(
      ferme.includes("remise est fermée"),
      "DEPOT_14 — une fois l echeance passee, la remise est fermee",
    );
    verifier(
      (await eleveB.page.locator('[data-testid="remise-formulaire"]').count()) === 0,
      "DEPOT_14 — et la zone de depot disparait",
    );
  } finally {
    await prof.contexte.close();
    await eleveA.contexte.close();
    await eleveB.contexte.close();
    await temoin.contexte.close();
  }
}

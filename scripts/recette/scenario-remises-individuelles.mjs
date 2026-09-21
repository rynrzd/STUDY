// =============================================================================
// §15 — Le parcours central : remise individuelle, correction individuelle.
//
// Les contrôles `DEPOT_*` couvraient déjà une bonne part de ce cycle. Ceux-ci
// les complètent là où ils ne regardaient pas, et portent les noms que la
// matrice des promesses relie à `/produit`.
//
// Ce que ce fichier cherche à mettre en défaut, et que rien ne cherchait :
//
//   **La voie légitime fermée.** Tous les tests de copie écrits jusqu'ici
//   cherchaient ce qui passe alors qu'il ne devrait pas. Aucun ne vérifiait que
//   le professeur, lui, pouvait ouvrir la copie de son élève. Il ne le pouvait
//   pas — `files_teacher_read` attendait un identifiant de version là où le
//   dépôt écrit celui du devoir, et le bouton rendait « introuvable ».
//
//   **La preuve qui s'évapore.** L'accusé n'existait que le temps de la
//   réponse à l'envoi. Un élève qui veut montrer qu'il a rendu, trois jours
//   plus tard, n'avait rien.
//
//   **Le retard autorisé.** Seul le refus après échéance était éprouvé.
//
//   **La correction avec pièce jointe.** Aucun contrôle ne déposait de fichier
//   corrigé, ni ne vérifiait qui pouvait le télécharger.
//
// Chaque contrôle regarde quatre choses : l'écran, la réponse réseau quand il
// y en a une, l'écriture en base, et l'isolation.
// =============================================================================

import { attendreEnBase, connecter, contexteDe, exigerPage, soumettre } from "./navigateur.mjs";

/** Un PDF minimal et authentique : c'est la signature qui compte. */
function pdf(marque) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${marque}\n%%EOF`,
    "utf8",
  );
}

const fichier = (nom, marque) => ({
  name: nom,
  mimeType: "application/pdf",
  buffer: pdf(marque),
});

export async function scenarioRemisesIndividuelles({ navigateur, base, terrain, sql, verifier }) {
  console.log("\n§15. Remises et corrections individuelles");

  const marque = `RI${terrain.suffixe.toUpperCase()}`;
  const prof = await contexteDe(navigateur);
  const eleveA = await contexteDe(navigateur);
  const eleveB = await contexteDe(navigateur);
  const temoin = await contexteDe(navigateur);

  /** Les résultats d'attaque, rassemblés pour un tableau lisible à la fin. */
  const attaques = [];

  const ouvrir = async (vue, cle) => {
    const compte = terrain.comptes[cle];
    const session = await connecter(vue.page, base, {
      code: terrain.code,
      login: compte.login,
      motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
    });
    compte.motDePasse = session.motDePasse;
  };

  /**
   * Une tentative d'accès, avec son résultat HTTP **et** son résultat métier.
   *
   * Les deux comptent, et pour des raisons différentes : le code dit si le
   * serveur a refusé, le corps dit si quelque chose a fuité malgré un 200.
   * Un écran qui répond 200 en affichant « introuvable » est correct ; un 200
   * qui laisse passer un nom de fichier ne l'est pas.
   */
  const tenter = async (vue, role, ressource, adresse, interdits) => {
    const reponse = await vue.page.request.get(`${base}${adresse}`, {
      failOnStatusCode: false,
    });
    const corps = await reponse.text().catch(() => "");
    const fuite = interdits.filter((mot) => mot !== "" && corps.includes(mot));

    attaques.push({
      role,
      ressource,
      http: reponse.status(),
      metier: reponse.status() >= 400 ? "refus" : fuite.length > 0 ? "FUITE" : "rien servi",
      fuite,
    });

    return { statut: reponse.status(), fuite };
  };

  try {
    await ouvrir(prof, "professeur");
    await Promise.all([
      ouvrir(eleveA, "eleveA"),
      ouvrir(eleveB, "eleveB"),
      ouvrir(temoin, "eleveTemoin"),
    ]);

    /* ==================================================================== */
    /* REMISE_01 — un brouillon n'est visible de personne                   */
    /* ==================================================================== */

    await exigerPage(prof.page, base, "/professeur/devoirs", {
      attendu: "/professeur/devoirs",
      marqueur: '[data-testid="devoir-formulaire"]',
    });

    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await prof.page.selectOption('[data-testid="devoir-cours"]', terrain.cours.cible);
    await prof.page.fill('[data-testid="devoir-titre-champ"]', `Remise ${marque}`);
    await prof.page.fill('[data-testid="devoir-consigne"]', `Consigne ${marque}`);
    await prof.page.check('[data-testid="mode-numerique"]');
    await prof.page.fill('[data-testid="devoir-date"]', demain);
    await prof.page.fill('[data-testid="devoir-heure"]', "23:59");
    await soumettre(prof.page, '[data-testid="devoir-valider"]');

    const devoirs = await attendreEnBase(
      sql,
      "select id, state from study.assignments where title = $1",
      [`Remise ${marque}`],
      (lignes) => lignes.length === 1,
    );

    if (!verifier(devoirs.length === 1, "REMISE_01 — le devoir se cree")) return;
    const devoir = devoirs[0].id;

    verifier(devoirs[0].state === "brouillon", "REMISE_01 — il nait en brouillon");

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {});
    const brouillonVu = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      !brouillonVu.includes(`Consigne ${marque}`),
      "REMISE_01 — un brouillon reste invisible, meme par son adresse directe",
    );

    /* ==================================================================== */
    /* REMISE_02 — publié, il paraît dans la bonne classe et nulle part ailleurs */
    /* ==================================================================== */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="devoir-publication"]',
    });
    await soumettre(prof.page, '[data-testid="devoir-publication"]');

    await attendreEnBase(
      sql,
      "select state from study.assignments where id = $1",
      [devoir],
      (lignes) => lignes[0]?.state === "publiee",
    );

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {});
    const vuParA = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      vuParA.includes(`Consigne ${marque}`),
      "REMISE_02 — l eleve de la classe voit le devoir publie",
    );

    await exigerPage(temoin.page, base, `/eleve/devoirs/${devoir}`, {});
    const vuParLeTemoin = await temoin.page.evaluate(() => document.body.innerText);
    verifier(
      !vuParLeTemoin.includes(`Consigne ${marque}`),
      "REMISE_02 — une autre classe ne le voit pas",
    );

    /* ==================================================================== */
    /* REMISE_03 — le dépôt                                                  */
    /* ==================================================================== */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {
      marqueur: '[data-testid="remise-formulaire"]',
    });

    await eleveA.page.setInputFiles(
      '[data-testid="remise-fichier"]',
      fichier(`copie-${marque}.pdf`, marque),
    );

    // Le fichier choisi est montré avant l'envoi : sans cela, l'élève envoie
    // à l'aveugle et découvre son erreur une fois la copie rendue.
    const apercu = await eleveA.page.locator('[data-testid="remise-choisi"]').count();
    verifier(apercu === 1, "REMISE_03 — le fichier choisi est montre avant l envoi");

    await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');

    const versions = await attendreEnBase(
      sql,
      `select v.id, v.version_number, v.late, v.file_id
         from study.submission_versions v
         join study.submissions s on s.id = v.submission_id
        where s.assignment_id = $1 and s.profile_id = $2
        order by v.version_number`,
      [devoir, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 1,
    );

    verifier(
      versions.length === 1 && versions[0].file_id !== null,
      "REMISE_03 — la copie est en base, avec son fichier",
    );
    verifier(versions[0]?.late === false, "REMISE_03 — remise avant l echeance, donc non tardive");

    const accuse = await eleveA.page.locator('[data-testid="remise-accuse"]').count();
    verifier(accuse === 1, "REMISE_03 — un accuse est rendu apres ecriture, pas avant");

    /* ==================================================================== */
    /* REMISE_04 — elle survit au rechargement                              */
    /* ==================================================================== */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {
      marqueur: '[data-testid="mes-versions"]',
    });

    const apresRechargement = await eleveA.page.locator('[data-testid="ma-version"]').count();
    verifier(apresRechargement === 1, "REMISE_04 — apres rechargement, la remise est la");

    const telechargement = await eleveA.page.locator('[data-testid="telecharger-ma-copie"]').first();
    const lienCopie = await telechargement.getAttribute("href");
    const maCopie = await eleveA.page.request.get(`${base}${lienCopie}`, {
      failOnStatusCode: false,
    });
    verifier(
      maCopie.ok(),
      "REMISE_04 — l eleve retelecharge sa propre copie",
      `HTTP ${maCopie.status()}`,
    );

    const premierFichier = versions[0].file_id;

    /* ==================================================================== */
    /* REMISE_05 / REMISE_06 — le remplacement                              */
    /* ==================================================================== */

    await eleveA.page.setInputFiles(
      '[data-testid="remise-fichier"]',
      fichier(`copie-${marque}-v2.pdf`, `${marque} v2`),
    );
    await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');

    const deux = await attendreEnBase(
      sql,
      `select v.id, v.version_number, v.file_id
         from study.submission_versions v
         join study.submissions s on s.id = v.submission_id
        where s.assignment_id = $1 and s.profile_id = $2
        order by v.version_number`,
      [devoir, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 2,
    );

    verifier(
      deux.length === 2,
      "REMISE_05 — remplacer cree une seconde version sans effacer la premiere",
      `${deux.length} version(s)`,
    );

    const secondFichier = deux[1]?.file_id ?? null;

    // L'ancienne version : sa ligne reste, ses octets ne sont plus servis.
    const ancienne = await eleveA.page.request.get(`${base}/documents/${premierFichier}`, {
      failOnStatusCode: false,
    });
    verifier(
      ancienne.status() >= 400,
      "REMISE_06 — l ancienne version n est plus servie a son auteur",
      `HTTP ${ancienne.status()}`,
    );

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {
      marqueur: '[data-testid="mes-versions"]',
    });
    const remplacees = await eleveA.page.locator('[data-testid="version-remplacee"]').count();
    const courantes = await eleveA.page
      .locator('[data-testid="ma-version"][data-courante="oui"]')
      .count();
    verifier(
      remplacees === 1 && courantes === 1,
      "REMISE_06 — l ecran dit « remplacee », et ne propose qu une copie",
      `remplacees ${remplacees}, courantes ${courantes}`,
    );

    /* ==================================================================== */
    /* REMISE_07 / REMISE_08 — l'isolation                                  */
    /* ==================================================================== */

    const nomDuFichier = `copie-${marque}-v2.pdf`;

    await tenter(
      eleveB,
      "eleve de la meme classe",
      "la copie de A",
      `/documents/${secondFichier}`,
      [nomDuFichier, marque],
    );
    const parB = attaques[attaques.length - 1];
    verifier(
      parB.http >= 400 && parB.fuite.length === 0,
      "REMISE_07 — un camarade n obtient pas la copie de A",
      `HTTP ${parB.http}`,
    );

    await tenter(
      temoin,
      "eleve d une autre classe",
      "la copie de A",
      `/documents/${secondFichier}`,
      [nomDuFichier, marque],
    );
    const parLeTemoinFichier = attaques[attaques.length - 1];
    verifier(
      parLeTemoinFichier.http >= 400 && parLeTemoinFichier.fuite.length === 0,
      "REMISE_08 — une autre classe non plus",
      `HTTP ${parLeTemoinFichier.http}`,
    );

    // Et la page du devoir ne dit pas non plus qu'une copie existe.
    await tenter(
      eleveB,
      "eleve de la meme classe",
      "la page du devoir de A",
      `/eleve/devoirs/${devoir}`,
      [nomDuFichier],
    );
    const pageParB = attaques[attaques.length - 1];
    verifier(
      pageParB.fuite.length === 0,
      "REMISE_07 — et l ecran ne nomme pas le fichier d un autre",
    );

    /* ==================================================================== */
    /* REMISE_11 — le professeur ouvre la copie                             */
    /* ==================================================================== */
    //
    // C'est le contrôle qui manquait. Sans lui, la panne est restée invisible :
    // tous les autres cherchaient des fuites, aucun ne vérifiait l'accès.

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="suivi-remises"]',
    });

    const ligneA = prof.page.locator(
      `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
    );
    const lienProf = await ligneA.locator('[data-testid="telecharger-copie"]').getAttribute("href");

    const copieParLeProf = await prof.page.request.get(`${base}${lienProf}`, {
      failOnStatusCode: false,
    });
    verifier(
      copieParLeProf.ok(),
      "REMISE_11 — le professeur du cours ouvre reellement la copie de son eleve",
      `HTTP ${copieParLeProf.status()}`,
    );

    // Le nom du fichier et la référence de l'accusé sont sur sa liste.
    const surLaListe = await prof.page.evaluate(() => document.body.innerText);
    verifier(
      surLaListe.includes(nomDuFichier),
      "REMISE_11 — le nom du fichier remis figure sur le suivi",
    );
    verifier(
      /R-[0-9A-F]{8}/.test(surLaListe),
      "REMISE_11 — la reference de l accuse aussi, pour recouper avec l eleve",
    );

    // Le cas « professeur non affecté au cours » n'est pas jouable ici : le
    // terrain n'a qu'un professeur, et il enseigne les deux classes. Il est
    // prouvé en base, où un second enseignant existe — voir le test
    // « copie — et personne d autre ne l ouvre » de tests/db/preuve-et-copies.

    /* ==================================================================== */
    /* PREUVE_01 — la preuve de remise                                      */
    /* ==================================================================== */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}/preuve`, {
      attendu: `/eleve/devoirs/${devoir}/preuve`,
      marqueur: '[data-testid="preuve-details"]',
    });

    const preuve = await eleveA.page.evaluate(() => {
      const lire = (marque) =>
        document.querySelector(`[data-testid="${marque}"]`)?.textContent?.trim() ?? "";
      return {
        reference: lire("preuve-reference"),
        devoir: lire("preuve-devoir"),
        eleve: lire("preuve-eleve"),
        classe: lire("preuve-classe"),
        fichier: lire("preuve-fichier"),
        date: lire("preuve-date"),
        etat: lire("preuve-etat"),
        avertissement: lire("preuve-avertissement"),
      };
    });

    verifier(
      /^R-[0-9A-F]{8}$/.test(preuve.reference),
      "PREUVE_01 — une reference non devinable",
      preuve.reference,
    );
    verifier(preuve.devoir.includes(marque), "PREUVE_01 — le devoir est nomme");
    verifier(preuve.eleve.length > 3, "PREUVE_01 — l eleve est nomme", preuve.eleve);
    verifier(preuve.classe.length > 0 && preuve.classe !== "—", "PREUVE_01 — la classe est nommee");
    verifier(preuve.fichier === nomDuFichier, "PREUVE_01 — le nom du fichier remis y figure");
    verifier(preuve.date.includes("Paris"), "PREUVE_01 — la date est donnee en heure de Paris");
    verifier(preuve.etat.length > 0, "PREUVE_01 — l etat a l heure ou en retard est dit");
    verifier(
      /pas un constat juridique/i.test(preuve.avertissement),
      "PREUVE_01 — elle ne se presente pas comme un constat juridique",
    );

    // À l'impression, l'interface disparaît et la preuve reste.
    await eleveA.page.emulateMedia({ media: "print" });
    const imprimee = await eleveA.page.evaluate(() => {
      const visible = (marque) => {
        const el = document.querySelector(`[data-testid="${marque}"]`);
        return el !== null && el.getClientRects().length > 0;
      };
      return {
        details: visible("preuve-details"),
        avertissement: visible("preuve-avertissement"),
        navigation: document.querySelector("nav")?.getClientRects().length ?? 0,
        boutons: [...document.querySelectorAll("a.bouton")].filter(
          (a) => a.getClientRects().length > 0,
        ).length,
      };
    });
    await eleveA.page.emulateMedia({ media: "screen" });

    verifier(
      imprimee.details && imprimee.avertissement,
      "PREUVE_01 — a l impression, la preuve et son avertissement restent",
    );
    verifier(
      imprimee.navigation === 0 && imprimee.boutons === 0,
      "PREUVE_01 — a l impression, la navigation et les boutons disparaissent",
      `nav ${imprimee.navigation}, boutons ${imprimee.boutons}`,
    );

    // La preuve d'un autre n'est pas lisible.
    await tenter(
      eleveB,
      "eleve de la meme classe",
      "la preuve de remise de A",
      `/eleve/devoirs/${devoir}/preuve`,
      [nomDuFichier, preuve.reference],
    );
    const preuveParB = attaques[attaques.length - 1];
    verifier(
      preuveParB.fuite.length === 0,
      "PREUVE_01 — la preuve d un autre eleve ne se lit pas",
      `HTTP ${preuveParB.http}`,
    );

    /* ==================================================================== */
    /* CORR_IND_01 à 05 — la correction individuelle                        */
    /* ==================================================================== */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="suivi-remises"]',
    });

    const ligneBis = prof.page.locator(
      `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
    );
    await ligneBis.locator('[data-testid="ouvrir-correction"]').click();
    await prof.page.waitForSelector('[data-testid="correction-formulaire"]');

    await prof.page.fill(
      '[data-testid="correction-commentaire-champ"]',
      `Personnel ${marque} : revois la question 2.`,
    );
    await prof.page.setInputFiles(
      '[data-testid="correction-fichier"]',
      fichier(`corrige-${marque}.pdf`, `corrige ${marque}`),
    );
    await soumettre(prof.page, '[data-testid="correction-brouillon"]');

    const retours = await attendreEnBase(
      sql,
      `select f.id, f.file_id, f.published_at
         from study.feedback f
         join study.submission_versions v on v.id = f.submission_version_id
         join study.submissions s on s.id = v.submission_id
        where s.assignment_id = $1 and s.profile_id = $2`,
      [devoir, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 1,
    );

    verifier(
      retours.length === 1 && retours[0].published_at === null,
      "CORR_IND_01 — la correction individuelle nait en brouillon",
    );
    verifier(
      retours[0]?.file_id !== null,
      "CORR_IND_01 — le fichier corrige y est attache",
    );

    const corrige = retours[0].file_id;

    // Tant qu'elle n'est pas publiée, l'élève ne sait rien — ni le texte, ni
    // l'existence du fichier.
    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {});
    const avantPublication = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      !avantPublication.includes(`Personnel ${marque}`),
      "CORR_IND_01 — un brouillon de correction n est pas lu par son destinataire",
    );

    const corrigeAvant = await eleveA.page.request.get(`${base}/documents/${corrige}`, {
      failOnStatusCode: false,
    });
    verifier(
      corrigeAvant.status() >= 400,
      "CORR_IND_01 — et son fichier ne se telecharge pas non plus",
      `HTTP ${corrigeAvant.status()}`,
    );

    /* --- Publication ----------------------------------------------------- */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="suivi-remises"]',
    });
    const ligneTer = prof.page.locator(
      `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
    );
    await ligneTer.locator('[data-testid="ouvrir-correction"]').click();
    await prof.page.waitForSelector('[data-testid="correction-publier"]');
    await soumettre(prof.page, '[data-testid="correction-publier"]');

    await attendreEnBase(
      sql,
      `select f.published_at from study.feedback f
         join study.submission_versions v on v.id = f.submission_version_id
         join study.submissions s on s.id = v.submission_id
        where s.assignment_id = $1 and s.profile_id = $2`,
      [devoir, terrain.comptes.eleveA.id],
      (lignes) => lignes[0]?.published_at !== null,
    );

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {
      marqueur: '[data-testid="correction-recue"]',
    });
    const apresPublication = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(
      apresPublication.includes(`Personnel ${marque}`),
      "CORR_IND_02 — publiee, l eleve concerne la lit",
    );

    const corrigeApres = await eleveA.page.request.get(`${base}/documents/${corrige}`, {
      failOnStatusCode: false,
    });
    verifier(
      corrigeApres.ok(),
      "CORR_IND_04 — le fichier corrige descend a son destinataire",
      `HTTP ${corrigeApres.status()}`,
    );

    /* --- Et à personne d'autre ------------------------------------------ */

    await exigerPage(eleveB.page, base, `/eleve/devoirs/${devoir}`, {});
    const vuParBApres = await eleveB.page.evaluate(() => document.body.innerText);
    verifier(
      !vuParBApres.includes(`Personnel ${marque}`),
      "CORR_IND_03 — un camarade ne recoit rien de cette correction",
    );

    await tenter(
      eleveB,
      "eleve de la meme classe",
      "le corrige individuel de A",
      `/documents/${corrige}`,
      [`corrige-${marque}.pdf`, marque],
    );
    const corrigeParB = attaques[attaques.length - 1];
    verifier(
      corrigeParB.http >= 400 && corrigeParB.fuite.length === 0,
      "CORR_IND_04 — et son fichier corrige ne lui est pas servi",
      `HTTP ${corrigeParB.http}`,
    );

    await tenter(
      temoin,
      "eleve d une autre classe",
      "le corrige individuel de A",
      `/documents/${corrige}`,
      [`corrige-${marque}.pdf`, marque],
    );

    /* --- CORR_IND_05 — la notification interne --------------------------- */

    await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
    await exigerPage(eleveB.page, base, "/eleve", { attendu: "/eleve" });

    const prevenuA = await attendreEnBase(
      sql,
      `select id from study.nouveautes
        where profile_id = $1 and genre = 'retour_individuel' and objet = $2`,
      [terrain.comptes.eleveA.id, devoir],
      (lignes) => lignes.length === 1,
    );
    const prevenuB = await sql.query(
      `select count(*)::int n from study.nouveautes
        where profile_id = $1 and genre = 'retour_individuel' and objet = $2`,
      [terrain.comptes.eleveB.id, devoir],
    );

    verifier(
      prevenuA.length === 1 && prevenuB.rows[0].n === 0,
      "CORR_IND_05 — seul le destinataire est prevenu de son retour",
      `A ${prevenuA.length}, B ${prevenuB.rows[0].n}`,
    );

    /* ==================================================================== */
    /* REMISE_09 / REMISE_10 — le retard                                    */
    /* ==================================================================== */

    // Deux devoirs jumeaux, échéance déjà passée, et deux politiques
    // opposées. L'échéance est reculée **en base** : l'horloge du serveur est
    // la seule qui décide, et la déplacer depuis l'écran ne prouverait rien.

    for (const [politique, nom, attenduRemis] of [
      ["accepter_avec_retard", "tardif", true],
      ["fermer", "ferme", false],
    ]) {
      await exigerPage(prof.page, base, "/professeur/devoirs", {
        marqueur: '[data-testid="devoir-formulaire"]',
      });
      await prof.page.selectOption('[data-testid="devoir-cours"]', terrain.cours.cible);
      await prof.page.fill('[data-testid="devoir-titre-champ"]', `Retard ${nom} ${marque}`);
      await prof.page.check('[data-testid="mode-numerique"]');
      await prof.page.fill('[data-testid="devoir-date"]', demain);
      await soumettre(prof.page, '[data-testid="devoir-valider"]');

      const lot = await attendreEnBase(
        sql,
        "select id from study.assignments where title = $1",
        [`Retard ${nom} ${marque}`],
        (lignes) => lignes.length === 1,
      );
      const cible = lot[0].id;

      await exigerPage(prof.page, base, `/professeur/devoirs/${cible}`, {
        marqueur: '[data-testid="devoir-publication"]',
      });
      await soumettre(prof.page, '[data-testid="devoir-publication"]');
      await attendreEnBase(
        sql,
        "select state from study.assignments where id = $1",
        [cible],
        (lignes) => lignes[0]?.state === "publiee",
      );

      await sql.query(
        "update study.assignments set due_at = now() - interval '2 hours', late_policy = $2 where id = $1",
        [cible, politique],
      );

      await exigerPage(eleveA.page, base, `/eleve/devoirs/${cible}`, {});
      const zone = await eleveA.page.locator('[data-testid="remise-formulaire"]').count();

      if (attenduRemis) {
        verifier(zone === 1, "REMISE_09 — retard autorise : la zone de depot reste ouverte");

        await eleveA.page.setInputFiles(
          '[data-testid="remise-fichier"]',
          fichier(`tardive-${marque}.pdf`, `${marque} tard`),
        );
        await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');

        const tardives = await attendreEnBase(
          sql,
          `select v.late from study.submission_versions v
             join study.submissions s on s.id = v.submission_id
            where s.assignment_id = $1 and s.profile_id = $2`,
          [cible, terrain.comptes.eleveA.id],
          (lignes) => lignes.length === 1,
        );
        verifier(
          tardives[0]?.late === true,
          "REMISE_09 — la remise est acceptee et marquee tardive par l horloge du serveur",
        );

        await exigerPage(eleveA.page, base, `/eleve/devoirs/${cible}/preuve`, {
          marqueur: '[data-testid="preuve-details"]',
        });
        const etatTardif = await eleveA.page
          .locator('[data-testid="preuve-etat"]')
          .getAttribute("data-retard");
        verifier(
          etatTardif === "oui",
          "REMISE_09 — et la preuve le dit : une preuve qui tairait le retard ne prouverait rien",
        );
      } else {
        verifier(zone === 0, "REMISE_10 — retard interdit : plus aucune zone de depot");

        const nonRemis = await sql.query(
          `select count(*)::int n from study.submission_versions v
             join study.submissions s on s.id = v.submission_id
            where s.assignment_id = $1`,
          [cible],
        );
        verifier(
          nonRemis.rows[0].n === 0,
          "REMISE_10 — et rien n a ete ecrit en base",
          `${nonRemis.rows[0].n}`,
        );
      }
    }

    /* ==================================================================== */
    /* PAPIER_01 / PAPIER_02                                                */
    /* ==================================================================== */

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

    if (verifier(papiers.length === 1, "PAPIER_01 — le devoir papier se cree")) {
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
      const zonePapier = await eleveA.page.locator('[data-testid="remise-formulaire"]').count();
      const mention = await eleveA.page.locator('[data-testid="remise-sans-fichier"]').count();
      const texte = await eleveA.page.evaluate(() => document.body.innerText);

      verifier(
        zonePapier === 0 && mention === 1 && /rendre sur papier/i.test(texte),
        "PAPIER_01 — aucune zone de depot, et la mention « a rendre sur papier »",
        `zone ${zonePapier}, mention ${mention}`,
      );

      // Le professeur constate ce qu'il a reçu en main propre.
      await exigerPage(prof.page, base, `/professeur/devoirs/${papier}`, {
        marqueur: '[data-testid="suivi-remises"]',
      });
      const lignePapier = prof.page.locator(
        `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
      );
      await lignePapier.locator('[data-testid="papier-etat"]').selectOption("remis");
      await soumettre(prof.page, '[data-testid="papier-valider"]');

      const constat = await attendreEnBase(
        sql,
        "select state from study.submissions where assignment_id = $1 and profile_id = $2",
        [papier, terrain.comptes.eleveA.id],
        (lignes) => lignes[0]?.state === "remis",
      );
      verifier(constat[0]?.state === "remis", "PAPIER_02 — le professeur marque « remis »");

      const journal = await sql.query(
        `select count(*)::int n from study.audit_events
          where object_kind = 'submission' and organization_id = $1`,
        [terrain.organisation],
      );
      verifier(journal.rows[0].n >= 1, "PAPIER_02 — le constat est journalise");

      await exigerPage(eleveA.page, base, `/eleve/devoirs/${papier}`, {});
      const etatChezLEleve = await eleveA.page
        .locator('[data-testid="devoir-etat-remise"]')
        .getAttribute("data-etat");
      verifier(etatChezLEleve === "remis", "PAPIER_02 — l eleve voit l etat retenu", String(etatChezLEleve));
    }

    /* ==================================================================== */
    /* Le tableau des tentatives                                            */
    /* ==================================================================== */

    console.log("\n  Tentatives d acces, avec de vraies sessions :");
    console.log(
      "  " +
        "role".padEnd(28) +
        "ressource".padEnd(30) +
        "HTTP".padEnd(6) +
        "resultat metier",
    );
    for (const essai of attaques) {
      console.log(
        "  " +
          essai.role.padEnd(28) +
          essai.ressource.padEnd(30) +
          String(essai.http).padEnd(6) +
          essai.metier +
          (essai.fuite.length > 0 ? ` (${essai.fuite.join(", ")})` : ""),
      );
    }

    const fuites = attaques.filter((e) => e.fuite.length > 0);
    verifier(
      fuites.length === 0,
      "SECURITE — aucune tentative n a obtenu de metadonnee sensible",
      fuites.map((f) => `${f.role} → ${f.ressource}`).join(" ; "),
    );
  } finally {
    for (const vue of [prof, eleveA, eleveB, temoin]) {
      await vue.contexte.close().catch(() => {});
    }
  }
}

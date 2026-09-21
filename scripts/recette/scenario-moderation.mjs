// =============================================================================
// §14 — Correction commune, signalement et modération, nouveautés internes.
//
// Trois sections du cahier V5 jouées contre la production réelle, avec des
// comptes jetables et un établissement démonté à la fin.
//
// Ce que ce scénario cherche à mettre en défaut :
//
//   **Une correction commune qui fuite.** Un brouillon lisible, un corrigé
//   téléchargeable avant publication, ou une autre classe qui la voit.
//
//   **Un signalement qui expose celui qui l'a fait.** C'est le défaut qui
//   rendrait le bouton inutile : un élève qui craint d'être identifié ne
//   signalera pas, et le recours n'aura été que décoratif.
//
//   **Un contenu masqué qui reste lisible.** Masquer sans effet est pire que ne
//   pas masquer : l'établissement croit avoir agi.
//
//   **Une notification qui franchit la classe, ou qui revient après lecture.**
//
// Les noms — CORRECTION_04, MODERATION_01, NOUVEAUTE_02… — sont ceux que la
// matrice des promesses relie aux affirmations de `/produit`.
// =============================================================================

import { attendreEnBase, connecter, contexteDe, exigerPage, soumettre } from "./navigateur.mjs";

/** Un PDF minimal et authentique : c'est la signature qui compte. */
function pdf(marque) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${marque}\n%%EOF`,
    "utf8",
  );
}

export async function scenarioModeration({ navigateur, base, terrain, sql, verifier }) {
  console.log("\n§14. Correction commune, signalement, nouveautes");

  const marque = `MOD${terrain.suffixe.toUpperCase()}`;
  const prof = await contexteDe(navigateur);
  const eleveA = await contexteDe(navigateur);
  const eleveB = await contexteDe(navigateur);
  const temoin = await contexteDe(navigateur);
  const admin = await contexteDe(navigateur);

  const ouvrir = async (vue, cle) => {
    const compte = terrain.comptes[cle];
    const session = await connecter(vue.page, base, {
      code: terrain.code,
      login: compte.login,
      motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
    });
    compte.motDePasse = session.motDePasse;
  };

  try {
    await ouvrir(prof, "professeur");
    await Promise.all([ouvrir(eleveA, "eleveA"), ouvrir(eleveB, "eleveB"), ouvrir(temoin, "eleveTemoin")]);

    /* ==================================================================== */
    /* §5.2 — La correction commune                                         */
    /* ==================================================================== */

    await exigerPage(prof.page, base, "/professeur/devoirs", {
      attendu: "/professeur/devoirs",
      marqueur: '[data-testid="devoir-formulaire"]',
    });

    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await prof.page.selectOption('[data-testid="devoir-cours"]', terrain.cours.cible);
    await prof.page.fill('[data-testid="devoir-titre-champ"]', `Commune ${marque}`);
    await prof.page.fill('[data-testid="devoir-consigne"]', `Consigne ${marque}`);
    await prof.page.check('[data-testid="mode-numerique"]');
    await prof.page.fill('[data-testid="devoir-date"]', demain);
    await prof.page.fill('[data-testid="devoir-heure"]', "23:59");
    await soumettre(prof.page, '[data-testid="devoir-valider"]');

    const devoirs = await attendreEnBase(
      sql,
      "select id from study.assignments where title = $1",
      [`Commune ${marque}`],
      (lignes) => lignes.length === 1,
    );

    if (!verifier(devoirs.length === 1, "CORRECTION_04 — le devoir support se cree")) return;
    const devoir = devoirs[0].id;

    // Publier, pour que les destinataires soient inscrits.
    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="devoir-publication"]',
    });
    await soumettre(prof.page, '[data-testid="devoir-publication"]');

    const destinataires = await attendreEnBase(
      sql,
      "select profile_id from study.assignment_recipients where assignment_id = $1 and status = 'concerne'",
      [devoir],
      (lignes) => lignes.length >= 2,
    );
    verifier(
      destinataires.length >= 2,
      "CORRECTION_04 — la publication inscrit la classe",
      `${destinataires.length} destinataire(s)`,
    );

    /* --- Le brouillon ne se lit pas ------------------------------------- */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="correction-commune-texte"]',
    });
    await prof.page.fill(
      '[data-testid="correction-commune-texte"]',
      `Il fallait appliquer Thales ${marque}.`,
    );
    await prof.page.setInputFiles('[data-testid="correction-commune-fichier"]', {
      name: `corrige-${marque}.pdf`,
      mimeType: "application/pdf",
      buffer: pdf(marque),
    });
    await soumettre(prof.page, '[data-testid="correction-commune-brouillon"]');

    const brouillons = await attendreEnBase(
      sql,
      "select id, file_id, published_at from study.assignment_corrections where assignment_id = $1",
      [devoir],
      (lignes) => lignes.length === 1,
    );

    if (
      verifier(
        brouillons.length === 1 && brouillons[0].published_at === null,
        "CORRECTION_04 — la correction commune nait en brouillon",
      )
    ) {
      await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {});
      const vuEnBrouillon = await eleveA.page.evaluate(() => document.body.innerText);
      verifier(
        !vuEnBrouillon.includes(`Thales ${marque}`),
        "CORRECTION_04 — un brouillon n est lu par aucun eleve",
      );

      // Le fichier non plus : une politique sur la table ne sert a rien si le
      // PDF reste telechargeable par son adresse directe.
      const fichierCorrige = brouillons[0].file_id;
      if (fichierCorrige !== null) {
        const reponse = await eleveA.page.request.get(`${base}/documents/${fichierCorrige}`);
        verifier(
          reponse.status() >= 400,
          "CORRECTION_04 — le corrige d un brouillon ne se telecharge pas",
          `HTTP ${reponse.status()}`,
        );
      }
    }

    /* --- Publiée : la classe la lit, une autre classe non ---------------- */

    await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
      marqueur: '[data-testid="correction-commune-publier"]',
    });
    await soumettre(prof.page, '[data-testid="correction-commune-publier"]');

    const publiees = await attendreEnBase(
      sql,
      "select id, file_id, published_at from study.assignment_corrections where assignment_id = $1",
      [devoir],
      (lignes) => lignes[0]?.published_at !== null,
    );
    verifier(
      publiees[0]?.published_at !== null,
      "CORRECTION_05 — la correction commune se publie",
    );

    for (const [vue, cle] of [
      [eleveA, "eleveA"],
      [eleveB, "eleveB"],
    ]) {
      await exigerPage(vue.page, base, `/eleve/devoirs/${devoir}`, {});
      const vuPar = await vue.page.evaluate(() => document.body.innerText);
      verifier(
        vuPar.includes(`Thales ${marque}`),
        `CORRECTION_05 — ${cle} lit la correction de la classe`,
      );
    }

    await exigerPage(temoin.page, base, `/eleve/devoirs/${devoir}`, {});
    const vuParLeTemoin = await temoin.page.evaluate(() => document.body.innerText);
    verifier(
      !vuParLeTemoin.includes(`Thales ${marque}`),
      "CORRECTION_05 — une autre classe ne lit pas la correction commune",
    );

    const corrige = publiees[0]?.file_id ?? null;
    if (corrige !== null) {
      const parLaClasse = await eleveA.page.request.get(`${base}/documents/${corrige}`);
      const parLeTemoin = await temoin.page.request.get(`${base}/documents/${corrige}`);
      verifier(
        parLaClasse.ok() && parLeTemoin.status() >= 400,
        "CORRECTION_05 — le corrige descend a la classe, et a elle seule",
        `classe HTTP ${parLaClasse.status()}, temoin HTTP ${parLeTemoin.status()}`,
      );
    }

    /* --- À l'impression : le corrigé reste, les boutons partent ---------- */

    // Ce qu'un élève colle dans son cahier, c'est la correction — pas le bouton
    // qui l'a téléchargée, ni le formulaire de remise. Un `print:hidden` posé
    // sur le mauvais conteneur ferait disparaître le texte avec eux, et
    // personne ne s'en apercevrait avant la première impression réelle.
    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {});
    await eleveA.page.emulateMedia({ media: "print" });

    const impression = await eleveA.page.evaluate(() => {
      const visible = (selecteur) => {
        const element = document.querySelector(selecteur);
        if (element === null) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      };
      return {
        texte: document.body.innerText,
        telechargement: visible('[data-testid="telecharger-correction-commune"]'),
        remise: visible('[data-testid="remise-formulaire"]'),
      };
    });

    await eleveA.page.emulateMedia({ media: "screen" });

    verifier(
      impression.texte.includes(`Thales ${marque}`),
      "CORRECTION_06 — a l impression, le texte de la correction commune reste",
    );
    verifier(
      !impression.telechargement && !impression.remise,
      "CORRECTION_06 — a l impression, les boutons et la zone de depot disparaissent",
      `telechargement ${impression.telechargement}, remise ${impression.remise}`,
    );

    /* ==================================================================== */
    /* §9 — Les nouveautés internes                                         */
    /* ==================================================================== */

    // Ouvrir l'accueil déclenche le rattrapage : c'est là, et nulle part
    // ailleurs, que les nouveautés se déposent.
    for (const vue of [eleveA, eleveB, temoin]) {
      await exigerPage(vue.page, base, "/eleve", { attendu: "/eleve" });
    }

    const pourA = await attendreEnBase(
      sql,
      "select genre from study.nouveautes where profile_id = $1 and objet = $2 order by genre",
      [terrain.comptes.eleveA.id, devoir],
      (lignes) => lignes.length >= 2,
    );
    const genresA = pourA.map((ligne) => ligne.genre);
    verifier(
      genresA.includes("devoir_publie") && genresA.includes("correction_publiee"),
      "NOUVEAUTE_01 — le devoir publie et la correction commune previennent la classe",
      genresA.join(", "),
    );

    const pourLeTemoin = await sql.query(
      "select count(*)::int n from study.nouveautes where profile_id = $1 and objet = $2",
      [terrain.comptes.eleveTemoin.id, devoir],
    );
    verifier(
      pourLeTemoin.rows[0].n === 0,
      "NOUVEAUTE_01 — une autre classe n est prevenue de rien",
      `${pourLeTemoin.rows[0].n}`,
    );

    /* --- Le retour individuel ne prévient que son destinataire ---------- */

    await exigerPage(eleveA.page, base, `/eleve/devoirs/${devoir}`, {
      marqueur: '[data-testid="remise-formulaire"]',
    });
    await eleveA.page.setInputFiles('[data-testid="remise-fichier"]', {
      name: `copie-${marque}.pdf`,
      mimeType: "application/pdf",
      buffer: pdf(`copie ${marque}`),
    });
    await soumettre(eleveA.page, '[data-testid="remise-envoyer"]');

    const versions = await attendreEnBase(
      sql,
      `select v.id from study.submission_versions v
         join study.submissions s on s.id = v.submission_id
        where s.assignment_id = $1 and s.profile_id = $2`,
      [devoir, terrain.comptes.eleveA.id],
      (lignes) => lignes.length === 1,
    );

    if (verifier(versions.length === 1, "NOUVEAUTE_02 — la copie support est remise")) {
      await exigerPage(prof.page, base, `/professeur/devoirs/${devoir}`, {
        marqueur: '[data-testid="suivi-remises"]',
      });
      const ligne = prof.page.locator(
        `[data-testid="suivi-ligne"][data-eleve="${terrain.comptes.eleveA.id}"]`,
      );
      await ligne.locator('[data-testid="ouvrir-correction"]').click();
      await prof.page.waitForSelector('[data-testid="correction-formulaire"]');
      await prof.page.fill(
        '[data-testid="correction-commentaire-champ"]',
        `Personnel ${marque}, revois le signe.`,
      );
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

      await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
      await exigerPage(eleveB.page, base, "/eleve", { attendu: "/eleve" });

      const retourA = await attendreEnBase(
        sql,
        "select id from study.nouveautes where profile_id = $1 and genre = 'retour_individuel' and objet = $2",
        [terrain.comptes.eleveA.id, devoir],
        (lignes) => lignes.length === 1,
      );
      const retourB = await sql.query(
        "select count(*)::int n from study.nouveautes where profile_id = $1 and genre = 'retour_individuel' and objet = $2",
        [terrain.comptes.eleveB.id, devoir],
      );

      verifier(
        retourA.length === 1 && retourB.rows[0].n === 0,
        "NOUVEAUTE_02 — seul l eleve concerne est prevenu de son retour",
        `A ${retourA.length}, B ${retourB.rows[0].n}`,
      );
    }

    /* --- Une nouveauté lue ne revient pas -------------------------------- */

    await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
    const boutonToutLire = eleveA.page.locator('[data-testid="nouveautes-tout-lire"]');

    if ((await boutonToutLire.count()) === 0) {
      verifier(false, "NOUVEAUTE_03 — le bloc des nouveautes est affiche");
    } else {
      await soumettre(eleveA.page, '[data-testid="nouveautes-tout-lire"]');
      await attendreEnBase(
        sql,
        "select count(*)::int n from study.nouveautes where profile_id = $1 and lu_le is null",
        [terrain.comptes.eleveA.id],
        (lignes) => lignes[0].n === 0,
      );

      // Recharger rejoue le rattrapage : c'est exactement la ou une nouveaute
      // lue pourrait ressurgir.
      await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
      const restantes = await sql.query(
        "select count(*)::int n from study.nouveautes where profile_id = $1 and lu_le is null",
        [terrain.comptes.eleveA.id],
      );
      verifier(
        restantes.rows[0].n === 0,
        "NOUVEAUTE_03 — une nouveaute lue ne revient pas au rechargement",
        `${restantes.rows[0].n} non lue(s)`,
      );
    }

    /* ==================================================================== */
    /* §7 — Signalement et modération                                       */
    /* ==================================================================== */

    // Une séance publiée pour accrocher l'entraide : un fil est toujours lié à
    // une séance, il n'existe pas de fil général.
    const seances = await sql.query(
      `select id from study.lessons
        where teaching_space_id = $1 and state = 'publiee'
        order by published_at desc limit 1`,
      [terrain.cours.cible],
    );

    if (seances.rows.length === 0) {
      verifier(false, "MODERATION_01 — une seance publiee est disponible pour l entraide");
      return;
    }
    const seance = seances.rows[0].id;

    /* --- B écrit une réponse, A la signale ------------------------------- */

    await exigerPage(eleveA.page, base, `/eleve/cours/${seance}`, {});
    const ouvrirQuestion = eleveA.page.locator('[data-testid="entraide-ouvrir"]').first();

    if ((await ouvrirQuestion.count()) === 0) {
      verifier(false, "MODERATION_01 — le formulaire d entraide est accessible");
      return;
    }

    await ouvrirQuestion.click();
    await eleveA.page.waitForSelector('[data-testid="entraide-question"]');
    await eleveA.page.fill('[data-testid="entraide-texte-question"]', `Question ${marque}`);
    await soumettre(eleveA.page, '[data-testid="entraide-poser"]');

    const fils = await attendreEnBase(
      sql,
      "select id from study.fils_entraide where lesson_id = $1 and question like $2",
      [seance, `%${marque}%`],
      (lignes) => lignes.length === 1,
    );

    if (!verifier(fils.length === 1, "MODERATION_01 — la question support est posee")) return;
    const fil = fils[0].id;

    await exigerPage(eleveB.page, base, `/eleve/cours/${seance}`, {});
    const zoneReponse = eleveB.page.locator(`[data-testid="entraide-reponse"][data-fil="${fil}"]`);
    await zoneReponse.locator('[data-testid="entraide-texte-reponse"]').fill(`Deplace ${marque}`);
    await soumettre(eleveB.page, `[data-fil="${fil}"] [data-testid="entraide-repondre"]`);

    const reponses = await attendreEnBase(
      sql,
      "select id from study.reponses_entraide where fil_id = $1 and texte like $2",
      [fil, `%${marque}%`],
      (lignes) => lignes.length === 1,
    );

    if (!verifier(reponses.length === 1, "MODERATION_01 — la reponse support est ecrite")) return;
    const reponse = reponses[0].id;

    await exigerPage(eleveA.page, base, `/eleve/cours/${seance}`, {});
    const signaler = eleveA.page.locator(`[data-testid="signaler-reponse"][data-cible="${reponse}"]`);

    if ((await signaler.count()) === 0) {
      verifier(false, "MODERATION_01 — le bouton « signaler » est present sur une reponse");
      return;
    }

    await signaler.click();
    await eleveA.page.waitForSelector('[data-testid="signalement-raison"]');
    await eleveA.page.selectOption('[data-testid="signalement-raison"]', "contenu_inapproprie");
    await eleveA.page.fill('[data-testid="signalement-detail"]', `Motif ${marque}`);
    await soumettre(eleveA.page, '[data-testid="signalement-envoyer"]');

    const signalements = await attendreEnBase(
      sql,
      "select id, state, reporter_id from study.reports where reponse_id = $1",
      [reponse],
      (lignes) => lignes.length === 1,
    );

    if (
      !verifier(
        signalements.length === 1 && signalements[0].state === "ouvert",
        "MODERATION_01 — le signalement est enregistre, a l etat « ouvert »",
      )
    ) {
      return;
    }
    const signalement = signalements[0].id;

    /* --- Un signalement seul ne masque rien ------------------------------ */

    const apresSignalement = await sql.query(
      "select masque_le from study.reponses_entraide where id = $1",
      [reponse],
    );
    verifier(
      apresSignalement.rows[0].masque_le === null,
      "MODERATION_02 — un signalement, seul, ne masque rien",
    );

    await exigerPage(eleveB.page, base, `/eleve/cours/${seance}`, {});
    const toujoursLa = await eleveB.page.evaluate(() => document.body.innerText);
    verifier(
      toujoursLa.includes(`Deplace ${marque}`),
      "MODERATION_02 — le message reste en place tant que personne n a decide",
    );

    /* --- Signaler deux fois ne compte qu'une fois ------------------------ */

    await exigerPage(eleveA.page, base, `/eleve/cours/${seance}`, {});
    const dejaFait = await eleveA.page
      .locator('[data-testid="signalement-fait"]')
      .count();
    const boutonRedonne = await eleveA.page
      .locator(`[data-testid="signaler-reponse"][data-cible="${reponse}"]`)
      .count();

    verifier(
      dejaFait >= 1 && boutonRedonne === 0,
      "MODERATION_03 — le bouton ne se redonne pas apres un signalement",
      `mention ${dejaFait}, bouton ${boutonRedonne}`,
    );

    const doublons = await sql.query(
      "select count(*)::int n from study.reports where reponse_id = $1 and reporter_id = $2",
      [reponse, terrain.comptes.eleveA.id],
    );
    verifier(doublons.rows[0].n === 1, "MODERATION_03 — un seul signalement par personne");

    /* --- Le témoin d'une autre classe ne voit rien à signaler ------------ */

    // Ce que ce contrôle prouve, et ce qu'il ne prouve pas.
    //
    // Il prouve qu'un élève d'une autre classe **n'a pas de prise** : la séance
    // ne lui est pas servie, le message n'y est pas, et aucun bouton de
    // signalement ne lui est offert.
    //
    // Il ne prouve pas le refus d'une requête forgée — une action serveur Next
    // ne s'invoque pas par un simple POST sur l'adresse d'une page, et un tel
    // appel « réussirait » sans rien avoir éprouvé. C'est le test RLS
    // « un eleve d une autre classe ne signale pas ce qu il ne lit pas » qui
    // porte cette preuve-là, en écrivant directement en base avec son identité.
    await exigerPage(temoin.page, base, `/eleve/cours/${seance}`, {});
    const vuParLeTemoinSeance = await temoin.page.evaluate(() => document.body.innerText);
    const boutonsChezLeTemoin = await temoin.page
      .locator(`[data-testid="signaler-reponse"][data-cible="${reponse}"]`)
      .count();

    verifier(
      !vuParLeTemoinSeance.includes(`Deplace ${marque}`) && boutonsChezLeTemoin === 0,
      "MODERATION_04 — un eleve d une autre classe ne voit ni le message ni de quoi le signaler",
      `bouton ${boutonsChezLeTemoin}`,
    );

    const parLeTemoin = await sql.query(
      "select count(*)::int n from study.reports where reponse_id = $1 and reporter_id = $2",
      [reponse, terrain.comptes.eleveTemoin.id],
    );
    verifier(
      parLeTemoin.rows[0].n === 0,
      "MODERATION_04 — et aucun signalement de sa part n existe en base",
      `${parLeTemoin.rows[0].n}`,
    );

    /* --- Ni l'auteur ni le professeur ne voient qui a signalé ------------ */

    // Le marqueur « vous avez signalé ce message » n'apparaît que chez celui
    // qui a signalé. Chez l'auteur, il ne doit y en avoir aucun : c'est le
    // signe visible qu'il ignore avoir été signalé.
    await exigerPage(eleveB.page, base, `/eleve/cours/${seance}`, {});
    const marqueursChezLAuteur = await eleveB.page
      .locator('[data-testid="signalement-fait"]')
      .count();
    const vuParLAuteur = await eleveB.page.evaluate(() => document.body.innerText);

    verifier(
      marqueursChezLAuteur === 0 && !vuParLAuteur.includes(`Motif ${marque}`),
      "MODERATION_05 — l auteur du message ignore qu il a ete signale, et par qui",
      `marqueurs ${marqueursChezLAuteur}`,
    );

    // Et chez celui qui a signalé, le marqueur est bien là : sans quoi le
    // contrôle ci-dessus passerait parce que le marqueur n'existe nulle part.
    await exigerPage(eleveA.page, base, `/eleve/cours/${seance}`, {});
    const marqueursChezLeSignalant = await eleveA.page
      .locator('[data-testid="signalement-fait"]')
      .count();
    verifier(
      marqueursChezLeSignalant >= 1,
      "MODERATION_05 — celui qui a signale, lui, le voit",
      `marqueurs ${marqueursChezLeSignalant}`,
    );

    // Le professeur du cours : la file de modération ne lui est pas servie.
    const chezLeProfesseur = await prof.page.request.get(`${base}/admin/moderation`, {
      failOnStatusCode: false,
    });
    const contenuChezLeProfesseur = await chezLeProfesseur.text();
    verifier(
      !contenuChezLeProfesseur.includes(`Deplace ${marque}`) &&
        !contenuChezLeProfesseur.includes(`Motif ${marque}`),
      "MODERATION_05 — le professeur du cours n obtient pas la file de moderation",
      `HTTP ${chezLeProfesseur.status()}`,
    );

    /* --- L'administrateur décide ----------------------------------------- */

    await connecter(admin.page, base, {
      code: terrain.code,
      login: terrain.administrateur.login,
      motDePasse: terrain.administrateur.motDePasse,
      secretTotp: terrain.administrateur.secretTotp,
    });

    await exigerPage(admin.page, base, "/admin/moderation", {
      attendu: "/admin/moderation",
      marqueur: '[data-testid="signalements-compte"]',
    });

    const fiche = admin.page.locator('[data-testid="signalement"]').first();
    const vuParLAdmin = await admin.page.evaluate(() => document.body.innerText);
    verifier(
      (await fiche.count()) === 1 && vuParLAdmin.includes(`Deplace ${marque}`),
      "MODERATION_06 — le moderateur voit le contenu signale, en entier",
    );

    // Un motif trop court doit être refusé : une décision de modération sans
    // motif écrit n'est pas enregistrable, et l'écran le dit avant la base.
    await fiche.locator('[data-testid="signalement-motif"]').fill("vu");
    await fiche.locator('[data-testid="signalement-masquer"]').click();
    await admin.page.waitForTimeout(800);

    const apresMotifCourt = await sql.query("select state from study.reports where id = $1", [
      signalement,
    ]);
    verifier(
      apresMotifCourt.rows[0].state === "ouvert",
      "MODERATION_06 — une decision sans motif ecrit ne passe pas",
    );

    await fiche
      .locator('[data-testid="signalement-motif"]')
      .fill(`Propos deplaces envers un camarade — ${marque}.`);
    await soumettre(admin.page, '[data-testid="signalement-masquer"]');

    const traite = await attendreEnBase(
      sql,
      "select state from study.reports where id = $1",
      [signalement],
      (lignes) => lignes[0]?.state === "traite",
    );
    verifier(traite[0]?.state === "traite", "MODERATION_07 — la decision classe le signalement");

    const masquee = await sql.query("select masque_le from study.reponses_entraide where id = $1", [
      reponse,
    ]);
    verifier(
      masquee.rows[0].masque_le !== null,
      "MODERATION_07 — le message est masque en base",
    );

    /* --- Le contenu masqué n'est plus lisible ---------------------------- */

    for (const [vue, cle] of [
      [eleveA, "celui qui a signale"],
      [eleveB, "son auteur"],
    ]) {
      await exigerPage(vue.page, base, `/eleve/cours/${seance}`, {});
      const apres = await vue.page.evaluate(() => document.body.innerText);
      verifier(
        !apres.includes(`Deplace ${marque}`),
        `MODERATION_07 — masque, le message n est plus lisible par ${cle}`,
      );
    }

    /* --- La trace est au journal, sans le contenu retiré ----------------- */

    const trace = await attendreEnBase(
      sql,
      `select action, object_kind, object_id, reason, metadata::text as brut
         from study.audit_events
        where object_kind = 'report' and object_id = $1
        order by created_at desc limit 1`,
      [signalement],
      (lignes) => lignes.length === 1,
    );

    if (verifier(trace.length === 1, "MODERATION_08 — la decision est journalisee")) {
      verifier(
        trace[0].action === "moderation_masquer" &&
          String(trace[0].reason ?? "").includes(marque),
        "MODERATION_08 — le journal garde la decision et son motif",
        String(trace[0].action),
      );
      verifier(
        !String(trace[0].reason ?? "").includes(`Deplace ${marque}`) &&
          !String(trace[0].brut ?? "").includes(`Deplace ${marque}`),
        "MODERATION_08 — le journal ne conserve pas le contenu retire",
      );
    }

    /* --- Rétablir ---------------------------------------------------------- */

    await exigerPage(admin.page, base, "/admin/moderation", {
      marqueur: '[data-testid="signalements-compte"]',
    });
    await admin.page.locator('[data-testid="signalements-basculer"]').click();
    const ficheClose = admin.page
      .locator(`[data-testid="signalement"][data-masque="oui"]`)
      .first();

    if ((await ficheClose.count()) === 1) {
      await ficheClose
        .locator('[data-testid="signalement-motif"]')
        .fill(`Verification faite, le propos etait maladroit sans plus — ${marque}.`);
      await soumettre(admin.page, '[data-testid="signalement-restaurer"]');

      const retabli = await attendreEnBase(
        sql,
        "select masque_le from study.reponses_entraide where id = $1",
        [reponse],
        (lignes) => lignes[0]?.masque_le === null,
      );
      verifier(
        retabli[0]?.masque_le === null,
        "MODERATION_09 — retablir remet le message en place",
      );
    } else {
      verifier(false, "MODERATION_09 — la fiche close est consultable pour retablir");
    }
  } finally {
    for (const vue of [prof, eleveA, eleveB, temoin, admin]) {
      await vue.contexte.close().catch(() => {});
    }
  }
}

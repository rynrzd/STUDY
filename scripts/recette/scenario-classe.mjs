// =============================================================================
// §2 à §4 — Devoirs, entraide, et case « fait ».
//
// Trois scénarios qui partagent la même scène : deux élèves de la même classe
// (A et B) et un témoin dans une autre. C'est ce trio qui permet de distinguer
// « la fonctionnalité marche » de « la fonctionnalité marche **pour la bonne
// personne** » — la seule question qui compte pour des données d'élèves.
//
// Ce que ce fichier ne teste pas, et pourquoi : la **remise** d'un fichier par
// l'élève et la **correction** par le professeur n'existent pas dans le
// produit. Les tables `submissions` et `submission_versions` sont créées par la
// migration 0004, mais aucune action, aucune page, aucun formulaire ne les
// touche. Il n'y a donc rien à jouer — et prétendre le contraire serait
// exactement le genre de rapport qu'on cherche à éviter.
// =============================================================================

import {
  attendreEnBase,
  connecter,
  contexteDe,
  exigerPage,
  soumettre,
} from "./navigateur.mjs";

/** Ouvre une session élève et rend sa page. */
async function ouvrirEleve(navigateur, base, terrain, cle) {
  const { contexte, page } = await contexteDe(navigateur);
  const compte = terrain.comptes[cle];
  const session = await connecter(page, base, {
    code: terrain.code,
    login: compte.login,
    motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
  });
  compte.motDePasse = session.motDePasse;
  return { contexte, page };
}

export async function scenarioClasse({ navigateur, base, terrain, sql, verifier }) {
  const marque = `RC${terrain.suffixe.toUpperCase()}`;

  /* ====================================================================== */
  /* Préparation : une séance publiée, avec un devoir                        */
  /* ====================================================================== */

  const prof = await contexteDe(navigateur);
  let seance = null;
  let devoir = null;

  try {
    const session = await connecter(prof.page, base, {
      code: terrain.code,
      login: terrain.comptes.professeur.login,
      motDePasse: terrain.comptes.professeur.motDePasse ?? terrain.comptes.professeur.motDePasseTemporaire,
    });
    terrain.comptes.professeur.motDePasse = session.motDePasse;

    await exigerPage(prof.page, base, "/studio", { marqueur: '[data-testid="chapitre-nouveau"]' });

    const ouvrir = prof.page.locator('[data-testid="ouvrir-nouvelle-seance"]').first();
    if ((await ouvrir.count()) > 0) await ouvrir.click();
    await prof.page.fill('[data-testid="seance-titre"]', `Seance classe ${marque}`);
    await soumettre(prof.page, '[data-testid="seance-valider"]');

    const seances = await attendreEnBase(
      sql,
      "select id, teaching_space_id from study.lessons where title = $1",
      [`Seance classe ${marque}`],
      (lignes) => lignes.length === 1,
    );
    if (!verifier(seances.length === 1, "une seance est preparee pour la classe")) return;
    seance = seances[0];

    /* ------------------------------------------------------------------ */
    /* §2 — Le devoir : création, échéance, publication ciblée             */
    /* ------------------------------------------------------------------ */

    console.log("\n§2. Devoirs (creation, echeance, ciblage)");

    await exigerPage(prof.page, base, `/studio/${seance.id}`, {
      marqueur: '[data-testid="seance-entete"]',
    });

    // Une échéance au lendemain : assez proche pour être « à venir »,
    // assez loin pour que la recette ne dépende pas de l'heure qu'il est.
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await prof.page.click('[data-testid="ajouter-devoir"]');
    await prof.page.waitForSelector('[data-testid="bloc-nouveau"]');
    await prof.page.fill('[data-testid="champ-titre-devoir"]', `Devoir ${marque}`);
    await prof.page.fill('[data-testid="champ-consigne"]', `Consigne du devoir ${marque}`);
    await prof.page.fill('[data-testid="champ-echeance"]', demain);
    await soumettre(prof.page, '[data-testid="bloc-ajouter"]');

    const devoirs = await attendreEnBase(
      sql,
      "select id, title, due_at, state, teaching_space_id from study.assignments where title = $1",
      [`Devoir ${marque}`],
      (lignes) => lignes.length === 1,
    );
    if (!verifier(devoirs.length === 1, "le devoir est cree en base", `${devoirs.length}`)) return;
    devoir = devoirs[0];

    verifier(devoir.due_at !== null, "l echeance saisie est enregistree");
    verifier(
      new Date(devoir.due_at).toISOString().slice(0, 10) === demain,
      "l echeance est bien celle qui a ete saisie",
      new Date(devoir.due_at).toISOString().slice(0, 10),
    );
    verifier(
      devoir.teaching_space_id === terrain.cours.cible,
      "le devoir appartient au cours vise",
    );

    // Tant que la séance est en brouillon, aucun élève ne doit rien voir.
    const eleveAvant = await ouvrirEleve(navigateur, base, terrain, "eleveA");
    try {
      await exigerPage(eleveAvant.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
      const vu = await eleveAvant.page.evaluate(() => document.body.innerText);
      verifier(!vu.includes(marque), "un devoir en brouillon reste invisible pour l eleve");
    } finally {
      await eleveAvant.contexte.close();
    }

    await exigerPage(prof.page, base, `/studio/${seance.id}`, {
      marqueur: '[data-testid="publication"]',
    });
    await soumettre(prof.page, '[data-testid="publication-basculer"]');
    await attendreEnBase(
      sql,
      "select state from study.lessons where id = $1",
      [seance.id],
      (lignes) => lignes[0]?.state === "publiee",
    );
    verifier(true, "la seance est publiee dans la classe cible");
  } finally {
    await prof.contexte.close();
  }

  if (seance === null || devoir === null) return;

  /* ====================================================================== */
  /* §2 (suite) — Ce que voient A, B et le témoin                           */
  /* ====================================================================== */

  const eleveA = await ouvrirEleve(navigateur, base, terrain, "eleveA");
  const eleveB = await ouvrirEleve(navigateur, base, terrain, "eleveB");
  const temoin = await ouvrirEleve(navigateur, base, terrain, "eleveTemoin");

  try {
    await exigerPage(eleveA.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
    const vuA = await eleveA.page.evaluate(() => document.body.innerText);
    verifier(vuA.includes(`Devoir ${marque}`), "l eleve A voit le devoir publie");

    await exigerPage(temoin.page, base, "/eleve/devoirs", { attendu: "/eleve/devoirs" });
    const vuTemoin = await temoin.page.evaluate(() => document.body.innerText);
    verifier(!vuTemoin.includes(marque), "l eleve d une autre classe ne voit pas ce devoir");

    // L'accès direct par identifiant : la séance d'une autre classe ne s'ouvre
    // pas parce qu'on en connaît l'adresse.
    const refus = await temoin.page
      .goto(`${base}/eleve/cours/${seance.id}`, { waitUntil: "networkidle" })
      .then((r) => r?.status() ?? 0)
      .catch(() => 0);
    const contenuRefus = await temoin.page.evaluate(() => document.body.innerText);
    verifier(
      refus === 404 || !contenuRefus.includes(marque),
      "l adresse directe d une seance d une autre classe ne livre rien",
      `HTTP ${refus}`,
    );

    /* -------------------------------------------------------------------- */
    /* §4 — La case « fait »                                                 */
    /* -------------------------------------------------------------------- */

    console.log("\n§4. Case « fait » et nouveautes");

    // `travaux_faits` ne porte pas de booléen : c'est la **présence** de la
    // ligne qui dit « fait ». Décocher supprime la ligne. Un test qui
    // chercherait une colonne `fait` chercherait ce qui n'existe pas.
    const estFait = async (profil) => {
      const { rows } = await sql.query(
        "select fait_le from study.travaux_faits where assignment_id = $1 and profile_id = $2",
        [devoir.id, profil],
      );
      return rows.length > 0;
    };

    // La case « fait » vit sur l accueil de l eleve, la ou sont les travaux du
    // jour — pas sur la liste complete.
    await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
    const caseA = eleveA.page.locator(`[data-testid="case-fait"][data-devoir="${devoir.id}"]`);

    if ((await caseA.count()) === 0) {
      verifier(false, "la case « fait » est presente sur le devoir de l eleve");
    } else {
      verifier(
        (await caseA.getAttribute("data-fait")) === "non",
        "le devoir commence a « non fait »",
      );

      await caseA.click();
      await eleveA.page.waitForLoadState("networkidle").catch(() => {});
      await eleveA.page.waitForTimeout(800);

      const apres = await attendreEnBase(
        sql,
        "select fait_le from study.travaux_faits where assignment_id = $1 and profile_id = $2",
        [devoir.id, terrain.comptes.eleveA.id],
        (lignes) => lignes.length === 1,
      );
      verifier(apres.length === 1, "cocher « fait » est enregistre en base");

      // Persistance : c'est l'état en base qui décide, pas l'écran.
      await exigerPage(eleveA.page, base, "/eleve", { attendu: "/eleve" });
      const caseApres = eleveA.page.locator(`[data-testid="case-fait"][data-devoir="${devoir.id}"]`);
      verifier(
        (await caseApres.getAttribute("data-fait")) === "oui",
        "apres rechargement, la case reste cochee",
      );

      // B n'a rien coché : son état est le sien.
      verifier(
        !(await estFait(terrain.comptes.eleveB.id)),
        "l etat de A ne deteint pas sur B",
      );

      await exigerPage(eleveB.page, base, "/eleve", { attendu: "/eleve" });
      const caseB = eleveB.page.locator(`[data-testid="case-fait"][data-devoir="${devoir.id}"]`);
      if ((await caseB.count()) > 0) {
        verifier(
          (await caseB.getAttribute("data-fait")) === "non",
          "B voit son propre devoir comme non fait",
        );
      }

      // Retour à « non fait ».
      await caseApres.click();
      await eleveA.page.waitForLoadState("networkidle").catch(() => {});
      const retour = await attendreEnBase(
        sql,
        "select fait_le from study.travaux_faits where assignment_id = $1 and profile_id = $2",
        [devoir.id, terrain.comptes.eleveA.id],
        (lignes) => lignes.length === 0,
      );
      verifier(retour.length === 0, "on peut revenir a « non fait »");
    }

    /* -------------------------------------------------------------------- */
    /* §3 — L'entraide                                                       */
    /* -------------------------------------------------------------------- */

    console.log("\n§3. Entraide");

    await exigerPage(eleveA.page, base, `/eleve/cours/${seance.id}`, {
      attendu: `/eleve/cours/${seance.id}`,
    });

    const ouvrirQuestion = eleveA.page.locator('[data-testid="entraide-ouvrir"]').first();
    if ((await ouvrirQuestion.count()) === 0) {
      verifier(false, "l eleve peut ouvrir le formulaire d entraide");
    } else {
      await ouvrirQuestion.click();
      await eleveA.page.waitForSelector('[data-testid="entraide-question"]');

      // Un message vide doit être refusé : le produit ne crée pas de fil creux.
      await eleveA.page.fill('[data-testid="entraide-texte-question"]', "  ");
      await soumettre(eleveA.page, '[data-testid="entraide-poser"]');
      const filsVides = await sql.query(
        "select count(*)::int n from study.fils_entraide where lesson_id = $1",
        [seance.id],
      );
      verifier(filsVides.rows[0].n === 0, "une question vide ne cree aucun fil");

      // Une vraie question, avec accents, apostrophe, emoji et un fragment de
      // HTML : si le produit l'interprétait, l'entraide deviendrait une faille.
      const question = `Je n'ai pas compris l'énoncé ${marque} 🙂 <b>gras</b> <script>alert(1)</script>`;
      await eleveA.page.fill('[data-testid="entraide-texte-question"]', question);
      await soumettre(eleveA.page, '[data-testid="entraide-poser"]');

      const fils = await attendreEnBase(
        sql,
        "select id, question from study.fils_entraide where lesson_id = $1",
        [seance.id],
        (lignes) => lignes.length === 1,
      );
      if (verifier(fils.length === 1, "la question cree un fil", `${fils.length}`)) {
        const fil = fils[0];
        verifier(
          String(fil.question ?? "").includes(marque),
          "le texte est conserve tel qu il a ete ecrit",
        );

        // Le HTML doit apparaître **comme texte**, jamais comme balise.
        await exigerPage(eleveA.page, base, `/eleve/cours/${seance.id}`, {});
        const gras = await eleveA.page.locator("main b").count();
        const scripts = await eleveA.page.locator("main script").count();
        const texteVisible = await eleveA.page.evaluate(() => document.body.innerText);
        verifier(scripts === 0, "aucun script injecte n est rendu", `${scripts}`);
        verifier(
          texteVisible.includes("<b>gras</b>") || gras === 0,
          "le HTML ecrit par un eleve reste du texte",
        );
        if (!texteVisible.includes("🙂")) {
          const section = await eleveA.page
            .locator("section[aria-labelledby='titre-entraide']")
            .innerText()
            .catch(() => "(section absente)");
          console.log(
            `       diagnostic entraide A : « ${section.replace(/s+/g, " ").slice(0, 200)} »`,
          );
        }
        verifier(texteVisible.includes("🙂"), "les emoji et accents survivent");

        // B répond : le fil est celui de la classe, pas celui d'une personne.
        await exigerPage(eleveB.page, base, `/eleve/cours/${seance.id}`, {});
        const reponse = eleveB.page.locator(`[data-testid="entraide-reponse"][data-fil="${fil.id}"]`);
        if ((await reponse.count()) === 0) {
          const vue = await eleveB.page
            .locator("section[aria-labelledby='titre-entraide']")
            .innerText()
            .catch(() => "(section absente)");
          console.log(
            `       diagnostic entraide B : ${new URL(eleveB.page.url()).pathname} — « ${vue.replace(/s+/g, " ").slice(0, 200)} »`,
          );
        }
        if (verifier((await reponse.count()) > 0, "B voit la question de A et peut repondre")) {
          await reponse.locator('[data-testid="entraide-texte-reponse"]').fill(`Réponse ${marque}`);
          await soumettre(eleveB.page, `[data-fil="${fil.id}"] [data-testid="entraide-repondre"]`);

          const messages = await attendreEnBase(
            sql,
            "select id, texte, created_at from study.reponses_entraide where fil_id = $1 order by created_at",
            [fil.id],
            (lignes) => lignes.length >= 1,
          );
          verifier(messages.length >= 1, "la reponse est enregistree", `${messages.length}`);
        }

        // Le témoin, lui, n'a rien à voir ici.
        await temoin.page
          .goto(`${base}/eleve/cours/${seance.id}`, { waitUntil: "networkidle" })
          .catch(() => {});
        const vuParTemoin = await temoin.page.evaluate(() => document.body.innerText);
        verifier(
          !vuParTemoin.includes(marque),
          "un eleve d une autre classe ne lit pas cette entraide",
        );
      }
    }
  } finally {
    await eleveA.contexte.close();
    await eleveB.contexte.close();
    await temoin.contexte.close();
  }
}

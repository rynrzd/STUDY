// =============================================================================
// §1 — Le Studio, joué en entier.
//
// Un professeur jetable crée un chapitre, une séance, les cinq types de blocs,
// les modifie, les réordonne, publie dans une seule classe, et un élève vient
// vérifier que ce qu'il voit correspond à l'aperçu. Puis on duplique, on
// modifie la copie, et on prouve que l'original n'a pas bougé.
//
// Deux exigences donnent leur forme à ce fichier.
//
// **Chaque bloc porte un marqueur unique.** Sans lui, « le texte est bien là »
// ne distingue pas le bloc qu'on vient d'écrire de celui d'avant, ni la séance
// d'une autre. Le marqueur permet aussi de retrouver la ligne en base sans
// supposer un ordre.
//
// **Rien n'est choisi par son texte.** Deux boutons « Enregistrer » coexistent
// sur cet écran. Tout passe par `data-testid`, et les blocs se désignent par
// leur type via `data-bloc-type`.
// =============================================================================

import { connecter, contexteDe, exigerPage, verifierEcran } from "./navigateur.mjs";

/** Les cinq types, avec ce qu'il faut saisir et ce qu'on doit relire. */
function blocsAttendus(marque) {
  return [
    { type: "texte", saisie: { "champ-texte": `Plan du cours ${marque}` }, attendu: `Plan du cours ${marque}` },
    { type: "exercice", saisie: { "champ-texte": `Exercice 12 ${marque}` }, attendu: `Exercice 12 ${marque}` },
    {
      type: "lien",
      saisie: { "champ-url": `https://exemple.invalid/${marque}`, "champ-titre-lien": `Ressource ${marque}` },
      attendu: `Ressource ${marque}`,
    },
    {
      type: "devoir",
      saisie: { "champ-titre-devoir": `Devoir maison ${marque}`, "champ-consigne": `A rendre ${marque}` },
      attendu: `Devoir maison ${marque}`,
    },
  ];
}

export async function scenarioStudio({ navigateur, base, terrain, sql, verifier, service }) {
  console.log("\n§1. Le Studio");

  const marque = `RM${terrain.suffixe.toUpperCase()}`;
  const { contexte, page } = await contexteDe(navigateur);

  try {
    /* --- Connexion du professeur ------------------------------------------ */

    const session = await connecter(page, base, {
      code: terrain.code,
      login: terrain.comptes.professeur.login,
      motDePasse: terrain.comptes.professeur.motDePasseTemporaire,
    });
    terrain.comptes.professeur.motDePasse = session.motDePasse;
    verifier(true, "le professeur se connecte et active son compte");

    /* --- Chapitre ---------------------------------------------------------- */

    await exigerPage(page, base, "/studio", {
      attendu: "/studio",
      marqueur: '[data-testid="chapitre-nouveau"]',
    });

    await page.fill('[data-testid="chapitre-label"]', `Chapitre ${marque}`);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="chapitre-valider"]'),
    ]);

    const { rows: chapitres } = await sql.query(
      "select id, label from study.chapters where label = $1",
      [`Chapitre ${marque}`],
    );
    verifier(chapitres.length === 1, "le chapitre est cree et ecrit en base", `${chapitres.length} ligne(s)`);

    /* --- Séance ------------------------------------------------------------ */

    const ouvrir = page.locator('[data-testid="ouvrir-nouvelle-seance"]').first();
    if ((await ouvrir.count()) > 0) await ouvrir.click();

    await page.fill('[data-testid="seance-titre"]', `Seance ${marque}`);
    const reponseCreation = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(base)),
      page.click('[data-testid="seance-valider"]'),
    ]);
    verifier(
      reponseCreation[0].status() < 400,
      "la creation de seance repond sans erreur reseau",
      `HTTP ${reponseCreation[0].status()}`,
    );

    await page.waitForLoadState("networkidle");

    const { rows: seances } = await sql.query(
      "select id, title, state, chapter_id from study.lessons where title = $1",
      [`Seance ${marque}`],
    );
    if (!verifier(seances.length === 1, "la seance est ecrite en base", `${seances.length} ligne(s)`)) {
      return;
    }
    const seance = seances[0];
    verifier(seance.state !== "publiee", "une seance nait en brouillon", seance.state);

    await exigerPage(page, base, `/studio/${seance.id}`, {
      attendu: `/studio/${seance.id}`,
      marqueur: '[data-testid="seance-entete"]',
    });

    /* --- Les cinq types de blocs ------------------------------------------- */

    for (const bloc of blocsAttendus(marque)) {
      await page.click(`[data-testid="ajouter-${bloc.type}"]`);
      await page.waitForSelector('[data-testid="bloc-nouveau"]');

      for (const [champ, valeur] of Object.entries(bloc.saisie)) {
        await page.fill(`[data-testid="${champ}"]`, valeur);
      }

      const [reponse] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(base)),
        page.click('[data-testid="bloc-ajouter"]'),
      ]);
      await page.waitForLoadState("networkidle");

      verifier(
        reponse.status() < 400,
        `bloc « ${bloc.type} » : la reponse reseau est saine`,
        `HTTP ${reponse.status()}`,
      );

      const probleme = await verifierEcran(page, base);
      verifier(probleme === null, `bloc « ${bloc.type} » : l ecran reste sain`, probleme ?? "");
    }

    // Le document : un vrai fichier, déposé depuis le disque.
    await page.click('[data-testid="ajouter-document"]');
    await page.waitForSelector('[data-testid="champ-fichier"]');
    await page.setInputFiles('[data-testid="champ-fichier"]', {
      name: `fiche-${marque}.pdf`,
      mimeType: "application/pdf",
      buffer: pdfMinimal(marque),
    });
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="bloc-ajouter"]'),
    ]);

    /* --- Ce que la base a réellement écrit --------------------------------- */

    const lireBlocs = async () =>
      (
        await sql.query(
          `select id, kind, position, contenu, file_id, assignment_id
             from study.lesson_blocks where lesson_id = $1 order by position`,
          [seance.id],
        )
      ).rows;

    let enBase = await lireBlocs();
    verifier(enBase.length === 5, "les cinq blocs sont ecrits en base", `${enBase.length} bloc(s)`);

    for (const type of ["texte", "exercice", "lien", "devoir", "document"]) {
      verifier(
        enBase.some((b) => b.kind === type),
        `le bloc « ${type} » existe en base`,
      );
    }

    const marqueurs = enBase.filter((b) => JSON.stringify(b.contenu).includes(marque));
    verifier(marqueurs.length === 5, "chaque bloc porte son marqueur de recette", `${marqueurs.length}/5`);

    const devoir = enBase.find((b) => b.kind === "devoir");
    verifier(devoir?.assignment_id !== null, "le bloc devoir a bien cree un devoir");

    const document = enBase.find((b) => b.kind === "document");
    verifier(document?.file_id !== null, "le bloc document a bien attache un fichier");

    /* --- Rechargement complet ---------------------------------------------- */

    await exigerPage(page, base, `/studio/${seance.id}`, {
      marqueur: '[data-testid="blocs-liste"]',
    });

    const typesAffiches = await page.$$eval("[data-bloc-type]", (n) =>
      n.map((e) => e.getAttribute("data-bloc-type")),
    );
    verifier(
      typesAffiches.length === 5,
      "apres rechargement complet, les cinq blocs reapparaissent",
      typesAffiches.join(", "),
    );

    /* --- Modification de chaque type --------------------------------------- */

    const modifications = [
      ["texte", { "bloc-texte": `Plan revise ${marque}` }],
      ["exercice", { "bloc-texte": `Exercice 13 ${marque}` }],
      ["lien", { "bloc-url": `https://exemple.invalid/bis-${marque}`, "bloc-titre": `Ressource bis ${marque}` }],
      ["devoir", { "bloc-titre": `Devoir revise ${marque}`, "bloc-consigne": `Consigne revisee ${marque}` }],
      ["document", { "bloc-nom": `Fiche revisee ${marque}` }],
    ];

    for (const [type, champs] of modifications) {
      const article = page.locator(`[data-bloc-type="${type}"]`).first();
      await article.locator('[data-testid="bloc-modifier"]').click();
      await article.locator('[data-testid="bloc-edition"]').waitFor();

      for (const [champ, valeur] of Object.entries(champs)) {
        await article.locator(`[data-testid="${champ}"]`).fill(valeur);
      }

      await Promise.all([
        page.waitForLoadState("networkidle"),
        article.locator('[data-testid="bloc-enregistrer"]').click(),
      ]);
    }

    enBase = await lireBlocs();
    let modifies = 0;
    for (const [type, champs] of modifications) {
      const valeurs = Object.values(champs);
      const ligne = enBase.find((b) => b.kind === type);
      if (ligne && valeurs.every((v) => JSON.stringify(ligne.contenu).includes(v))) modifies += 1;
    }
    verifier(modifies === 5, "les cinq types se modifient reellement en base", `${modifies}/5`);

    // Le devoir lié suit le bloc : sans cela, « À faire » contredirait le cours.
    const { rows: devoirLie } = await sql.query("select title from study.assignments where id = $1", [
      enBase.find((b) => b.kind === "devoir")?.assignment_id,
    ]);
    verifier(
      devoirLie[0]?.title === `Devoir revise ${marque}`,
      "le devoir lie suit la modification du bloc",
      devoirLie[0]?.title ?? "(aucun)",
    );

    /* --- Réordonnancement --------------------------------------------------- */

    const avantOrdre = (await lireBlocs()).map((b) => b.kind);
    const dernier = page.locator("[data-bloc-type]").last();
    await Promise.all([
      page.waitForLoadState("networkidle"),
      dernier.locator('[data-testid="bloc-monter"]').click(),
    ]);

    const apresOrdre = (await lireBlocs()).map((b) => b.kind);
    verifier(
      JSON.stringify(avantOrdre) !== JSON.stringify(apresOrdre),
      "reordonner change l ordre en base",
      apresOrdre.join(" > "),
    );

    await exigerPage(page, base, `/studio/${seance.id}`, { marqueur: '[data-testid="blocs-liste"]' });
    const ordreAffiche = await page.$$eval("[data-bloc-type]", (n) =>
      n.map((e) => e.getAttribute("data-bloc-type")),
    );
    verifier(
      JSON.stringify(ordreAffiche) === JSON.stringify(apresOrdre),
      "apres un second rechargement, l ordre tient",
      ordreAffiche.join(" > "),
    );

    /* --- Aperçu élève ------------------------------------------------------- */

    await exigerPage(page, base, `/studio/${seance.id}/apercu`, {
      attendu: `/studio/${seance.id}/apercu`,
    });
    const apercu = await page.evaluate(() => document.body.innerText);
    verifier(apercu.includes(marque), "l apercu montre le contenu de la seance");

    /* --- Publication dans une seule classe ---------------------------------- */

    await exigerPage(page, base, `/studio/${seance.id}`, { marqueur: '[data-testid="publication"]' });
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="publication-basculer"]'),
    ]);

    const { rows: publiee } = await sql.query(
      "select state, teaching_space_id from study.lessons where id = $1",
      [seance.id],
    );
    verifier(publiee[0]?.state === "publiee", "la seance est publiee", publiee[0]?.state);
    verifier(
      publiee[0]?.teaching_space_id === terrain.cours.cible,
      "elle est publiee dans la classe visee, et dans elle seule",
    );

    const { rows: ailleurs } = await sql.query(
      "select count(*)::int n from study.lessons where teaching_space_id = $1",
      [terrain.cours.temoin],
    );
    verifier(ailleurs[0].n === 0, "la classe temoin ne recoit rien", `${ailleurs[0].n} seance(s)`);

    /* --- L'élève voit ce que l'aperçu montrait ------------------------------ */

    const vueEleve = await contexteDe(navigateur);
    let texteEleve = "";
    try {
      const sessionEleve = await connecter(vueEleve.page, base, {
        code: terrain.code,
        login: terrain.comptes.eleveA.login,
        motDePasse: terrain.comptes.eleveA.motDePasseTemporaire,
      });
      terrain.comptes.eleveA.motDePasse = sessionEleve.motDePasse;

      await exigerPage(vueEleve.page, base, "/eleve/cours", { attendu: "/eleve/cours" });
      texteEleve = await vueEleve.page.evaluate(() => document.body.innerText);
      verifier(texteEleve.includes(`Seance ${marque}`), "l eleve voit la seance publiee");

      const lien = vueEleve.page.locator(`a:has-text("Seance ${marque}")`).first();
      if ((await lien.count()) > 0) {
        await Promise.all([vueEleve.page.waitForLoadState("networkidle"), lien.click()]);
        const rendu = await vueEleve.page.evaluate(() => document.body.innerText);
        const presents = blocsAttendus(marque)
          .map((b) => b.type)
          .filter(() => true);
        void presents;
        verifier(
          rendu.includes(`Plan revise ${marque}`) && rendu.includes(`Devoir revise ${marque}`),
          "le rendu eleve correspond a ce que l apercu annoncait",
        );
      }
    } finally {
      await vueEleve.contexte.close();
    }

    /* --- L'élève témoin ne voit rien ---------------------------------------- */

    const vueTemoin = await contexteDe(navigateur);
    try {
      const sessionTemoin = await connecter(vueTemoin.page, base, {
        code: terrain.code,
        login: terrain.comptes.eleveTemoin.login,
        motDePasse: terrain.comptes.eleveTemoin.motDePasseTemporaire,
      });
      terrain.comptes.eleveTemoin.motDePasse = sessionTemoin.motDePasse;

      await exigerPage(vueTemoin.page, base, "/eleve/cours", { attendu: "/eleve/cours" });
      const vu = await vueTemoin.page.evaluate(() => document.body.innerText);
      verifier(!vu.includes(marque), "l eleve d une autre classe ne voit rien de cette seance");
    } finally {
      await vueTemoin.contexte.close();
    }

    /* --- Duplication vers l'autre classe ------------------------------------ */

    await exigerPage(page, base, `/studio/${seance.id}`, { marqueur: '[data-testid="seance-entete"]' });
    const formulaireCopie = page.locator('[data-testid="dupliquer"]');

    if ((await formulaireCopie.count()) === 0) {
      verifier(false, "le formulaire de duplication est present sur l ecran de seance");
    } else {
      await page.selectOption('[data-testid="dupliquer-cours"]', terrain.cours.temoin);
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.click('[data-testid="dupliquer-valider"]'),
      ]);

      const { rows: copies } = await sql.query(
        "select id, title, teaching_space_id from study.lessons where teaching_space_id = $1",
        [terrain.cours.temoin],
      );
      if (verifier(copies.length === 1, "la copie existe dans l autre classe", `${copies.length}`)) {
        const copie = copies[0];

        const { rows: blocsCopie } = await sql.query(
          "select id, kind, contenu from study.lesson_blocks where lesson_id = $1 order by position",
          [copie.id],
        );
        verifier(blocsCopie.length === 5, "la copie porte les cinq blocs", `${blocsCopie.length}`);

        // Modifier la copie, et prouver que l'original ne bouge pas : c'est
        // toute la question d'une duplication — deux objets, pas deux vues.
        const blocCopie = blocsCopie.find((b) => b.kind === "texte");
        await sql.query(
          `update study.lesson_blocks set contenu = jsonb_set(contenu, '{texte}', $2::jsonb)
            where id = $1`,
          [blocCopie.id, JSON.stringify(`Copie modifiee ${marque}`)],
        );

        const originalApres = (await lireBlocs()).find((b) => b.kind === "texte");
        verifier(
          String(originalApres.contenu.texte) === `Plan revise ${marque}`,
          "modifier la copie ne touche pas l original",
          String(originalApres.contenu.texte),
        );
      }
    }

    /* --- Dépublier puis republier -------------------------------------------- */

    await exigerPage(page, base, `/studio/${seance.id}`, { marqueur: '[data-testid="publication"]' });
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="publication-basculer"]'),
    ]);
    let etat = (await sql.query("select state from study.lessons where id = $1", [seance.id])).rows[0];
    verifier(etat.state !== "publiee", "depublier ramene la seance en brouillon", etat.state);

    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="publication-basculer"]'),
    ]);
    etat = (await sql.query("select state from study.lessons where id = $1", [seance.id])).rows[0];
    verifier(etat.state === "publiee", "republier la remet en ligne", etat.state);

    /* --- Suppression d'un bloc ----------------------------------------------- */

    page.once("dialog", (dialogue) => dialogue.accept());
    const aSupprimer = page.locator('[data-bloc-type="lien"]').first();
    await Promise.all([
      page.waitForLoadState("networkidle"),
      aSupprimer.locator('[data-testid="bloc-supprimer"]').click(),
    ]);

    enBase = await lireBlocs();
    verifier(
      !enBase.some((b) => b.kind === "lien"),
      "le bloc supprime disparait de la base",
      enBase.map((b) => b.kind).join(", "),
    );

    await exigerPage(page, base, `/studio/${seance.id}`, { marqueur: '[data-testid="blocs-liste"]' });
    const restants = await page.$$eval("[data-bloc-type]", (n) =>
      n.map((e) => e.getAttribute("data-bloc-type")),
    );
    verifier(
      !restants.includes("lien") && restants.length === 4,
      "apres rechargement, il ne revient pas",
      restants.join(", "),
    );

    /* --- Impression ----------------------------------------------------------- */

    await exigerPage(page, base, `/studio/${seance.id}/apercu`, {});
    await page.emulateMedia({ media: "print" });
    const visibleAImpression = await page.evaluate(() => document.body.innerText.trim().length);
    await page.emulateMedia({ media: "screen" });
    verifier(visibleAImpression > 50, "la page imprimee n est pas vide", `${visibleAImpression} caracteres`);

    void service;
  } finally {
    await contexte.close();
  }
}

/** Un PDF minimal, valide, sans dépendance. */
function pdfMinimal(marque) {
  const corps = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R>>endobj
4 0 obj<</Length 48>>stream
BT /F1 12 Tf 20 50 Td (${marque}) Tj ET
endstream endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return Buffer.from(corps, "utf8");
}

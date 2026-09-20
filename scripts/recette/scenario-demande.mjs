// =============================================================================
// §7 — Le formulaire de démonstration, dix-huit cas.
//
// C'est la seule porte d'entrée commerciale du produit : un lycée qui n'arrive
// pas à demander une démonstration est un lycée perdu sans que personne ne le
// sache. On y vérifie donc deux choses opposées — qu'il refuse ce qu'il doit
// refuser, et qu'il accepte ce qu'il doit accepter.
//
// Les envois réussis créent de vraies demandes en production. Elles portent
// une adresse en `@exemple.invalid` (domaine réservé par la RFC 2606, qui ne
// peut appartenir à personne) et sont démontées par le balai.
// =============================================================================

import { exigerPage, soumettre } from "./navigateur.mjs";

/** Une demande complète et valide, dont on dérive les cas fautifs. */
function demandeValide(marque) {
  return {
    etablissement: `Lycee de recette ${marque}`,
    commune: "Roubaix",
    effectif: "900",
    nom: "Claude Martin",
    fonction: "Proviseur",
    email: `demande.${marque.toLowerCase()}@exemple.invalid`,
    telephone: "0320000000",
    besoin: "Nous cherchons a organiser les devoirs de seconde pour la rentree.",
  };
}

async function remplir(page, valeurs) {
  for (const [nom, valeur] of Object.entries(valeurs)) {
    const champ = page.locator(`[name="${nom}"]`).first();
    if ((await champ.count()) === 0) continue;
    await champ.fill(String(valeur));
  }
}

/** Le formulaire a-t-il refusé ? On lit ce qu'il affiche, pas ce qu'on espère. */
async function aRefuse(page) {
  const erreurs = await page.locator(".erreur-champ, [role='alert']").allInnerTexts();
  return erreurs.filter((texte) => texte.trim() !== "").length > 0;
}

export async function scenarioDemande({ navigateur, base, sql, verifier }) {
  console.log("\n§7. Formulaire de demonstration");

  const marque = `RD${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await contexte.newPage();

  const compter = async () =>
    (
      await sql.query(
        "select count(*)::int n from study.commercial_requests where contact_email like '%@exemple.invalid'",
      )
    ).rows[0].n;

  const avant = await compter();

  try {
    /* --- Les cas qui doivent être refusés ---------------------------------- */

    const refus = [
      ["formulaire entierement vide", {}, false],
      ["etablissement manquant", { etablissement: "" }, true],
      ["commune manquante", { commune: "" }, true],
      ["nom du contact manquant", { nom: "" }, true],
      ["fonction manquante", { fonction: "" }, true],
      ["adresse manquante", { email: "" }, true],
      ["besoin manquant", { besoin: "" }, true],
      ["adresse invalide", { email: "pas-une-adresse" }, true],
      ["besoin trop court", { besoin: "?" }, true],
      ["telephone invalide", { telephone: "pas-un-numero" }, true],
      ["effectif negatif", { effectif: "-40" }, true],
      ["effectif decimal", { effectif: "12,5" }, true],
      ["effectif demesure", { effectif: "900000" }, true],
    ];

    for (const [libelle, ecart, avecConsentement] of refus) {
      await exigerPage(page, base, "/etablissements", {
        marqueur: '[data-testid="demande-formulaire"]',
      });

      if (Object.keys(ecart).length > 0) {
        await remplir(page, { ...demandeValide(marque), ...ecart });
      }
      if (avecConsentement) await page.locator('[name="consentement"]').check();

      await soumettre(page, '[data-testid="demande-envoyer"]');
      await page.waitForTimeout(500);

      const refuse = await aRefuse(page);
      const apres = await compter();
      verifier(
        refuse && apres === avant,
        `refus : ${libelle}`,
        refuse ? "" : "aucun message d erreur, et rien n a ete refuse",
      );
    }

    // Le consentement absent : tout est bon, sauf la case.
    await exigerPage(page, base, "/etablissements", {
      marqueur: '[data-testid="demande-formulaire"]',
    });
    await remplir(page, demandeValide(marque));
    await soumettre(page, '[data-testid="demande-envoyer"]');
    await page.waitForTimeout(500);
    verifier(
      (await aRefuse(page)) && (await compter()) === avant,
      "refus : consentement non coche",
    );

    /* --- Le cas qui doit réussir -------------------------------------------- */

    await exigerPage(page, base, "/etablissements", {
      marqueur: '[data-testid="demande-formulaire"]',
    });
    await remplir(page, demandeValide(marque));
    await page.locator('[name="consentement"]').check();
    await soumettre(page, '[data-testid="demande-envoyer"]');
    await page.waitForTimeout(1500);

    const enregistrees = (
      await sql.query(
        "select reference, state, contact_email from study.commercial_requests where establishment_name = $1",
        [`Lycee de recette ${marque}`],
      )
    ).rows;

    if (!verifier(enregistrees.length === 1, "une demande valide est enregistree", `${enregistrees.length}`)) {
      return;
    }

    const reference = enregistrees[0].reference;
    verifier(enregistrees[0].state === "nouvelle", "elle arrive a l etat « nouvelle »", enregistrees[0].state);
    verifier(
      typeof reference === "string" && reference.length >= 8,
      "une reference lisible est attribuee",
      reference,
    );

    // La référence est annoncée à la personne : sans elle, un lycée qui
    // rappelle ne peut pas dire de quoi il parle.
    const affiche = await page.evaluate(() => document.body.innerText);
    verifier(affiche.includes(reference), "la reference est affichee au visiteur");

    // Le message de confirmation doit être annoncé aux lecteurs d'écran.
    const annonce = await page.locator("[role='status'], [role='alert']").allInnerTexts();
    verifier(
      annonce.some((texte) => texte.includes(reference)),
      "la confirmation est annoncee (role status ou alert)",
    );

    /* --- Double envoi identique --------------------------------------------- */

    await exigerPage(page, base, "/etablissements", {
      marqueur: '[data-testid="demande-formulaire"]',
    });
    await remplir(page, demandeValide(marque));
    await page.locator('[name="consentement"]').check();
    await soumettre(page, '[data-testid="demande-envoyer"]');
    await page.waitForTimeout(1500);

    const apresDouble = (
      await sql.query(
        "select count(*)::int n from study.commercial_requests where establishment_name = $1",
        [`Lycee de recette ${marque}`],
      )
    ).rows[0].n;
    verifier(apresDouble === 1, "un second envoi identique ne cree pas de doublon", `${apresDouble}`);

    /* --- Aucun compte n'a été créé ------------------------------------------ */

    const comptes = (
      await sql.query(
        "select count(*)::int n from study.profiles p where p.created_at > now() - interval '5 minutes'",
      )
    ).rows[0].n;
    verifier(comptes === 0, "deposer une demande ne cree aucun compte", `${comptes} profil(s) recent(s)`);

    /* --- Le formulaire tient sur un telephone -------------------------------- */

    await page.setViewportSize({ width: 360, height: 800 });
    await exigerPage(page, base, "/etablissements", {
      marqueur: '[data-testid="demande-formulaire"]',
    });
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    verifier(!deborde, "le formulaire ne deborde pas a 360 px");

    const bouton = await page.locator('[data-testid="demande-envoyer"]').boundingBox();
    verifier(
      bouton !== null && bouton.height >= 40,
      "le bouton d envoi reste une cible tactile",
      bouton === null ? "introuvable" : `${Math.round(bouton.height)} px`,
    );
  } finally {
    await contexte.close();
  }
}

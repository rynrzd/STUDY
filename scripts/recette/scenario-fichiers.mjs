// =============================================================================
// §6 — Fichiers et stockage.
//
// Une remarque d'architecture d'abord, parce qu'elle change ce qu'il y a à
// tester : **le produit n'émet aucune URL signée.** Un support de séance
// descend par `/documents/<id>`, une route qui revérifie le droit à chaque
// requête. Il n'y a donc pas d'« URL signée courte » ni d'« expiration » à
// éprouver — il y a mieux : un lien recopié dans un courriel cesse de
// fonctionner dès que la séance est dépubliée ou que l'élève change de classe,
// ce qu'une URL signée ne sait pas faire.
//
// Ce qu'on éprouve ici, donc : ce qui entre (le type réel, la taille, le nom),
// et qui peut ressortir (la bonne classe, et personne d'autre).
// =============================================================================

import { attendreEnBase, connecter, contexteDe, exigerPage, soumettre } from "./navigateur.mjs";

/** Un PDF minimal mais authentique : la signature `%PDF-` est ce qui compte. */
function pdf(marque) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n% ${marque}\n%%EOF`,
    "utf8",
  );
}

/** Un PNG minimal : signature, puis un IHDR crédible. */
function png() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
    Buffer.alloc(24),
  ]);
}

function deposerFichier(nom, type, contenu) {
  return { name: nom, mimeType: type, buffer: contenu };
}

export async function scenarioFichiers({ navigateur, base, terrain, sql, verifier }) {
  console.log("\n§6. Fichiers et stockage");

  const marque = `RF${terrain.suffixe.toUpperCase()}`;
  const prof = await contexteDe(navigateur);
  let seance = null;

  try {
    await connecter(prof.page, base, {
      code: terrain.code,
      login: terrain.comptes.professeur.login,
      motDePasse: terrain.comptes.professeur.motDePasse ?? terrain.comptes.professeur.motDePasseTemporaire,
    });

    /* --- Une séance qui portera les fichiers -------------------------------- */

    await exigerPage(prof.page, base, "/studio", { marqueur: '[data-testid="chapitre-nouveau"]' });
    const ouvrir = prof.page.locator('[data-testid="ouvrir-nouvelle-seance"]').first();
    if ((await ouvrir.count()) > 0) await ouvrir.click();
    await prof.page.fill('[data-testid="seance-titre"]', `Seance fichiers ${marque}`);
    await soumettre(prof.page, '[data-testid="seance-valider"]');

    const seances = await attendreEnBase(
      sql,
      "select id from study.lessons where title = $1",
      [`Seance fichiers ${marque}`],
      (lignes) => lignes.length === 1,
    );
    if (!verifier(seances.length === 1, "une seance recoit les fichiers")) return;
    seance = seances[0];

    const deposer = async (fichier) => {
      await exigerPage(prof.page, base, `/studio/${seance.id}`, {
        marqueur: '[data-testid="seance-entete"]',
      });
      await prof.page.click('[data-testid="ajouter-document"]');
      await prof.page.waitForSelector('[data-testid="champ-fichier"]');
      await prof.page.setInputFiles('[data-testid="champ-fichier"]', fichier);
      await soumettre(prof.page, '[data-testid="bloc-ajouter"]');
      return prof.page.evaluate(() => document.body.innerText);
    };

    const compterFichiers = async () =>
      (
        await sql.query(
          "select count(*)::int n from study.files where organization_id = $1 and state <> 'supprime'",
          [terrain.organisation],
        )
      ).rows[0].n;

    /* --- Ce qui doit être accepté -------------------------------------------- */

    const avantValides = await compterFichiers();
    await deposer(deposerFichier(`cours-${marque}.pdf`, "application/pdf", pdf(marque)));
    await deposer(deposerFichier(`schema-${marque}.png`, "image/png", png()));

    const apresValides = await attendreEnBase(
      sql,
      "select id, display_name, mime_detected, byte_size from study.files where organization_id = $1 and state <> 'supprime' order by created_at",
      [terrain.organisation],
      (lignes) => lignes.length >= avantValides + 2,
    );
    verifier(
      apresValides.length >= avantValides + 2,
      "un PDF et un PNG sont acceptes",
      `${apresValides.length - avantValides} accepte(s)`,
    );

    const pdfEnBase = apresValides.find((f) => String(f.mime_detected) === "application/pdf");
    verifier(pdfEnBase !== undefined, "le PDF est enregistre avec son vrai type", String(pdfEnBase?.mime_detected));

    /* --- Ce qui doit être refusé ---------------------------------------------- */

    const refuses = [
      ["fichier vide", deposerFichier(`vide-${marque}.pdf`, "application/pdf", Buffer.alloc(0))],
      [
        "extension executable",
        deposerFichier(`piege-${marque}.exe`, "application/octet-stream", Buffer.from("MZ programme", "utf8")),
      ],
      [
        "fausse extension : du texte nomme .pdf",
        deposerFichier(`faux-${marque}.pdf`, "application/pdf", Buffer.from("Ceci n est pas un PDF du tout", "utf8")),
      ],
      [
        "double extension",
        deposerFichier(`devoir-${marque}.pdf.exe`, "application/pdf", Buffer.from("MZ programme", "utf8")),
      ],
    ];

    for (const [libelle, fichier] of refuses) {
      const avant = await compterFichiers();
      await deposer(fichier).catch(() => "");
      const apres = await compterFichiers();
      verifier(apres === avant, `refus : ${libelle}`, `${avant} puis ${apres} fichier(s)`);
    }

    /* --- Le contenu fait foi, pas le nom -------------------------------------- */

    // Un PNG nomme « .pdf » et annonce « application/pdf » est accepte : c est
    // bien un PNG, et le produit ne croit que les octets. Ce qui compte est
    // qu il soit enregistre pour ce qu il est, et servi comme tel — sans quoi
    // un navigateur pourrait l interpreter autrement que prevu.
    const avantTrompeur = await compterFichiers();
    await deposer(deposerFichier(`image-${marque}.pdf`, "application/pdf", png())).catch(() => "");

    if ((await compterFichiers()) > avantTrompeur) {
      const dernier = (
        await sql.query(
          "select mime_detected from study.files where organization_id = $1 order by created_at desc limit 1",
          [terrain.organisation],
        )
      ).rows[0];
      verifier(
        String(dernier.mime_detected) === "image/png",
        "un PNG nomme .pdf est enregistre comme PNG, pas comme PDF",
        String(dernier.mime_detected),
      );
    } else {
      verifier(false, "un PNG nomme .pdf reste acceptable : c est bien une image");
    }

    /* --- Un nom hostile est assaini, pas rejete ------------------------------- */

    const nomHostile = `..\\..\\etc\\passwd «é» ${"long".repeat(40)}.pdf`;
    const avantNom = await compterFichiers();
    await deposer(deposerFichier(nomHostile, "application/pdf", pdf(marque))).catch(() => "");

    if ((await compterFichiers()) > avantNom) {
      const dernier = (
        await sql.query(
          "select display_name from study.files where organization_id = $1 order by created_at desc limit 1",
          [terrain.organisation],
        )
      ).rows[0];
      const nom = String(dernier.display_name ?? "");
      verifier(
        !nom.includes("..") && !nom.includes("/") && !nom.includes("\\") && nom.length <= 90,
        "un nom hostile est assaini, sans chemin ni longueur demesuree",
        nom.slice(0, 60),
      );
    } else {
      verifier(false, "un nom hostile est assaini plutot que rejete");
    }

    /* --- Deux fichiers de meme nom cohabitent ---------------------------------- */

    const avantHomonymes = await compterFichiers();
    await deposer(deposerFichier(`identique-${marque}.pdf`, "application/pdf", pdf(`${marque}-A`)));
    await deposer(deposerFichier(`identique-${marque}.pdf`, "application/pdf", pdf(`${marque}-B`)));
    verifier(
      (await compterFichiers()) === avantHomonymes + 2,
      "deux fichiers de meme nom cohabitent sans s ecraser",
    );

    /* --- La publication, puis qui peut telecharger ------------------------------ */

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

    const { rows: attaches } = await sql.query(
      `select b.file_id from study.lesson_blocks b
        where b.lesson_id = $1 and b.file_id is not null limit 1`,
      [seance.id],
    );
    const fichierId = attaches[0]?.file_id ?? null;
    if (!verifier(fichierId !== null, "un fichier est attache a la seance publiee")) return;

    // `maxRedirects: 0` : un visiteur non connecte est **redirige** vers la
    // connexion. Suivre la redirection donnerait 200 — la page de connexion —
    // et l on conclurait que le document a ete servi.
    const telecharger = async (page) => {
      const reponse = await page.request.get(`${base}/documents/${fichierId}`, {
        maxRedirects: 0,
      });
      return {
        statut: reponse.status(),
        type: reponse.headers()["content-type"] ?? "",
        vers: reponse.headers()["location"] ?? "",
      };
    };

    const parLeProf = await telecharger(prof.page);
    verifier(parLeProf.statut === 200, "le professeur telecharge son support", `HTTP ${parLeProf.statut}`);

    const eleveA = await contexteDe(navigateur);
    const temoin = await contexteDe(navigateur);
    const anonyme = await contexteDe(navigateur);

    try {
      await connecter(eleveA.page, base, {
        code: terrain.code,
        login: terrain.comptes.eleveA.login,
        motDePasse: terrain.comptes.eleveA.motDePasse ?? terrain.comptes.eleveA.motDePasseTemporaire,
      });
      const parEleve = await telecharger(eleveA.page);
      verifier(parEleve.statut === 200, "un eleve de la classe telecharge le support", `HTTP ${parEleve.statut}`);

      await connecter(temoin.page, base, {
        code: terrain.code,
        login: terrain.comptes.eleveTemoin.login,
        motDePasse: terrain.comptes.eleveTemoin.motDePasse ?? terrain.comptes.eleveTemoin.motDePasseTemporaire,
      });
      const parTemoin = await telecharger(temoin.page);
      verifier(
        parTemoin.statut === 404,
        "un eleve d une autre classe recoit « introuvable », pas « interdit »",
        `HTTP ${parTemoin.statut}`,
      );

      const parPersonne = await telecharger(anonyme.page);
      verifier(
        parPersonne.statut !== 200,
        "un visiteur non connecte n obtient pas le document",
        `HTTP ${parPersonne.statut}`,
      );
      // La redirection doit rester sur le site. Le repli du code est
      // « localhost:3100 » : si APP_ORIGIN manquait chez l hebergeur, un
      // visiteur serait renvoye vers une adresse qui n existe pas.
      verifier(
        parPersonne.vers === "" || parPersonne.vers.startsWith(base),
        "elle renvoie vers la connexion du site, pas vers une adresse locale",
        parPersonne.vers,
      );

      /* --- Dépublier coupe l'accès, ce qu'une URL signée ne ferait pas ------ */

      await exigerPage(prof.page, base, `/studio/${seance.id}`, {
        marqueur: '[data-testid="publication"]',
      });
      await soumettre(prof.page, '[data-testid="publication-basculer"]');
      await attendreEnBase(
        sql,
        "select state from study.lessons where id = $1",
        [seance.id],
        (lignes) => lignes[0]?.state !== "publiee",
      );

      const apresDepublication = await telecharger(eleveA.page);
      verifier(
        apresDepublication.statut === 404,
        "depublier coupe le telechargement, meme avec l adresse en main",
        `HTTP ${apresDepublication.statut}`,
      );
    } finally {
      await eleveA.contexte.close();
      await temoin.contexte.close();
      await anonyme.contexte.close();
    }

    /* --- L'en-tete protege le lecteur ------------------------------------------ */

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

    const entetes = (await prof.page.request.get(`${base}/documents/${fichierId}`)).headers();
    verifier(
      String(entetes["content-disposition"] ?? "").startsWith("attachment"),
      "le document descend en piece jointe, jamais rendu dans l origine du site",
      String(entetes["content-disposition"] ?? "").slice(0, 40),
    );
    verifier(
      entetes["x-content-type-options"] === "nosniff",
      "le navigateur ne devine pas le type",
    );
    verifier(
      String(entetes["cache-control"] ?? "").includes("no-store"),
      "aucun intermediaire ne met le document en cache",
      String(entetes["cache-control"] ?? ""),
    );
  } finally {
    await prof.contexte.close();
  }
}

// =============================================================================
// Le socle navigateur connecté — §1 à §9 du cahier.
//
// Trois exigences gouvernent ce fichier, et chacune vient d'une erreur déjà
// commise.
//
// **On vérifie l'origine, à chaque page.** Une recette qui charge
// `localhost:3100` ou une préversion Vercel mesure autre chose que le produit
// livré, et le dit avec assurance. `exigerPage()` refuse toute origine autre
// que celle annoncée.
//
// **On refuse une page d'erreur.** Un navigateur qui n'a pas pu joindre le
// site affiche la sienne ; l'application a la sienne. Mesurer l'une ou l'autre
// en croyant mesurer un écran produit fabrique des défauts imaginaires — cela
// s'est produit, et cela a coûté une demi-journée d'analyse.
//
// **On ne choisit jamais un élément par « le premier qui porte ce texte ».**
// Deux boutons « Enregistrer » coexistent dans le Studio. Un script qui prend
// le premier teste ce qu'il trouve, pas ce qu'il vise. Tout passe par
// `data-testid`.
//
// Les secrets — mots de passe temporaires, clés TOTP lues à l'écran — ne sont
// ni affichés, ni journalisés, ni écrits sur disque. Ils traversent la mémoire
// le temps d'une connexion.
// =============================================================================

import { chromium } from "playwright-core";
import { codeStable } from "./totp.mjs";

/** Les textes qui trahissent une page d'erreur, la nôtre ou celle du navigateur. */
const SIGNES_D_ERREUR = [
  "Le service n'a pas pu répondre",
  "Signaler le problème",
  "ERR_CONNECTION",
  "ERR_NAME_NOT_RESOLVED",
  "Cette page ne fonctionne pas",
  "This site can",
];

export async function ouvrirNavigateur() {
  const canal = process.env.NAVIGATEUR_RECETTE ?? "msedge";
  return chromium.launch({ channel: canal });
}

/**
 * Ouvre une page et **prouve** que c'est la bonne.
 *
 * `attendu` est un chemin (ou une expression régulière) que l'adresse finale
 * doit satisfaire après d'éventuelles redirections ; `marqueur` un sélecteur
 * qui n'existe que sur l'écran visé. Sans ce second contrôle, une redirection
 * silencieuse vers la connexion passerait pour un succès.
 */
export async function exigerPage(page, base, chemin, { attendu = null, marqueur = null, essais = 3 } = {}) {
  const cible = `${base}${chemin}`;
  let dernier = "";

  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const reponse = await page.goto(cible, { waitUntil: "networkidle", timeout: 30_000 });
      const statut = reponse?.status() ?? 0;
      if (statut >= 400) {
        dernier = `HTTP ${statut}`;
        continue;
      }

      const verdict = await verifierEcran(page, base, { attendu, marqueur });
      if (verdict === null) return page;
      dernier = verdict;
    } catch (erreur) {
      dernier = erreur.message.split("\n")[0];
    }
  }

  throw new Error(`${chemin} : ${dernier}`);
}

/**
 * Ce que la page affiche est-il acceptable ? `null` si oui, le motif sinon.
 *
 * À appeler aussi après une navigation provoquée par un clic — c'est là que
 * les mauvaises surprises arrivent, pas sur les `goto`.
 */
export async function verifierEcran(page, base, { attendu = null, marqueur = null } = {}) {
  const adresse = page.url();

  if (!adresse.startsWith(base)) {
    return `origine inattendue — ${new URL(adresse).origin} au lieu de ${base}`;
  }

  const texte = await page.evaluate(() => document.body?.innerText ?? "");
  for (const signe of SIGNES_D_ERREUR) {
    if (texte.includes(signe)) return `page d erreur affichee (« ${signe} »)`;
  }

  if (attendu !== null) {
    const chemin = new URL(adresse).pathname;
    const ok = attendu instanceof RegExp ? attendu.test(chemin) : chemin === attendu;
    if (!ok) return `adresse inattendue — ${chemin} au lieu de ${attendu}`;
  }

  if (marqueur !== null && (await page.locator(marqueur).count()) === 0) {
    return `marqueur absent — ${marqueur}`;
  }

  return null;
}

/**
 * Clique, et attend que la page ait **réellement** changé.
 *
 * `waitForLoadState("networkidle")` ne suffit pas : il peut se satisfaire de
 * l'état courant avant même que la navigation commence. On lit alors l'ancienne
 * adresse et l'on conclut « refusé » alors que le produit fonctionnait — c'est
 * exactement l'erreur qui a fait croire à une connexion cassée.
 *
 * `quitter` nomme le chemin qu'on doit avoir quitté ; à défaut, on se contente
 * d'attendre que le réseau se taise après la navigation.
 */
export async function soumettre(page, selecteur, { quitter = null, delai = 30_000 } = {}) {
  const depart = new URL(page.url()).pathname;
  await page.click(selecteur);

  try {
    if (quitter !== null) {
      await page.waitForURL((url) => new URL(url).pathname !== quitter, { timeout: delai });
    } else {
      await page.waitForURL((url) => new URL(url).pathname !== depart, { timeout: delai });
    }
  } catch {
    // Certaines actions ne naviguent pas : elles remplacent le contenu sur
    // place. Ce n'est pas une faute, et l'appelant vérifiera le résultat.
  }

  await page.waitForLoadState("networkidle").catch(() => {});
  await attendreStabilisation(page);
}

/**
 * Attend que l'adresse cesse de bouger.
 *
 * Le produit enchaîne des redirections : `/app` aiguille selon le rôle, et
 * `/admin` renvoie vers le second facteur. Lire l'adresse au milieu de cette
 * chaîne donne une réponse vraie à un instant qui n'intéresse personne — et
 * fait manquer l'écran qu'on cherchait.
 */
export async function attendreStabilisation(page, { calme = 600, delai = 20_000 } = {}) {
  const limite = Date.now() + delai;
  let precedente = page.url();
  let stableDepuis = Date.now();

  while (Date.now() < limite) {
    await page.waitForTimeout(150);
    const courante = page.url();

    if (courante !== precedente) {
      precedente = courante;
      stableDepuis = Date.now();
      continue;
    }
    if (Date.now() - stableDepuis >= calme) return courante;
  }

  return page.url();
}

/**
 * Connecte un compte, en traversant tout ce que le produit peut exiger.
 *
 * Trois étapes possibles, dans l'ordre où le produit les impose : le mot de
 * passe, l'activation (choix d'un mot de passe définitif), le second facteur.
 * Une recette qui ne traiterait que la première ne pourrait pas ouvrir un
 * compte d'administration — c'est-à-dire la moitié du produit.
 *
 * Rend la destination atteinte et, si un second facteur a été enrôlé, sa clé —
 * **en mémoire seulement**, pour que l'appelant puisse se reconnecter. Elle
 * n'est jamais journalisée.
 */
export async function connecter(page, base, identite) {
  const { code, login, motDePasse, motDePasseFinal = null } = identite;

  await exigerPage(page, base, "/connexion", { attendu: "/connexion", marqueur: "#identifiant" });

  await page.fill("#code", code);
  await page.fill("#identifiant", login);
  await page.fill("#motDePasse", motDePasse);
  await soumettre(page, '[data-testid="connexion-valider"]', { quitter: "/connexion" });

  let secretTotp = identite.secretTotp ?? null;
  let motDePasseCourant = motDePasse;

  // Les écrans se reconnaissent à **ce qu'ils affichent**, pas à l'adresse.
  //
  // Le produit enchaîne `/app` → `/admin` → `/second-facteur`, et lorsque cette
  // chaîne est déclenchée par la redirection d'une action serveur, le routeur
  // rend l'écran final en gardant l'adresse de départ. Se fier à l'URL fait
  // alors manquer l'enrôlement, et conclure que l'administrateur « n'arrive
  // pas dans son espace » alors qu'il est devant le bon écran.
  const affiche = async (selecteur) => (await page.locator(selecteur).count()) > 0;

  // Les étapes s'enchaînent, et l'ordre n'est pas toujours celui qu'on croit :
  // après l'activation, le produit peut enchaîner directement sur le second
  // facteur. On boucle donc sur « quel écran ai-je devant moi » au lieu de
  // dérouler une séquence fixe — et l'on repasse par `/app`, qui résout les
  // redirections côté serveur, plutôt que de lire un écran en plein transit.
  /**
   * Note la clé si l'écran la présente, à cet instant précis.
   *
   * Elle n'est affichée qu'une fois, et le produit le dit à la personne :
   * « cette clé ne sera plus affichée ».
   */
  const noterLaCle = async () => {
    if (secretTotp !== null) return;
    if ((await page.locator('[data-testid="cle-totp"]').count()) === 0) return;

    const affichee = await page
      .locator('[data-testid="cle-totp"]')
      .textContent()
      .catch(() => null);

    if (affichee !== null && affichee.trim() !== "") {
      secretTotp = affichee.replace(/\s/g, "");
    }
  };

  for (let etape = 0; etape < 8; etape += 1) {
    // **On ne navigue pas si l'écran attendu est déjà là.**
    //
    // `preparerEnrolement` retire les facteurs non vérifiés avant d'en créer un
    // nouveau : chaque affichage de l'écran d'enrôlement **révoque donc le
    // secret précédent**. C'est la bonne règle — une clé abandonnée ne doit pas
    // rester valable — mais elle rend fatale toute navigation entre le moment
    // où l'on lit la clé et celui où l'on envoie le code : le serveur en tient
    // déjà une autre, et il refuse, indéfiniment.
    //
    // Repasser par `/app` reste utile quand on ne reconnaît pas l'écran
    // courant : c'est lui qui résout les redirections côté serveur. Mais il ne
    // faut y retourner que dans ce cas-là.
    const dejaSurUnEcranConnu =
      (await page.locator('#nouveau, [data-testid="totp-valider"]').count()) > 0;

    if (!dejaSurUnEcranConnu) {
      await exigerPage(page, base, "/app", {}).catch(() => {});
    }
    await attendreStabilisation(page);

    // On attend qu'un écran **connu** soit là avant de décider. Sans cela, la
    // boucle lit une page encore en cours de rendu, ne reconnaît rien, sort,
    // et l'on conclut que l'enrôlement n'a pas eu lieu alors qu'il n'a jamais
    // été proposé. C'était intermittent, donc pire qu'une panne franche.
    await page
      .waitForSelector(
        '#nouveau, [data-testid="totp-valider"], [data-testid="connexion-valider"], main',
        { timeout: 15_000 },
      )
      .catch(() => {});

    if (await affiche("#nouveau")) {
      const definitif = motDePasseFinal ?? `Definitif-${Math.random().toString(36).slice(2, 12)}!aA1`;
      await page.fill("#nouveau", definitif);
      await page.fill("#confirmation", definitif);
      await soumettre(page, '[data-testid="activation-valider"]');
      motDePasseCourant = definitif;
      continue;
    }

    // **La préparation a échoué : on réessaie au lieu de conclure.**
    //
    // `preparerEnrolement` appelle le fournisseur d'identité, et cet appel peut
    // échouer — un ralentissement, une limite de débit atteinte après beaucoup
    // d'enrôlements dans la journée. L'écran n'a alors ni clé ni formulaire.
    //
    // La boucle sortait sans rien reconnaître, et le message final parlait de
    // « clé non présentée » : une phrase exacte et inutile, puisqu'elle décrit
    // le symptôme et non la cause. Rechargée, la page relance la préparation.
    if (await affiche('[data-testid="second-facteur-erreur"]')) {
      await page.waitForTimeout(1500);
      await exigerPage(page, base, "/second-facteur", {}).catch(() => {});
      continue;
    }

    if (await affiche('[data-testid="totp-valider"]')) {
      // Enrôlement si la clé n'est pas encore connue, simple vérification
      // sinon. La clé n'est lue qu'ici, et ne quitte pas la mémoire.
      //
      // **Pourquoi on attend la clé au lieu de regarder si elle est là.**
      // Le bouton de validation et la clé ne paraissent pas au même instant :
      // le formulaire est dans le HTML servi, la clé arrive avec le secret
      // que le serveur vient de générer. Un simple « est-elle présente ? »
      // lit donc parfois l'écran entre les deux, conclut « aucune clé » et
      // fait échouer un enrôlement qui se serait très bien passé une seconde
      // plus tard. La recette est ressortie rouge pour cette seule raison,
      // sur un produit qui n'avait rien.
      //
      // On attend donc explicitement, et l'échec ne se prononce qu'après.
      if (secretTotp === null) {
        await page
          .waitForSelector('[data-testid="cle-totp"]', { timeout: 10_000, state: "attached" })
          .catch(() => {});
      }
      await noterLaCle();

      if (secretTotp === null) {
        throw new Error("second facteur : un code est demande, sans cle connue ni presentee");
      }

      await page.fill("#code", await codeStable(secretTotp));
      await soumettre(page, '[data-testid="totp-valider"]');

      const continuer = page.locator('a:has-text("Continuer")');
      if ((await continuer.count()) > 0) {
        await continuer.click();
        await page.waitForLoadState("networkidle").catch(() => {});
      }

      // **Le code a-t-il été accepté ?**
      //
      // `preparerEnrolement` retire les facteurs non vérifiés avant d'en créer
      // un nouveau. Un code refusé — une fenêtre qui roule, une horloge qui
      // dérive de quelques secondes — fait donc **rotater le secret** : la clé
      // qu'on tient ne vaut plus rien, et la rejouer échoue indéfiniment. La
      // boucle s'épuisait alors en répétant un code périmé, et concluait que
      // l'enrôlement n'avait pas eu lieu.
      //
      // On ne suppose donc pas que le premier code passe. S'il est refusé, on
      // oublie la clé : le tour suivant relira celle que le serveur vient
      // d'afficher, et le mot « réessayer » retrouve son sens.
      if (await affiche('[data-testid="totp-valider"]')) {
        // Une nouvelle clé à l'écran est la **preuve** que le secret a tourné :
        // le code qu'on tient ne vaut plus rien. C'est le seul signe sûr, et
        // il vaut mieux que « il y a une alerte » — un écran de réussite en
        // porte une aussi.
        if (await affiche('[data-testid="cle-totp"]')) {
          secretTotp = null;
          await noterLaCle();
        }
      }

      continue;
    }

    break;
  }

  const probleme = await verifierEcran(page, base);
  if (probleme !== null) throw new Error(`connexion de ${login} : ${probleme}`);

  if (await affiche('[data-testid="connexion-valider"]')) {
    // Le message affiché dit pourquoi ; sans lui, « refusée » n'apprend rien et
    // oblige à rejouer la scène à la main.
    const dit = await page
      .locator('[role="alert"], [role="status"]')
      .allInnerTexts()
      .catch(() => []);
    const motif = dit.join(" / ").trim();
    throw new Error(
      `connexion de ${login} : refusee${motif === "" ? "" : ` — « ${motif} »`}`,
    );
  }

  // La destination réelle : celle que le produit sert une fois toutes les
  // exigences satisfaites. On la relit par « /app », qui aiguille selon le
  // rôle, plutôt que de garder une adresse de transit.
  await exigerPage(page, base, "/app", {}).catch(() => {});
  await attendreStabilisation(page);

  return { destination: new URL(page.url()).pathname, secretTotp, motDePasse: motDePasseCourant };
}

/**
 * Attend qu'une écriture attendue apparaisse en base.
 *
 * Une action serveur répond à l'écran avant que tout soit relu ; interroger la
 * base dans la foulée donne parfois zéro ligne pour une écriture qui a bien eu
 * lieu. On patiente donc un peu — mais on abandonne, plutôt que d'attendre
 * indéfiniment une écriture qui n'arrivera jamais.
 *
 * Ce n'est pas une indulgence : au bout du délai, le contrôle échoue.
 */
export async function attendreEnBase(sql, requete, params, accepte, { delai = 8000 } = {}) {
  const limite = Date.now() + delai;
  let dernier = [];

  for (;;) {
    const { rows } = await sql.query(requete, params);
    dernier = rows;
    if (accepte(rows)) return rows;
    if (Date.now() >= limite) return dernier;
    await new Promise((resoudre) => setTimeout(resoudre, 400));
  }
}

/** Ferme la session côté serveur, comme le ferait la personne. */
export async function deconnecter(page, base) {
  await page.goto(`${base}/deconnexion`, { waitUntil: "networkidle" }).catch(() => {});
  await page.context().clearCookies();
}

/**
 * Un contexte navigateur par personne.
 *
 * Deux élèves partageant un contexte partageraient leurs cookies : le second
 * prendrait la session du premier, et l'isolation testée serait une illusion.
 */
export async function contexteDe(navigateur) {
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  return { contexte, page: await contexte.newPage() };
}

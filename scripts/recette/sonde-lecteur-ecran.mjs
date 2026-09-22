// =============================================================================
// Ce qu'un lecteur d'écran a pour matière.
//
// Un lecteur d'écran ne voit pas la page : il lit l'**arbre d'accessibilité**
// que le navigateur en tire. Un bouton sans nom accessible s'y annonce
// « bouton », un champ sans étiquette « zone d'édition », et deux liens
// « En savoir plus » pointant ailleurs s'y annoncent de la même façon.
//
// Cette sonde parcourt cet arbre et relève ce qui s'y entend mal. Elle ne
// remplace pas une écoute : un arbre correct peut produire une lecture
// pénible — un ordre déroutant, une verbosité inutile, une annonce qui arrive
// trop tard. Ce qu'elle garantit, c'est qu'il n'y a **rien de muet**.
//
// Elle s'exécute dans le navigateur : rien de ce dépôt n'y est disponible.
// =============================================================================

export function sondeLecteurEcran() {
  const fautes = [];
  const compte = { interactifs: 0, titres: 0, champs: 0, images: 0 };

  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden") return false;
    return element.getClientRects().length > 0;
  };

  /** Un repère pour retrouver l'élément sans ambiguïté. */
  const designer = (element) => {
    const marque = element.getAttribute("data-testid");
    if (marque !== null) return `[data-testid="${marque}"]`;
    const id = element.getAttribute("id");
    if (id !== null && id !== "") return `#${id}`;
    const classe = String(element.className ?? "")
      .split(/\s+/)
      .filter((c) => c !== "" && !c.startsWith("[") && !c.includes(":"))
      .slice(0, 2)
      .join(".");
    return classe === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}.${classe}`;
  };

  /**
   * Le nom accessible, calculé comme le navigateur le calcule.
   *
   * L'ordre compte : `aria-labelledby` l'emporte sur `aria-label`, qui
   * l'emporte sur le contenu, qui l'emporte sur `title`. Un élément dont
   * aucune de ces sources ne donne de texte est muet.
   */
  const nomAccessible = (element) => {
    const parId = element.getAttribute("aria-labelledby");
    if (parId !== null) {
      const textes = parId
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter((t) => t !== "");
      if (textes.length > 0) return textes.join(" ");
    }

    const etiquette = element.getAttribute("aria-label");
    if (etiquette !== null && etiquette.trim() !== "") return etiquette.trim();

    // Un champ de formulaire : son `<label for>`, ou le label qui l'enveloppe.
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) {
      const id = element.getAttribute("id");
      if (id !== null && id !== "") {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const texte = label?.textContent?.trim() ?? "";
        if (texte !== "") return texte;
      }
      const enveloppe = element.closest("label");
      const texte = enveloppe?.textContent?.trim() ?? "";
      if (texte !== "") return texte;

      // Dernier recours reconnu par les lecteurs d'écran.
      const substitut = element.getAttribute("placeholder") ?? element.getAttribute("title") ?? "";
      return substitut.trim();
    }

    if (element.tagName === "IMG") return (element.getAttribute("alt") ?? "").trim();

    const contenu = element.textContent?.trim() ?? "";
    if (contenu !== "") return contenu;

    // Une image à l'intérieur d'un lien ou d'un bouton porte parfois le nom.
    const image = element.querySelector("img[alt]");
    if (image !== null) return (image.getAttribute("alt") ?? "").trim();

    return (element.getAttribute("title") ?? "").trim();
  };

  const ajouter = (genre, ou, detail) => fautes.push({ genre, ou, detail });

  /* --- 1. Le squelette du document --------------------------------------- */

  const langue = document.documentElement.getAttribute("lang");
  if (langue === null || langue.trim() === "") {
    ajouter("langue", "html", "aucun attribut lang : la synthese vocale choisit au hasard");
  }

  if ((document.title ?? "").trim() === "") {
    ajouter("titre", "head", "la page n a pas de titre : l onglet et l annonce d arrivee sont vides");
  }

  const principaux = [...document.querySelectorAll("main, [role='main']")].filter(visible);
  if (principaux.length === 0) {
    ajouter("repere", "document", "aucun point de repere « main » : impossible d aller au contenu");
  } else if (principaux.length > 1) {
    ajouter("repere", "document", `${principaux.length} points de repere « main » : il n en faut qu un`);
  }

  /* --- 2. Les titres ------------------------------------------------------ */

  const titres = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(visible);
  compte.titres = titres.length;

  const premiers = titres.filter((t) => t.tagName === "H1");
  if (premiers.length === 0) {
    ajouter("titres", "document", "aucun h1 : la page ne dit pas de quoi elle parle");
  } else if (premiers.length > 1) {
    ajouter("titres", "document", `${premiers.length} h1 : le plan de la page devient ambigu`);
  }

  let precedent = 0;
  for (const titre of titres) {
    const niveau = Number(titre.tagName.slice(1));
    if (precedent !== 0 && niveau > precedent + 1) {
      ajouter(
        "titres",
        designer(titre),
        `saut de h${precedent} a h${niveau} : la navigation par titres perd une marche`,
      );
    }
    if ((titre.textContent ?? "").trim() === "") {
      ajouter("titres", designer(titre), "titre vide");
    }
    precedent = niveau;
  }

  /* --- 3. Ce qui se manipule ---------------------------------------------- */

  const interactifs = [
    ...document.querySelectorAll(
      "a[href], button, input:not([type='hidden']), select, textarea, [role='button'], [role='link']",
    ),
  ].filter(visible);

  compte.interactifs = interactifs.length;

  for (const element of interactifs) {
    const nom = nomAccessible(element);

    if (nom === "") {
      ajouter(
        "muet",
        designer(element),
        `${element.tagName.toLowerCase()} sans nom accessible : annonce « ${
          element.tagName === "A" ? "lien" : "bouton"
        } », et rien d autre`,
      );
      continue;
    }

    // Un nom réduit à un symbole ne se prononce pas.
    if (/^[\s\p{P}\p{S}]+$/u.test(nom)) {
      ajouter("muet", designer(element), `nom accessible « ${nom} » : un symbole ne se prononce pas`);
    }

    if (/^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) {
      compte.champs += 1;

      // Un champ dont le seul nom vient du `placeholder` devient muet dès que
      // la personne commence à taper.
      const id = element.getAttribute("id");
      const aUnLabel =
        element.hasAttribute("aria-label") ||
        element.hasAttribute("aria-labelledby") ||
        element.closest("label") !== null ||
        (id !== null && id !== "" && document.querySelector(`label[for="${CSS.escape(id)}"]`) !== null);

      if (!aUnLabel) {
        ajouter(
          "etiquette",
          designer(element),
          "champ sans etiquette : son nom ne tient qu au texte d invite, qui disparait a la saisie",
        );
      }
    }
  }

  /* --- 4. Deux liens qui se disent pareil et vont ailleurs ---------------- */

  const parNom = new Map();
  for (const lien of interactifs.filter((e) => e.tagName === "A")) {
    const nom = nomAccessible(lien).toLowerCase().replace(/\s+/g, " ");
    if (nom === "") continue;
    if (!parNom.has(nom)) parNom.set(nom, new Set());
    parNom.get(nom).add(lien.getAttribute("href"));
  }

  for (const [nom, cibles] of parNom) {
    if (cibles.size > 1) {
      ajouter(
        "ambigu",
        "liens",
        `« ${nom} » mene a ${cibles.size} adresses differentes : la liste des liens ne les distingue pas`,
      );
    }
  }

  /* --- 5. Les images ------------------------------------------------------ */

  for (const image of [...document.querySelectorAll("img")].filter(visible)) {
    compte.images += 1;
    const alt = image.getAttribute("alt");
    const decorative = alt === "" || image.getAttribute("role") === "presentation";
    if (alt === null && !decorative) {
      ajouter("image", designer(image), "image sans alt : son nom de fichier sera lu a la place");
    }
  }

  /* --- 6. Les tableaux ---------------------------------------------------- */

  for (const tableau of [...document.querySelectorAll("table")].filter(visible)) {
    if (tableau.querySelector("th") === null) {
      ajouter("tableau", designer(tableau), "tableau sans en-tete : chaque cellule est lue sans contexte");
    }
  }

  return { fautes, compte };
}

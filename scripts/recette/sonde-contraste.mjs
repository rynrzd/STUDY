// =============================================================================
// Les sondes de contraste, isolées de tout script.
//
// Elles vivent à part pour une raison très concrète : `contraste.mjs` est un
// script — il lance un navigateur au chargement du module. Les importer depuis
// là aurait exécuté toute la vérification publique au moment où la recette
// connectée voulait seulement mesurer un écran fermé.
//
// Ce fichier n'exécute rien. Il n'exporte que deux fonctions, écrites pour
// être passées telles quelles à `page.evaluate` : elles s'exécutent dans le
// navigateur, où rien de ce dépôt n'est disponible — pas même un import. C'est
// pourquoi tout y est redéfini sur place, jusqu'à la conversion des couleurs.
// =============================================================================

/**
 * Ce qui est mesuré dans la page : le texte, puis les composants.
 *
 * Les seuils sont ceux de WCAG 2.2 AA — 4,5:1 pour du texte normal, 3:1 pour
 * du grand texte et pour la frontière d'un composant. Le fond retenu est le
 * fond **effectif** : un fond transparent n'est pas blanc, c'est celui de ce
 * qu'il y a dessous, et toute approximation à cet endroit fausse la mesure.
 */
export function sondeContraste() {
  const lire = (valeur) => {
    const m = String(valeur).match(/rgba?\(([^)]+)\)/);
    if (m === null) return null;
    const parts = m[1].split(/[,\s/]+/).filter((x) => x !== "").map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], v: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  /** Une couleur semi-transparente posée sur une autre. */
  const poser = (dessus, dessous) => {
    const a = dessus.a;
    return {
      r: dessus.r * a + dessous.r * (1 - a),
      v: dessus.v * a + dessous.v * (1 - a),
      b: dessus.b * a + dessous.b * (1 - a),
      a: 1,
    };
  };

  const luminance = (c) => {
    const canal = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.v) + 0.0722 * canal(c.b);
  };

  const rapport = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const enTexte = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.v)}, ${Math.round(c.b)})`;

  const fondEffectif = (element) => {
    const couches = [];
    let courant = element;

    while (courant !== null) {
      const couleur = lire(getComputedStyle(courant).backgroundColor);
      if (couleur !== null && couleur.a > 0) {
        couches.push(couleur);
        if (couleur.a >= 1) break;
      }
      courant = courant.parentElement;
    }

    let resultat = { r: 255, v: 255, b: 255, a: 1 };
    for (let i = couches.length - 1; i >= 0; i -= 1) {
      resultat = poser(couches[i], resultat);
    }
    return resultat;
  };

  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.opacity === "0") return false;
    return element.getClientRects().length > 0;
  };

  /** Un repère pour retrouver l'élément fautif sans ambiguïté. */
  const designer = (element) => {
    const marque = element.getAttribute("data-testid");
    if (marque !== null) return `[data-testid="${marque}"]`;
    const classe = String(element.className ?? "")
      .split(/\s+/)
      .filter((c) => c !== "" && !c.startsWith("["))
      .slice(0, 2)
      .join(".");
    return classe === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}.${classe}`;
  };

  const fautes = [];
  const vus = new Set();
  let mesures = 0;

  /* --- 1. Le texte --------------------------------------------------------- */

  for (const element of document.body.querySelectorAll("*")) {
    // Seulement les éléments qui portent eux-mêmes du texte : sinon on
    // mesurerait un conteneur pour la couleur héritée de son enfant.
    const propre = [...element.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join("");
    if (propre === "") continue;
    if (!visible(element)) continue;

    const style = getComputedStyle(element);
    const couleur = lire(style.color);
    if (couleur === null || couleur.a === 0) continue;

    const fond = fondEffectif(element);
    const teinte = couleur.a < 1 ? poser(couleur, fond) : couleur;

    const taille = parseFloat(style.fontSize);
    const graisse = parseInt(style.fontWeight, 10) || 400;
    const grand = taille >= 24 || (taille >= 18.66 && graisse >= 700);
    const exige = grand ? 3 : 4.5;

    const mesure = rapport(teinte, fond);
    mesures += 1;

    if (mesure + 0.005 < exige) {
      const cle = `${designer(element)}|${enTexte(teinte)}|${enTexte(fond)}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      fautes.push({
        genre: grand ? "grand texte" : "texte",
        ou: designer(element),
        extrait: propre.slice(0, 40),
        avant: enTexte(teinte),
        arriere: enTexte(fond),
        mesure: Math.round(mesure * 100) / 100,
        exige,
      });
    }
  }

  /* --- 2. Les composants : bordures de champs et de boutons ---------------- */

  for (const element of document.body.querySelectorAll(
    "input, select, textarea, button, [role='checkbox'], [role='switch']",
  )) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);

    // Un composant sans bordure visible se distingue par son fond : c'est
    // alors le fond qui doit contraster avec ce qui l'entoure.
    const largeur = parseFloat(style.borderTopWidth) || 0;
    const fondParent =
      element.parentElement === null
        ? { r: 255, v: 255, b: 255, a: 1 }
        : fondEffectif(element.parentElement);

    const teinte = largeur > 0 ? lire(style.borderTopColor) : lire(style.backgroundColor);
    if (teinte === null || teinte.a === 0) continue;

    const effective = teinte.a < 1 ? poser(teinte, fondParent) : teinte;
    const mesure = rapport(effective, fondParent);
    mesures += 1;

    if (mesure + 0.005 < 3) {
      const cle = `composant|${designer(element)}|${enTexte(effective)}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      fautes.push({
        genre: largeur > 0 ? "bordure de composant" : "fond de composant",
        ou: designer(element),
        extrait: (element.getAttribute("name") ?? element.type ?? "").slice(0, 40),
        avant: enTexte(effective),
        arriere: enTexte(fondParent),
        mesure: Math.round(mesure * 100) / 100,
        exige: 3,
      });
    }
  }

  return { fautes, mesures };
}

/**
 * Le contour de focus de l'élément actuellement focalisé.
 *
 * Un focus peut se marquer par un contour ou par une ombre portée. Les deux
 * comptent ; l'absence des deux est la faute, et WCAG 2.2 demande 3:1.
 */
export function sondeFocus() {
  const lire = (valeur) => {
    const m = String(valeur).match(/rgba?\(([^)]+)\)/);
    if (m === null) return null;
    const p = m[1].split(/[,\s/]+/).filter((x) => x !== "").map(Number);
    if (p.length < 3 || p.some(Number.isNaN)) return null;
    return { r: p[0], v: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const luminance = (c) => {
    const canal = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.v) + 0.0722 * canal(c.b);
  };

  const rapport = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);

  const actif = document.activeElement;
  if (actif === null || actif === document.body) return null;

  const style = getComputedStyle(actif);
  const contour = lire(style.outlineColor);
  const epaisseur = parseFloat(style.outlineWidth) || 0;
  const ombre = style.boxShadow;

  if (epaisseur === 0 && (ombre === "none" || ombre === "")) {
    return { visible: false, mesure: 0, couleur: "", fond: "" };
  }

  let fond = { r: 255, v: 255, b: 255, a: 1 };
  let courant = actif.parentElement;
  while (courant !== null) {
    const c = lire(getComputedStyle(courant).backgroundColor);
    if (c !== null && c.a >= 1) {
      fond = c;
      break;
    }
    courant = courant.parentElement;
  }

  const teinte =
    epaisseur > 0 && contour !== null && contour.a > 0
      ? contour
      : (lire(ombre.match(/rgba?\([^)]+\)/)?.[0] ?? "") ?? null);

  if (teinte === null) return { visible: true, mesure: 0, couleur: "", fond: "" };

  return {
    visible: true,
    mesure: Math.round(rapport(teinte, fond) * 100) / 100,
    couleur: `rgb(${teinte.r}, ${teinte.v}, ${teinte.b})`,
    fond: `rgb(${fond.r}, ${fond.v}, ${fond.b})`,
    ou: actif.tagName.toLowerCase(),
  };
}

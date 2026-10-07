/**
 * Scène du hero de la landing — chargée à la demande.
 *
 * Le logo est le **vrai** logo : contours extraits de la police du site
 * (Manrope 800, approche -0,06 em, `public/visuels/logo-study.svg`), extrudés
 * faiblement avec un biseau doux. Le ruban reprend la géométrie du ruban
 * Study (`ruban/scene.ts`) avec un chemin plus ouvert et une section de satin
 * plate et fine.
 *
 * Calage : la scène ne décide d'aucune position. Elle mesure le logo HTML
 * (`.intro-logo`) et l'image fixe du ruban (`.intro-poster`), que le CSS place,
 * et s'y ajuste : caméra à distance fixe, champ calculé pour que le logo 3D
 * ait exactement la largeur du logo HTML, décentrage de la projection pour
 * qu'il tombe sur son centre ; ruban mis à l'échelle de l'image fixe. Le
 * passage image fixe → 3D se fait donc sans saut, à toutes les largeurs.
 *
 * Qualité (diagnostic du 7 octobre 2026) : l'ancienne scène désactivait
 * l'anticrénelage sur téléphone et plafonnait la résolution à 1,25 pour des
 * écrans à 3 — d'où les contours crénelés. Ici : anticrénelage partout,
 * résolution native (jusqu'à 3), bornée à 3,2 millions de pixels de tampon.
 *
 * Rendu à la demande : une image par changement de progression ou de taille,
 * jamais en boucle. Arrêt hors écran et onglet masqué ; perte de contexte :
 * abandon et retour à l'image fixe. Démontage complet.
 */

import type * as TroisType from "three";
import { geometrieRuban } from "../ruban/scene";

export interface SceneIntro {
  readonly progression: (p: number) => void;
  readonly detruire: () => void;
}

const lisse = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distance fixe de la caméra : la perspective reste la même à toutes les tailles. */
const RECUL = 30;
/** Profondeur du ruban derrière le plan du logo. */
const PROFONDEUR_RUBAN = 1.6;
/** Largeur d'encre du logo, en unités du SVG (getBBox) : le calage se fait sur l'encre. */
const ENCRE_LOGO = 5260;
/** Marge intérieure du cadre de l'image fixe que le ruban laisse libre. */
const MARGE_RUBAN = 0.03;
/** Pixels de tampon au plus (qualité bornée, pas sans limite). */
const PIXELS_MAX = 3_200_000;

/**
 * Chemin du ruban de l'introduction : une grande vague de satin qui passe
 * derrière le logo, avec une torsion. Même idée que le ruban Study, sans
 * l'anneau gonflé ni de boucle près du point (lue comme une lettre).
 */
const CHEMIN_INTRO: readonly [number, number, number][] = [
  [-3.6, -0.35, 0.25],
  [-2.6, -0.85, 0.4],
  [-1.5, -0.95, 0.25],
  [-0.4, -0.55, -0.05],
  [0.7, 0.05, -0.25],
  [1.7, 0.55, -0.15],
  [2.6, 0.75, 0.15],
  [3.6, 0.55, 0.3],
];

export interface OptionsIntro {
  /** Logo HTML : le logo 3D en reprend exactement le rectangle. */
  readonly logo: Element;
  /** Image fixe du ruban : le ruban 3D en reprend le cadre. */
  readonly ruban: Element;
  readonly mobile: boolean;
  readonly premiereImage: () => void;
  readonly abandon: () => void;
  readonly logicielAccepte?: boolean;
  readonly sansLogo?: boolean;
}

export async function monterIntro(hote: HTMLElement, options: OptionsIntro): Promise<SceneIntro | null> {
  const T = await import("three");
  const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const source = await fetch("/visuels/logo-study.svg").then((r) => (r.ok ? r.text() : null)).catch(() => null);
  if (source === null) return null;

  let rendu: TroisType.WebGLRenderer;
  try {
    rendu = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: options.mobile ? "low-power" : "default",
      failIfMajorPerformanceCaveat: options.logicielAccepte !== true,
    });
  } catch {
    return null;
  }
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = T.SRGBColorSpace;
  rendu.toneMapping = T.NeutralToneMapping;
  rendu.toneMappingExposure = 1;

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(rendu);
  const piece = new RoomEnvironment();
  const environnement = pmrem.fromScene(piece, 0.04).texture;
  scene.environment = environnement;
  pmrem.dispose();
  const aLiberer: { dispose: () => void }[] = [environnement];
  piece.traverse((o) => {
    const m = o as TroisType.Mesh;
    m.geometry?.dispose();
    const mat = m.material as TroisType.Material | TroisType.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });

  // --- Logo réel, extrusion faible, biseau doux -----------------------------
  const logo = new T.Group();
  const materiauxLogo: TroisType.Material[] = [];
  const donnees = new SVGLoader().parse(source);
  for (const chemin of donnees.paths) {
    const couleur = String((chemin.userData as { style?: { fill?: string } } | undefined)?.style?.fill ?? "#29282e");
    const formes = chemin.toShapes();
    const geometrie = new T.ExtrudeGeometry(formes, {
      depth: 90,
      bevelEnabled: true,
      bevelThickness: 18,
      bevelSize: 9,
      bevelSegments: 5,
      curveSegments: 14,
    });
    const rose = couleur.toLowerCase() !== "#29282e";
    // Face avant : exactement la couleur du logo officiel (#29282e, point
    // #c37a94), sans éclairage ni reflet qui la griserait — c'est la face
    // qu'on lit. Biseau et flancs : éclairés, à peine plus clairs, pour le
    // relief et un contour net, sans arête noire.
    const face = new T.MeshBasicMaterial({ color: new T.Color(couleur), toneMapped: false, transparent: true });
    const flanc = new T.MeshPhysicalMaterial({
      color: new T.Color(couleur).offsetHSL(0, 0, rose ? 0.05 : 0.1),
      roughness: rose ? 0.3 : 0.38,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      envMapIntensity: rose ? 0.9 : 0.75,
      transparent: true,
    });
    materiauxLogo.push(face, flanc);
    aLiberer.push(geometrie, face, flanc);
    logo.add(new T.Mesh(geometrie, [face, flanc]));
  }
  const boite = new T.Box3().setFromObject(logo);
  const centre = boite.getCenter(new T.Vector3());
  const taille = boite.getSize(new T.Vector3());
  // Le biseau élargit la boîte : le calage se fait sur la largeur d'encre.
  const echelle = 6 / taille.x;
  const largeurEncre = (6 * ENCRE_LOGO) / taille.x;
  logo.children.forEach((m) => m.position.sub(centre));
  const pivot = new T.Group();
  pivot.add(logo);
  pivot.scale.set(echelle, -echelle, echelle);
  pivot.visible = options.sansLogo !== true;
  scene.add(pivot);

  // --- Ruban : satin plat et fin, derrière le logo ---------------------------
  const geometrieR = geometrieRuban(T, {
    chemin: CHEMIN_INTRO,
    largeur: 0.5,
    epaisseur: 0.032,
    torsion: 1.05,
    segments: 360,
    tour: 36,
    clair: 0xfadbe6,
    soutenu: 0xe28aab,
  });
  const materiauR = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    sheen: 0.8,
    sheenRoughness: 0.4,
    sheenColor: new T.Color(0xffffff),
    envMapIntensity: 0.9,
    side: T.DoubleSide,
    transparent: true,
  });
  aLiberer.push(geometrieR, materiauR);
  const ruban = new T.Mesh(geometrieR, materiauR);
  ruban.rotation.set(0.32, -0.18, -0.06);
  const porteRuban = new T.Group();
  porteRuban.add(ruban);
  scene.add(porteRuban);
  // Boîte du ruban une fois tourné, à l'échelle 1 : sert au calage sur l'image fixe.
  ruban.updateMatrixWorld(true);
  const boiteRuban = new T.Box3().setFromObject(ruban);
  const tailleRuban = boiteRuban.getSize(new T.Vector3());
  const centreRuban = boiteRuban.getCenter(new T.Vector3());

  // Lumière diffuse dominante, remplissage doux : pas de noirs bouchés.
  scene.add(new T.HemisphereLight(0xffffff, 0xf3d6e0, 1.25));
  const principale = new T.DirectionalLight(0xffffff, 1.35);
  principale.position.set(-3, 5, 9);
  scene.add(principale);
  const remplissage = new T.DirectionalLight(0xffeef4, 0.6);
  remplissage.position.set(6, -2, 6);
  scene.add(remplissage);

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 120);
  camera.position.set(0, 0, RECUL);
  camera.lookAt(0, 0, 0);
  const toile = rendu.domElement;
  toile.setAttribute("aria-hidden", "true");
  toile.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  hote.append(toile);

  let p = 0;
  let image = 0;
  let visible = true;
  let detruite = false;
  let premiere = false;
  // Calage mesuré (pixels CSS, relatifs à la toile).
  let largeur = 1;
  let hauteur = 1;
  let pxu = 1; // pixels par unité dans le plan du logo
  const depart = { x: 0, y: 0, echelle: 1 };

  const caler = () => {
    const h = hote.getBoundingClientRect();
    const l = options.logo.getBoundingClientRect();
    const a = options.ruban.getBoundingClientRect();
    largeur = h.width;
    hauteur = h.height;
    if (!largeur || !hauteur || !l.width) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(PIXELS_MAX / (largeur * hauteur)));
    rendu.setPixelRatio(Math.max(1, ratio));
    rendu.setSize(largeur, hauteur, false);

    pxu = l.width / largeurEncre;
    camera.aspect = largeur / hauteur;
    camera.fov = (2 * Math.atan(hauteur / pxu / 2 / RECUL) * 180) / Math.PI;
    // Le centre optique tombe sur le centre du logo HTML.
    const cx = l.left + l.width / 2 - h.left;
    const cy = l.top + l.height / 2 - h.top;
    camera.setViewOffset(largeur, hauteur, largeur / 2 - cx, hauteur / 2 - cy, largeur, hauteur);
    camera.updateProjectionMatrix();

    // Ruban : remplit le cadre de l'image fixe, derrière le plan du logo.
    const pxuR = (pxu * RECUL) / (RECUL + PROFONDEUR_RUBAN);
    const utile = 1 - 2 * MARGE_RUBAN;
    const k = Math.min((a.width * utile) / (tailleRuban.x * pxuR), (a.height * utile) / (tailleRuban.y * pxuR));
    depart.echelle = k;
    depart.x = (a.left + a.width / 2 - (l.left + l.width / 2)) / pxuR - centreRuban.x * k;
    depart.y = -(a.top + a.height / 2 - (l.top + l.height / 2)) / pxuR - centreRuban.y * k;
    return true;
  };

  const poser = () => {
    // 0,16–0,36 : le logo se retire et devient transparent, sans traverser le texte.
    const retrait = lisse(0.16, 0.36, p);
    pivot.position.z = -1.2 * retrait;
    pivot.rotation.y = 0.32 * retrait;
    const s = echelle * (1 - 0.1 * retrait);
    pivot.scale.set(s, -s, s);
    materiauxLogo.forEach((m) => {
      m.opacity = 1 - retrait;
      m.depthWrite = retrait < 0.98;
    });
    pivot.visible = options.sansLogo !== true && retrait < 0.999;

    // 0,16–0,6 : le ruban s'éloigne vers le bord haut droit ; 0,7–1 : il sort.
    const derive = lisse(0.16, 0.6, p);
    const sortie = lisse(0.7, 0.98, p);
    const k = depart.echelle * (1 + 0.22 * derive);
    ruban.scale.setScalar(k);
    porteRuban.position.set(
      depart.x + ((largeur * (0.36 * derive + 0.3 * sortie)) / pxu),
      depart.y + ((hauteur * (0.3 * derive + 0.32 * sortie)) / pxu),
      -PROFONDEUR_RUBAN - 0.6 * derive,
    );
    porteRuban.rotation.set(-0.08 * derive, 0.22 * derive, 0.3 * derive + 0.15 * sortie);
    materiauR.opacity = 1 - 0.9 * sortie;
    ruban.visible = materiauR.opacity > 0.02;
  };

  const dessiner = () => {
    image = 0;
    if (detruite || !visible || document.hidden) return;
    poser();
    rendu.render(scene, camera);
    if (!premiere) {
      premiere = true;
      options.premiereImage();
    }
  };
  const demander = () => {
    if (image === 0 && !detruite) image = requestAnimationFrame(dessiner);
  };
  const redimensionner = () => {
    if (detruite) return;
    if (caler()) demander();
  };

  const observateurTaille = new ResizeObserver(redimensionner);
  observateurTaille.observe(hote);
  observateurTaille.observe(options.logo);
  const observateurVue = new IntersectionObserver(([e]) => {
    visible = e?.isIntersecting ?? true;
    demander();
  });
  observateurVue.observe(hote);
  const auChangementOnglet = () => demander();
  document.addEventListener("visibilitychange", auChangementOnglet);
  const perte = (e: Event) => {
    e.preventDefault();
    detruire();
    options.abandon();
  };
  toile.addEventListener("webglcontextlost", perte);

  function detruire() {
    if (detruite) return;
    detruite = true;
    if (image) cancelAnimationFrame(image);
    observateurTaille.disconnect();
    observateurVue.disconnect();
    document.removeEventListener("visibilitychange", auChangementOnglet);
    toile.removeEventListener("webglcontextlost", perte);
    aLiberer.forEach((x) => x.dispose());
    rendu.dispose();
    rendu.forceContextLoss();
    toile.remove();
  }

  redimensionner();
  return {
    progression: (valeur) => {
      p = Math.min(1, Math.max(0, valeur));
      demander();
    },
    detruire,
  };
}

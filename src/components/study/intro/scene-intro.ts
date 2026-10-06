/**
 * Scène de l'introduction de la landing — chargée à la demande.
 *
 * Le logo est le **vrai** logo : ses contours sont extraits de la police du
 * site (Manrope 800, approche -0,06 em) dans `public/visuels/logo-study.svg`,
 * puis extrudés ici. Aucun logo redessiné ni récupéré d'une capture. Le
 * ruban est la géométrie du ruban Study (`ruban/scene.ts`).
 *
 * Rendu à la demande : une image par changement de progression (défilement)
 * ou de taille, jamais en boucle. Arrêt hors écran et onglet masqué ;
 * perte de contexte : abandon et retour à l'image fixe. Démontage complet.
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
const melange = (a: number, b: number, t: number) => a + (b - a) * t;

export async function monterIntro(hote: HTMLElement, options: { mobile: boolean; abandon: () => void; logicielAccepte?: boolean; sansLogo?: boolean }): Promise<SceneIntro | null> {
  const T = await import("three");
  const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const source = await fetch("/visuels/logo-study.svg").then((r) => (r.ok ? r.text() : null)).catch(() => null);
  if (source === null) return null;

  let rendu: TroisType.WebGLRenderer;
  try {
    rendu = new T.WebGLRenderer({ alpha: true, antialias: !options.mobile, powerPreference: "low-power", failIfMajorPerformanceCaveat: options.logicielAccepte !== true });
  } catch {
    return null;
  }
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.mobile ? 1.25 : 1.75));
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = T.SRGBColorSpace;
  rendu.toneMapping = T.NeutralToneMapping;
  rendu.toneMappingExposure = 0.95;

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

  // --- Logo réel extrudé -----------------------------------------------------
  const logo = new T.Group();
  const donnees = new SVGLoader().parse(source);
  for (const chemin of donnees.paths) {
    const couleur = String((chemin.userData as { style?: { fill?: string } } | undefined)?.style?.fill ?? "#29282e");
    const formes = SVGLoader.createShapes(chemin);
    const geometrie = new T.ExtrudeGeometry(formes, {
      depth: 260,
      bevelEnabled: true,
      bevelThickness: 40,
      bevelSize: 22,
      bevelSegments: options.mobile ? 2 : 3,
      curveSegments: options.mobile ? 6 : 10,
    });
    const rose = couleur.toLowerCase() !== "#29282e";
    const materiau = new T.MeshPhysicalMaterial({
      color: new T.Color(couleur),
      roughness: rose ? 0.24 : 0.55,
      metalness: 0,
      clearcoat: rose ? 1 : 0.35,
      clearcoatRoughness: 0.2,
      envMapIntensity: rose ? 0.8 : 0.18,
    });
    aLiberer.push(geometrie, materiau);
    logo.add(new T.Mesh(geometrie, materiau));
  }
  // Le SVG est déjà retourné (scale(1,-1)) : SVGLoader rend y vers le bas, on
  // le redresse, on centre et on met à l'échelle (≈ 6 unités de large).
  const boite = new T.Box3().setFromObject(logo);
  const centre = boite.getCenter(new T.Vector3());
  const taille = boite.getSize(new T.Vector3());
  const echelle = 6 / taille.x;
  logo.children.forEach((m) => m.position.sub(centre));
  const pivot = new T.Group();
  pivot.add(logo);
  pivot.scale.set(echelle, -echelle, echelle);
  pivot.visible = options.sansLogo !== true;
  scene.add(pivot);

  // --- Ruban : une grande boucle derrière le logo, que la caméra traverse ----
  const geometrieR = geometrieRuban(T);
  const materiauR = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.25,
    sheenColor: new T.Color(0xffe4ee),
    envMapIntensity: 0.7,
    side: T.DoubleSide,
  });
  aLiberer.push(geometrieR, materiauR);
  const ruban = new T.Mesh(geometrieR, materiauR);
  ruban.scale.setScalar(2.4);
  ruban.position.set(0.4, -0.4, -4);
  ruban.rotation.set(0.15, 0.2, -0.1);
  scene.add(ruban);

  scene.add(new T.HemisphereLight(0xfff8fa, 0xb06a86, 1.1));
  const principale = new T.DirectionalLight(0xffffff, 1.8);
  principale.position.set(4, 6, 8);
  scene.add(principale);

  const camera = new T.PerspectiveCamera(options.mobile ? 50 : 38, 1, 0.1, 60);
  const toile = rendu.domElement;
  toile.setAttribute("aria-hidden", "true");
  toile.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  hote.append(toile);

  let p = 0;
  let image = 0;
  let visible = true;
  let detruite = false;
  const recul = options.mobile ? 16 : 12;

  const poser = () => {
    // 0–25 % : le logo plein écran. 25–65 % : approche, puis traversée de la
    // boucle. 65–100 % : la caméra se pose, le ruban s'éloigne.
    const approche = lisse(0.2, 0.65, p);
    const pose = lisse(0.65, 1, p);
    camera.position.set(melange(0, 0.5, approche), melange(-0.9, -0.8, approche), melange(recul, -7, approche) - pose * 1.5);
    camera.lookAt(melange(0, 0.4, approche), melange(-0.9, -0.9, approche), melange(0, -12, approche));
    pivot.rotation.y = melange(-0.12, 0.35, approche);
    pivot.position.y = melange(0, 1.4, approche);
    ruban.rotation.z = -0.1 + p * 0.6;
  };

  const dessiner = () => {
    image = 0;
    if (detruite || !visible || document.hidden) return;
    poser();
    rendu.render(scene, camera);
  };
  const demander = () => {
    if (image === 0 && !detruite) image = requestAnimationFrame(dessiner);
  };
  const redimensionner = () => {
    const l = hote.clientWidth;
    const h = hote.clientHeight;
    if (!l || !h || detruite) return;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    demander();
  };

  const observateurTaille = new ResizeObserver(redimensionner);
  observateurTaille.observe(hote);
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

/**
 * Scène WebGL du ruban Study — chargée à la demande, jamais rendue côté serveur.
 *
 * Ce module n'est importé que par `import()` depuis `RubanStudy` : Three.js
 * ne part donc dans aucun paquet de page. Une seule scène vit à la fois
 * (`active`) ; la suivante remplace la précédente, qui retombe sur son image.
 *
 * Ce que la scène garantit :
 * - pixel ratio plafonné (1,5 ; 1 sur petit écran) ;
 * - rendu seulement quand quelque chose bouge : mouvement autonome limité à
 *   `DUREE_AUTONOME_MS`, puis repos ; réaction au pointeur sur ordinateur ;
 * - pause hors écran, onglet masqué, et sur demande ;
 * - perte de contexte : la scène se démonte et l'image fixe reprend ;
 * - démontage : boucle, observateurs et écouteurs retirés, toile détachée ;
 *   rendu partagé libéré (géométrie, matériau, environnement, contexte) après
 *   LIBERATION_MS sans aucune page qui l'affiche.
 */

import type * as TroisType from "three";

export type Composition = "grande" | "petite" | "fragment";

export interface OptionsScene {
  readonly composition: Composition;
  /** Mouvement autonome et réaction au pointeur autorisés. */
  readonly mouvement: boolean;
  /** Appelé quand la scène renonce (perte de contexte, erreur). */
  readonly abandon: () => void;
  /** Rendu logiciel accepté (captures de recette uniquement). */
  readonly logicielAccepte?: boolean;
}

export interface Scene {
  readonly pause: (enPause: boolean) => void;
  readonly detruire: () => void;
}

const DUREE_AUTONOME_MS = 14_000;

let active: { detruire: () => void } | null = null;

/** Délai avant de libérer le rendu partagé quand plus aucune page ne l’affiche. */
const LIBERATION_MS = 20_000;

/** Points de passage : une boucle ouverte, lisible comme un chemin. */
const CHEMIN: readonly [number, number, number][] = [
  [-2.6, -1.25, 0.1],
  [-1.55, -1.05, 0.55],
  [-0.35, -0.85, 0.45],
  [0.85, -0.35, 0.05],
  [1.25, 0.55, -0.35],
  [0.7, 1.25, -0.45],
  [-0.25, 1.2, -0.1],
  [-0.75, 0.5, 0.35],
  [-0.35, -0.2, 0.6],
  [0.75, -0.3, 0.45],
  [1.85, 0.15, 0.1],
  [2.65, 0.85, -0.25],
];

const CADRAGES: Record<Composition, { camera: [number, number, number]; fov: number; rotation: [number, number, number]; echelle: number }> = {
  grande: { camera: [0, 0, 8.4], fov: 34, rotation: [0.55, -0.5, -0.18], echelle: 1.02 },
  petite: { camera: [0, 0, 8.6], fov: 34, rotation: [0.62, -0.35, -0.28], echelle: 1.02 },
  fragment: { camera: [0, 0, 8.2], fov: 36, rotation: [0.45, -0.7, -0.35], echelle: 1.05 },
};

function geometrieRuban(T: typeof TroisType): TroisType.BufferGeometry {
  const courbe = new T.CatmullRomCurve3(
    CHEMIN.map(([x, y, z]) => new T.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const segments = 260;
  const tour = 28;
  const reperes = courbe.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const couleurs: number[] = [];
  // Nacre : du rose presque blanc au rose framboise doux, le long du ruban.
  const clair = new T.Color(0xf6cbda);
  const soutenu = new T.Color(0xc4628a);
  const teinte = new T.Color();
  const indices: number[] = [];
  const largeur = 0.4;
  const epaisseur = 0.13;
  const lisse = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const p = new T.Vector3();
  const n = new T.Vector3();
  const b = new T.Vector3();
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    courbe.getPointAt(t, p);
    // Extrémités affinées : le ruban naît et s'efface, sans bord coupé net.
    const fuseau = 0.18 + 0.82 * lisse(0, 0.12, t) * lisse(1, 0.88, t);
    const torsion = Math.PI * 0.95 * t + 0.35 * Math.sin(t * Math.PI * 2);
    const c = Math.cos(torsion);
    const s = Math.sin(torsion);
    const N = reperes.normals[i]!;
    const B = reperes.binormals[i]!;
    n.copy(N).multiplyScalar(c).addScaledVector(B, s);
    b.copy(B).multiplyScalar(c).addScaledVector(N, -s);
    for (let j = 0; j < tour; j += 1) {
      const a = (j / tour) * Math.PI * 2;
      const x = Math.cos(a) * largeur * fuseau;
      const y = Math.sin(a) * epaisseur * (0.6 + 0.4 * fuseau);
      positions.push(p.x + n.x * x + b.x * y, p.y + n.y * x + b.y * y, p.z + n.z * x + b.z * y);
      teinte.copy(clair).lerp(soutenu, 0.5 + 0.5 * Math.sin(t * Math.PI * 3.2 + 0.6) * 0.9);
      couleurs.push(teinte.r, teinte.g, teinte.b);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < tour; j += 1) {
      const a = i * tour + j;
      const bb = i * tour + ((j + 1) % tour);
      const c = (i + 1) * tour + j;
      const d = (i + 1) * tour + ((j + 1) % tour);
      indices.push(a, c, bb, bb, c, d);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(couleurs, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.center();
  return g;
}

/**
 * Rendu partagé. Un seul contexte WebGL pour toute la visite : la toile est
 * rattachée à la page qui affiche le ruban et détachée quand elle s'en va.
 * Recréer un contexte à chaque navigation en accumulait (les navigateurs en
 * limitent le nombre) et laissait de la mémoire retenue par Three.js ; la
 * recette (32 allers-retours) l'a montré. Le tout est libéré `LIBERATION_MS`
 * après le dernier démontage, ou aussitôt en cas de perte de contexte.
 */
interface Partage {
  readonly rendu: TroisType.WebGLRenderer;
  readonly scene: TroisType.Scene;
  readonly camera: TroisType.PerspectiveCamera;
  readonly ruban: TroisType.Mesh;
  readonly liberer: () => void;
}

let partage: Partage | null = null;
let minuteurLiberation = 0;

async function obtenirPartage(logicielAccepte: boolean): Promise<Partage | null> {
  if (partage) return partage;
  const T = await import("three");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  if (partage) return partage;

  let rendu: TroisType.WebGLRenderer;
  try {
    rendu = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      // Un rendu logiciel ferait chauffer un appareil pour un décor : on
      // préfère l'image fixe.
      failIfMajorPerformanceCaveat: !logicielAccepte,
    });
  } catch {
    return null;
  }

  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = T.SRGBColorSpace;
  rendu.toneMapping = T.NeutralToneMapping;
  rendu.toneMappingExposure = 0.9;

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(rendu);
  const piece = new RoomEnvironment();
  const environnement = pmrem.fromScene(piece, 0.04).texture;
  scene.environment = environnement;
  // La pièce ne sert qu'à calculer l'environnement : libérée tout de suite.
  pmrem.dispose();
  piece.traverse((o) => {
    const m = o as TroisType.Mesh;
    m.geometry?.dispose();
    const mat = m.material as TroisType.Material | TroisType.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });

  const camera = new T.PerspectiveCamera(34, 1, 0.1, 40);
  const geometrie = geometrieRuban(T);
  const materiau = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.26,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.25,
    sheenColor: new T.Color(0xffe4ee),
    sheenRoughness: 0.45,
    envMapIntensity: 0.7,
    side: T.DoubleSide,
  });
  const ruban = new T.Mesh(geometrie, materiau);
  scene.add(ruban);

  const ciel = new T.HemisphereLight(0xfff8fa, 0xb06a86, 1.2);
  const principale = new T.DirectionalLight(0xffffff, 1.6);
  principale.position.set(3, 4, 5);
  const contre = new T.DirectionalLight(0xffd6e4, 1.1);
  contre.position.set(-4, 1, -3);
  scene.add(ciel, principale, contre);

  const toile = rendu.domElement;
  toile.setAttribute("aria-hidden", "true");
  toile.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";

  const liberer = () => {
    window.clearTimeout(minuteurLiberation);
    geometrie.dispose();
    materiau.dispose();
    environnement.dispose();
    rendu.dispose();
    rendu.forceContextLoss();
    toile.remove();
    if (partage?.rendu === rendu) partage = null;
  };

  partage = { rendu, scene, camera, ruban, liberer };
  return partage;
}

export async function monterScene(hote: HTMLElement, options: OptionsScene): Promise<Scene | null> {
  active?.detruire();
  window.clearTimeout(minuteurLiberation);

  const p = await obtenirPartage(options.logicielAccepte === true);
  if (p === null) return null;
  const { rendu, scene, camera, ruban } = p;

  const cadrage = CADRAGES[options.composition];
  camera.fov = cadrage.fov;
  camera.position.set(...cadrage.camera);
  ruban.rotation.set(...cadrage.rotation);
  ruban.scale.setScalar(cadrage.echelle);

  const petitEcran = window.matchMedia("(max-width: 767px)").matches;
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, petitEcran ? 1 : 1.5));
  const toile = rendu.domElement;
  hote.append(toile);

  let image = 0;
  let enPause = !options.mouvement;
  let visible = true;
  let detruite = false;
  const debut = performance.now();
  const base = { x: cadrage.rotation[0], y: cadrage.rotation[1] };
  const cible = { x: 0, y: 0 };
  const actuel = { x: 0, y: 0 };

  const dessiner = () => rendu.render(scene, camera);

  const boucle = (maintenant: number) => {
    image = 0;
    if (detruite || enPause || !visible || document.hidden) return;
    const ecoule = maintenant - debut;
    // Mouvement autonome : lent, et seulement pendant les premières secondes.
    const autonome = ecoule < DUREE_AUTONOME_MS ? Math.sin((ecoule / 1000) * 0.55) * 0.09 * (1 - ecoule / DUREE_AUTONOME_MS) : 0;
    actuel.x += (cible.x - actuel.x) * 0.06;
    actuel.y += (cible.y - actuel.y) * 0.06;
    ruban.rotation.x = base.x + actuel.x;
    ruban.rotation.y = base.y + actuel.y + autonome;
    dessiner();
    const auRepos = ecoule >= DUREE_AUTONOME_MS && Math.abs(cible.x - actuel.x) < 0.0005 && Math.abs(cible.y - actuel.y) < 0.0005;
    if (!auRepos) image = requestAnimationFrame(boucle);
  };

  const relancer = () => {
    if (image === 0 && !enPause && visible && !document.hidden && !detruite) image = requestAnimationFrame(boucle);
  };

  const redimensionner = () => {
    const l = hote.clientWidth;
    const h = hote.clientHeight;
    if (l === 0 || h === 0 || detruite) return;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    dessiner();
  };

  // Réaction au pointeur : ordinateur seulement, amplitude très faible.
  const pointeurFin = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const auPointeur = (e: PointerEvent) => {
    if (enPause) return;
    cible.y = ((e.clientX / window.innerWidth) * 2 - 1) * 0.1;
    cible.x = ((e.clientY / window.innerHeight) * 2 - 1) * 0.06;
    relancer();
  };

  const observateurTaille = new ResizeObserver(redimensionner);
  observateurTaille.observe(hote);
  const observateurVue = new IntersectionObserver(([entree]) => {
    visible = entree?.isIntersecting ?? true;
    relancer();
  });
  observateurVue.observe(hote);
  const auChangementOnglet = () => relancer();
  document.addEventListener("visibilitychange", auChangementOnglet);
  if (pointeurFin && options.mouvement) window.addEventListener("pointermove", auPointeur, { passive: true });

  const perteContexte = (e: Event) => {
    e.preventDefault();
    detruire();
    p.liberer();
    options.abandon();
  };
  toile.addEventListener("webglcontextlost", perteContexte);

  function detruire() {
    if (detruite) return;
    detruite = true;
    if (image) cancelAnimationFrame(image);
    observateurTaille.disconnect();
    observateurVue.disconnect();
    document.removeEventListener("visibilitychange", auChangementOnglet);
    window.removeEventListener("pointermove", auPointeur);
    toile.removeEventListener("webglcontextlost", perteContexte);
    if (toile.parentElement === hote) toile.remove();
    if (active === instance) active = null;
    // Plus aucune page n'affiche le ruban : libération différée, annulée si
    // une autre page le remonte entre-temps.
    window.clearTimeout(minuteurLiberation);
    minuteurLiberation = window.setTimeout(() => {
      if (active === null) partage?.liberer();
    }, LIBERATION_MS);
  }

  const instance = { detruire };
  active = instance;

  redimensionner();
  relancer();

  return {
    pause: (valeur) => {
      enPause = valeur || !options.mouvement;
      if (enPause) {
        cible.x = 0;
        cible.y = 0;
      }
      relancer();
    },
    detruire,
  };
}

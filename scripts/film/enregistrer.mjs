// Enregistre le film AvecStudy (/apercu/film) image par image.
//
//   node scripts/film/enregistrer.mjs <base> <sortie.mp4|sortie.webm> [16x9|9x16] [ips] [debit]
//
// Sortie .mp4 : H.264 encodé par Edge (WebCodecs), assemblé en MP4 classique,
// avec la bande-son calculée par `musique.mjs` en AAC (SANS_MUSIQUE=1 pour
// un film muet).
// Sortie .webm : VP8 encodé par le ffmpeg installé par Playwright.
//
// L'horloge est fixée à chaque image : pas de saccade, quel que soit le temps
// que met une capture. Règle (voir film.module.css) : un élément marqué
// `data-debut` suit le temps du film ; ses descendants suivent le temps local
// de leur bloc le plus proche.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { encoderAac } from "./encodeur-aac.mjs";
import { ouvrirEncodeur } from "./encodeur-h264.mjs";
import { composer } from "./musique.mjs";

const [base = "http://localhost:3108", sortie = "avecstudy.mp4", format = "16x9", ipsTexte = "30", debitTexte = "2400000"] = process.argv.slice(2);
const ips = Number(ipsTexte);
const [largeur, hauteur] = format === "9x16" ? [1080, 1920] : [1920, 1080];
const enMp4 = sortie.toLowerCase().endsWith(".mp4");

function trouverFfmpeg() {
  const racine = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "ms-playwright");
  const dossiers = existsSync(racine) ? readdirSync(racine).filter((d) => d.startsWith("ffmpeg-")).sort().reverse() : [];
  for (const d of dossiers) {
    for (const nom of ["ffmpeg-win64.exe", "ffmpeg-linux", "ffmpeg-mac"]) {
      const chemin = join(racine, d, nom);
      if (existsSync(chemin)) return chemin;
    }
  }
  throw new Error("ffmpeg de Playwright introuvable (npx playwright install ffmpeg)");
}

/** La destination des images : l'encodeur H.264 d'Edge ou ffmpeg (VP8). */
async function ouvrirSortie(nav) {
  if (enMp4) {
    const encodeur = await ouvrirEncodeur(nav, { largeur, hauteur, ips, debit: Number(debitTexte) });
    return {
      ajouter: (image, i) => encodeur.ajouter(image, i),
      fermer: async (n, son) => writeFileSync(sortie, await encodeur.terminer(n, son)),
    };
  }
  const ffmpeg = spawn(
    trouverFfmpeg(),
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(ips), "-c:v", "mjpeg", "-i", "pipe:0",
     "-c:v", "libvpx", "-b:v", format === "9x16" ? "9M" : "10M", "-crf", "4", "-qmin", "0", "-qmax", "28",
     "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "0", "-pix_fmt", "yuv420p", sortie],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const fin = new Promise((ok, ko) => ffmpeg.on("close", (code) => (code === 0 ? ok() : ko(new Error(`ffmpeg a échoué (${code})`)))));
  return {
    ajouter: async (image) => {
      if (!ffmpeg.stdin.write(image)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    },
    fermer: async () => {
      ffmpeg.stdin.end();
      await fin;
    },
  };
}

const nav = await chromium.launch({ channel: "msedge" });
const page = await (await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${base}/apercu/film?format=${format}`, { waitUntil: "load", timeout: 180000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important} html,body{margin:0;overflow:hidden;background:#000}" });
await page.evaluate(() => document.fonts.ready);
const duree = await page.evaluate(() => Number(document.querySelector("[data-film-duree]")?.getAttribute("data-film-duree") ?? 0));
if (!duree) throw new Error("durée du film introuvable");
// Les scènes [début, durée] en millisecondes : la musique suit leurs coupes.
const scenes = await page.evaluate(() =>
  [...document.querySelectorAll("section[data-debut]")].map((s) => [Number(s.getAttribute("data-debut")), parseFloat(getComputedStyle(s).getPropertyValue("--duree"))]),
);

const images = Math.round((duree / 1000) * ips);
const destination = await ouvrirSortie(nav);
const scene = page.locator("[data-film-duree]");
const debut = Date.now();
for (let i = 0; i < images; i++) {
  const t = (i * 1000) / ips;
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      const cible = a.effect?.target;
      if (!(cible instanceof Element)) continue;
      const pseudo = a.effect.pseudoElement;
      const propre = !pseudo && cible.hasAttribute("data-debut");
      const bloc = propre ? null : cible.closest("[data-debut]");
      const local = propre ? t : t - Number(bloc?.getAttribute("data-debut") ?? 0);
      a.pause();
      a.currentTime = Math.max(0, local);
    }
  }, t);
  await destination.ajouter(await scene.screenshot({ type: "jpeg", quality: 92 }), i);
  if (i % ips === 0) process.stdout.write(`\r${Math.round((i / images) * 100)} %  (${Math.round((Date.now() - debut) / 1000)} s)`);
}
let son;
if (enMp4 && process.env.SANS_MUSIQUE !== "1") {
  process.stdout.write("\nbande-son…");
  son = await encoderAac(nav, composer({ duree: (images * 1000) / ips, scenes }));
}
await destination.fermer(images, son);
await nav.close();
console.log(`\n${sortie} : ${images} images, ${duree / 1000} s, ${largeur}×${hauteur}${son ? ", son AAC stéréo" : ", muet"}`);

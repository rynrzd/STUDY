// Enregistre le film AvecStudy (/apercu/film) image par image, puis l'encode
// en WebM (VP8) avec le ffmpeg installé par Playwright.
//
//   node scripts/film/enregistrer.mjs <base> <sortie.webm> [16x9|9x16] [ips]
//
// L'horloge est fixée à chaque image : pas de saccade, quel que soit le temps
// que met une capture. Règle (voir film.module.css) : un élément marqué
// `data-debut` suit le temps du film ; ses descendants suivent le temps local
// de leur bloc le plus proche.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [base = "http://localhost:3108", sortie = "avecstudy.webm", format = "16x9", ipsTexte = "30"] = process.argv.slice(2);
const ips = Number(ipsTexte);
const [largeur, hauteur] = format === "9x16" ? [1080, 1920] : [1920, 1080];

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

const nav = await chromium.launch({ channel: "msedge" });
const page = await (await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${base}/apercu/film?format=${format}`, { waitUntil: "load", timeout: 180000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important} html,body{margin:0;overflow:hidden;background:#000}" });
await page.evaluate(() => document.fonts.ready);
const duree = await page.evaluate(() => Number(document.querySelector("[data-film-duree]")?.getAttribute("data-film-duree") ?? 0));
if (!duree) throw new Error("durée du film introuvable");

const images = Math.round((duree / 1000) * ips);
const ffmpeg = spawn(
  trouverFfmpeg(),
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(ips), "-c:v", "mjpeg", "-i", "pipe:0",
   "-c:v", "libvpx", "-b:v", format === "9x16" ? "9M" : "10M", "-crf", "4", "-qmin", "0", "-qmax", "28",
   "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "0", "-pix_fmt", "yuv420p", sortie],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const fin = new Promise((ok, ko) => ffmpeg.on("close", (code) => (code === 0 ? ok() : ko(new Error(`ffmpeg a échoué (${code})`)))));

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
  const image = await scene.screenshot({ type: "jpeg", quality: 92 });
  if (!ffmpeg.stdin.write(image)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (i % ips === 0) process.stdout.write(`\r${Math.round((i / images) * 100)} %  (${Math.round((Date.now() - debut) / 1000)} s)`);
}
ffmpeg.stdin.end();
await fin;
await nav.close();
console.log(`\n${sortie} : ${images} images, ${duree / 1000} s, ${largeur}×${hauteur}`);

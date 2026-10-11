// Convertit une vidéo WebM en MP4 (H.264) avec l'enregistreur intégré d'Edge,
// le ffmpeg de Playwright ne sachant produire que du WebM.
//
//   node scripts/film/en-mp4.mjs <entree.webm> <sortie.mp4> [debit-en-bits/s]
//
// La vidéo est relue en temps réel par le navigateur et réenregistrée : à
// lancer sur une machine peu chargée, sans quoi des images peuvent sauter.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright-core";

const [entree, sortie, debitTexte = "2600000"] = process.argv.slice(2);
if (!entree || !sortie) throw new Error("usage : en-mp4.mjs <entree.webm> <sortie.mp4> [debit]");
const debit = Number(debitTexte);

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<video id="v" src="/video.webm" muted playsinline></video>
<script>
window.convertir = (debit) => new Promise((ok, ko) => {
  const v = document.getElementById("v");
  const flux = v.captureStream();
  const enregistreur = new MediaRecorder(flux, { mimeType: "video/mp4;codecs=avc1.640028", videoBitsPerSecond: debit });
  const morceaux = [];
  enregistreur.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
  enregistreur.onstop = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(morceaux, { type: "video/mp4" }));
    a.download = "film.mp4";
    document.body.append(a);
    a.click();
    ok(morceaux.length);
  };
  enregistreur.onerror = (e) => ko(String(e.error));
  v.onended = () => enregistreur.stop();
  enregistreur.start(1000);
  v.play().catch(ko);
});
</script>`;

// Petit serveur local : la page et la vidéo partagent la même origine.
const serveur = createServer((req, res) => {
  if (req.url === "/video.webm") {
    res.writeHead(200, { "content-type": "video/webm", "content-length": statSync(entree).size });
    createReadStream(entree).pipe(res);
  } else {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  }
}).listen(0);
const port = serveur.address().port;

const nav = await chromium.launch({ channel: "msedge", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await nav.newContext({ acceptDownloads: true })).newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => document.getElementById("v").readyState >= 3, null, { timeout: 60000 });
const telechargement = page.waitForEvent("download", { timeout: 10 * 60 * 1000 });
const debut = Date.now();
await page.evaluate((d) => window.convertir(d), debit);
await (await telechargement).saveAs(sortie);
await nav.close();
serveur.close();
console.log(`${sortie} écrit en ${Math.round((Date.now() - debut) / 1000)} s`);

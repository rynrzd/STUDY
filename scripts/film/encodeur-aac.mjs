// Encodeur AAC dans Edge (WebCodecs), hors temps réel, pour la bande-son
// calculée par `musique.mjs`. Rend la configuration (AudioSpecificConfig) et
// les trames AAC brutes, prêtes pour `mp4.mjs`. Comme pour la vidéo,
// WebCodecs exige un contexte sûr : la page est servie sur 127.0.0.1.
import { createServer } from "node:http";

const SECONDE = 1; // envoyée au navigateur par paquets d'une seconde

/** @param {{ frequence: number, canaux: Float32Array[] }} son */
export async function encoderAac(navigateur, { frequence, canaux }, debit = 192000) {
  const serveur = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>encodage AAC</title>");
  }).listen(0);
  const trames = [];
  let asc = null;
  const page = await navigateur.newPage();
  try {
    await page.exposeFunction("recevoirAudio", (base64, configuration) => {
      trames.push(Buffer.from(base64, "base64"));
      if (configuration) asc = Buffer.from(configuration, "base64");
    });
    await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
    await page.evaluate(
      ({ frequence, nombre, debit }) => {
        const enBase64 = (octets) => {
          let s = "";
          for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
          return btoa(s);
        };
        const envois = [];
        let erreur = null;
        const encodeur = new AudioEncoder({
          output: (morceau, meta) => {
            const octets = new Uint8Array(morceau.byteLength);
            morceau.copyTo(octets);
            const description = meta?.decoderConfig?.description;
            envois.push(window.recevoirAudio(enBase64(octets), description ? enBase64(new Uint8Array(description)) : null));
          },
          error: (e) => {
            erreur = e;
          },
        });
        encodeur.configure({ codec: "mp4a.40.2", sampleRate: frequence, numberOfChannels: nombre, bitrate: debit });
        window.ajouterAudio = async (base64, debut, images) => {
          if (erreur) throw erreur;
          const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const donnees = new AudioData({
            format: "f32-planar",
            sampleRate: frequence,
            numberOfFrames: images,
            numberOfChannels: nombre,
            timestamp: Math.round((debut * 1e6) / frequence),
            data: new Float32Array(octets.buffer),
          });
          encodeur.encode(donnees);
          donnees.close();
          while (encodeur.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
        };
        window.finirAudio = async () => {
          await encodeur.flush();
          await Promise.all(envois);
          if (erreur) throw erreur;
        };
      },
      { frequence, nombre: canaux.length, debit },
    );

    const pas = frequence * SECONDE;
    const total = canaux[0].length;
    for (let debut = 0; debut < total; debut += pas) {
      const images = Math.min(pas, total - debut);
      // Plan par plan : tout le canal gauche du paquet, puis tout le droit.
      const plan = Buffer.concat(canaux.map((c) => Buffer.from(c.slice(debut, debut + images).buffer)));
      await page.evaluate(([b, d, n]) => window.ajouterAudio(b, d, n), [plan.toString("base64"), debut, images]);
    }
    await page.evaluate(() => window.finirAudio());
  } finally {
    await page.close();
    serveur.close();
  }
  if (!asc) throw new Error("configuration AAC absente");
  return { frequence, canaux: canaux.length, debit, asc, trames };
}

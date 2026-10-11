// Encodeur H.264 dans Edge (WebCodecs), alimenté image par image depuis
// Node, hors temps réel : aucune image n'est perdue. Rend un MP4 classique
// assemblé par `mp4.mjs`. WebCodecs n'existe qu'en contexte sûr : la page
// d'encodage est servie sur 127.0.0.1.
import { createServer } from "node:http";
import { ecrireMp4 } from "./mp4.mjs";

export async function ouvrirEncodeur(navigateur, { largeur, hauteur, ips, debit }) {
  const serveur = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>encodage H.264</title>");
  }).listen(0);
  const echantillons = [];
  let avcC = null;
  const page = await navigateur.newPage();
  await page.exposeFunction("recevoir", (base64, cle, configuration) => {
    echantillons.push({ donnees: Buffer.from(base64, "base64"), cle });
    if (configuration) avcC = Buffer.from(configuration, "base64");
  });
  await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
  await page.evaluate(
    ({ largeur, hauteur, ips, debit }) => {
      const enBase64 = (octets) => {
        let s = "";
        for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
        return btoa(s);
      };
      const envois = [];
      let erreur = null;
      const encodeur = new VideoEncoder({
        output: (morceau, meta) => {
          const octets = new Uint8Array(morceau.byteLength);
          morceau.copyTo(octets);
          const description = meta?.decoderConfig?.description;
          envois.push(window.recevoir(enBase64(octets), morceau.type === "key", description ? enBase64(new Uint8Array(description)) : null));
        },
        error: (e) => {
          erreur = e;
        },
      });
      // Logiciel : pas d'images B, l'ordre de décodage est celui d'affichage.
      encodeur.configure({ codec: "avc1.640028", width: largeur, height: hauteur, bitrate: debit, framerate: ips, hardwareAcceleration: "prefer-software", latencyMode: "quality", avc: { format: "avc" } });
      window.ajouter = async (base64, i) => {
        if (erreur) throw erreur;
        const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(new Blob([octets], { type: "image/jpeg" }));
        const trame = new VideoFrame(image, { timestamp: Math.round((i * 1e6) / ips), duration: Math.round(1e6 / ips) });
        encodeur.encode(trame, { keyFrame: i % (ips * 2) === 0 });
        trame.close();
        image.close();
        while (encodeur.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      };
      window.finir = async () => {
        await encodeur.flush();
        await Promise.all(envois);
        if (erreur) throw erreur;
      };
    },
    { largeur, hauteur, ips, debit },
  );

  return {
    ajouter: (jpeg, i) => page.evaluate(([b, i]) => window.ajouter(b, i), [jpeg.toString("base64"), i]),
    async terminer(attendues) {
      await page.evaluate(() => window.finir());
      await page.close();
      serveur.close();
      if (!avcC) throw new Error("configuration H.264 absente");
      if (echantillons.length !== attendues) throw new Error(`${echantillons.length} images encodées sur ${attendues}`);
      return ecrireMp4({ largeur, hauteur, ips, avcC, echantillons });
    },
  };
}

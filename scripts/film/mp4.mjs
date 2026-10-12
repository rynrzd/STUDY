// Écrit un MP4 classique (moov en tête) à partir d'images déjà encodées : la
// configuration avcC et les échantillons au format « avc » (NAL préfixées par
// leur longueur), dans l'ordre. En option, une piste son AAC (trames brutes de
// 1 024 échantillons et leur AudioSpecificConfig) : les données vidéo puis les
// données son se suivent dans mdat, un bloc par piste.

function boite(type, ...corps) {
  const contenu = Buffer.concat(corps);
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(8 + contenu.length);
  entete.write(type, 4, "latin1");
  return Buffer.concat([entete, contenu]);
}
const u8 = (...n) => Buffer.from(n);
const u16 = (...n) => {
  const b = Buffer.alloc(2 * n.length);
  n.forEach((v, i) => b.writeUInt16BE(v & 0xffff, 2 * i));
  return b;
};
const u32 = (...n) => {
  const b = Buffer.alloc(4 * n.length);
  n.forEach((v, i) => b.writeUInt32BE(v >>> 0, 4 * i));
  return b;
};
const zeros = (n) => Buffer.alloc(n);
const pleine = (version, drapeaux, ...corps) => Buffer.concat([u32(((version & 0xff) << 24) | drapeaux), ...corps]);
const MATRICE = u32(0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000);

/** Descripteur MPEG-4 (esds) : étiquette, longueur sur un octet, contenu. */
const descripteur = (etiquette, ...corps) => {
  const contenu = Buffer.concat(corps);
  if (contenu.length > 127) throw new Error("descripteur trop long");
  return Buffer.concat([u8(etiquette, contenu.length), contenu]);
};
const AAC_IMAGES = 1024; // échantillons par trame AAC-LC

/** La piste son : trak complet, données placées à `debutDonnees`. */
function pisteSon({ frequence, canaux, debit, asc, trames }, debutDonnees, dureeFilm) {
  const n = trames.length;
  const dureeMedia = n * AAC_IMAGES;
  const plusGrande = Math.max(...trames.map((t) => t.length));
  const esds = boite(
    "esds",
    pleine(
      0,
      0,
      descripteur(
        0x03,
        u16(2), u8(0), // ES_ID, drapeaux
        descripteur(0x04, u8(0x40, 0x15), Buffer.from([0, (plusGrande >> 8) & 0xff, plusGrande & 0xff]), u32(debit, debit), descripteur(0x05, asc)),
        descripteur(0x06, u8(0x02)),
      ),
    ),
  );
  const mp4a = boite("mp4a", zeros(6), u16(1), zeros(8), u16(canaux, 16, 0, 0), u32(frequence * 65536), esds);
  return boite(
    "trak",
    boite("tkhd", pleine(0, 3, u32(0, 0, 2, 0, dureeFilm), zeros(8), u16(0, 1, 0x0100, 0), MATRICE, u32(0, 0))),
    boite(
      "mdia",
      boite("mdhd", pleine(0, 0, u32(0, 0, frequence, dureeMedia), u16(0x55c4, 0))),
      boite("hdlr", pleine(0, 0, u32(0), Buffer.from("soun", "latin1"), zeros(12), Buffer.from("SoundHandler\0", "latin1"))),
      boite(
        "minf",
        boite("smhd", pleine(0, 0, u16(0, 0))),
        boite("dinf", boite("dref", pleine(0, 0, u32(1), boite("url ", pleine(0, 1))))),
        boite(
          "stbl",
          boite("stsd", pleine(0, 0, u32(1), mp4a)),
          boite("stts", pleine(0, 0, u32(1), u32(n, AAC_IMAGES))),
          boite("stsc", pleine(0, 0, u32(1), u32(1, n, 1))),
          boite("stsz", pleine(0, 0, u32(0, n), u32(...trames.map((t) => t.length)))),
          boite("stco", pleine(0, 0, u32(1), u32(debutDonnees))),
        ),
      ),
    ),
  );
}

/**
 * @param {{ largeur: number, hauteur: number, ips: number, avcC: Buffer,
 *           echantillons: { donnees: Buffer, cle: boolean }[],
 *           son?: { frequence: number, canaux: number, debit: number, asc: Buffer, trames: Buffer[] } }} film
 */
export function ecrireMp4({ largeur, hauteur, ips, avcC, echantillons, son }) {
  const echelle = ips * 1000;
  const dureeImage = 1000;
  const n = echantillons.length;
  const dureeMedia = n * dureeImage;
  const dureeVideo = Math.round((dureeMedia / echelle) * 1000);
  const dureeSon = son ? Math.round(((son.trames.length * AAC_IMAGES) / son.frequence) * 1000) : 0;
  const dureeFilm = Math.max(dureeVideo, dureeSon);
  const donnees = Buffer.concat(echantillons.map((e) => e.donnees));
  const cles = echantillons.map((e, i) => (e.cle ? i + 1 : 0)).filter(Boolean);

  const avc1 = boite(
    "avc1",
    zeros(6), u16(1), // réservé, index de référence
    zeros(16), // pré-définis et réservés
    u16(largeur, hauteur),
    u32(0x00480000, 0x00480000), // 72 dpi
    zeros(4), u16(1), // réservé, une image par échantillon
    Buffer.concat([u8(9), Buffer.from("AvecStudy", "latin1"), zeros(22)]), // nom du compresseur (32 octets)
    u16(0x0018, 0xffff),
    boite("avcC", avcC),
  );

  const stbl = (debutDonnees) =>
    boite(
      "stbl",
      boite("stsd", pleine(0, 0, u32(1), avc1)),
      boite("stts", pleine(0, 0, u32(1), u32(n, dureeImage))),
      boite("stss", pleine(0, 0, u32(cles.length), u32(...cles))),
      boite("stsc", pleine(0, 0, u32(1), u32(1, n, 1))),
      boite("stsz", pleine(0, 0, u32(0, n), u32(...echantillons.map((e) => e.donnees.length)))),
      boite("stco", pleine(0, 0, u32(1), u32(debutDonnees))),
    );

  const moov = (debutDonnees) =>
    boite(
      "moov",
      boite("mvhd", pleine(0, 0, u32(0, 0, 1000, dureeFilm, 0x00010000), u16(0x0100), zeros(10), MATRICE, zeros(24), u32(son ? 3 : 2))),
      boite(
        "trak",
        boite("tkhd", pleine(0, 3, u32(0, 0, 1, 0, dureeVideo), zeros(8), u16(0, 0, 0, 0), MATRICE, u32(largeur << 16, hauteur << 16))),
        boite(
          "mdia",
          boite("mdhd", pleine(0, 0, u32(0, 0, echelle, dureeMedia), u16(0x55c4, 0))),
          boite("hdlr", pleine(0, 0, u32(0), Buffer.from("vide", "latin1"), zeros(12), Buffer.from("VideoHandler\0", "latin1"))),
          boite(
            "minf",
            boite("vmhd", pleine(0, 1, u16(0, 0, 0, 0))),
            boite("dinf", boite("dref", pleine(0, 0, u32(1), boite("url ", pleine(0, 1))))),
            stbl(debutDonnees),
          ),
        ),
      ),
      ...(son ? [pisteSon(son, debutDonnees + donnees.length, dureeSon)] : []),
    );

  const ftyp = boite("ftyp", Buffer.from("isom", "latin1"), u32(0x200), Buffer.from("isomiso2avc1mp41", "latin1"));
  const debutDonnees = ftyp.length + moov(0).length + 8;
  const donneesSon = son ? Buffer.concat(son.trames) : Buffer.alloc(0);
  return Buffer.concat([ftyp, moov(debutDonnees), u32(8 + donnees.length + donneesSon.length), Buffer.from("mdat", "latin1"), donnees, donneesSon]);
}

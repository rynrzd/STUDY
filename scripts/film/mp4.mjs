// Écrit un MP4 classique (une piste vidéo H.264, moov en tête) à partir
// d'images déjà encodées : la configuration avcC et les échantillons au
// format « avc » (NAL préfixées par leur longueur), dans l'ordre.

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

/**
 * @param {{ largeur: number, hauteur: number, ips: number, avcC: Buffer,
 *           echantillons: { donnees: Buffer, cle: boolean }[] }} film
 */
export function ecrireMp4({ largeur, hauteur, ips, avcC, echantillons }) {
  const echelle = ips * 1000;
  const dureeImage = 1000;
  const n = echantillons.length;
  const dureeMedia = n * dureeImage;
  const dureeFilm = Math.round((dureeMedia / echelle) * 1000);
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
      boite("mvhd", pleine(0, 0, u32(0, 0, 1000, dureeFilm, 0x00010000), u16(0x0100), zeros(10), MATRICE, zeros(24), u32(2))),
      boite(
        "trak",
        boite("tkhd", pleine(0, 3, u32(0, 0, 1, 0, dureeFilm), zeros(8), u16(0, 0, 0, 0), MATRICE, u32(largeur << 16, hauteur << 16))),
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
    );

  const ftyp = boite("ftyp", Buffer.from("isom", "latin1"), u32(0x200), Buffer.from("isomiso2avc1mp41", "latin1"));
  const debutDonnees = ftyp.length + moov(0).length + 8;
  const donnees = Buffer.concat(echantillons.map((e) => e.donnees));
  return Buffer.concat([ftyp, moov(debutDonnees), u32(8 + donnees.length), Buffer.from("mdat", "latin1"), donnees]);
}

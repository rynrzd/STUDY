import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { analyserFichier, aplatir } from "./assistant-rentree.ts";
import { FichierIllisible, lireTableur, type Tableau, TAILLE_MAXIMALE } from "./tableur.ts";

export interface EleveImporte { readonly prenom: string; readonly nom: string; readonly externe: string; readonly ligne: number }

function cleExterne(prenom: string, nom: string, indication: string, occurrence: number): string {
  const base = indication.trim() || `${aplatir(nom)}|${aplatir(prenom)}|${occurrence}`;
  return createHash("sha256").update(base).digest("hex");
}

export function elevesDepuisTableau(nom: string, octets: number, tableau: Tableau): EleveImporte[] {
  const analyse = analyserFichier({ nom, octets, tableau, classeImposee: "classe" });
  const bloquante = analyse.lignes.flatMap((ligne) => ligne.anomalies.filter((a) => a.gravite === "bloquante").map((a) => `Ligne ${ligne.numero} : ${a.message}`));
  if (bloquante.length) throw new FichierIllisible(bloquante.slice(0, 5).join(" "));
  const occurrences = new Map<string, number>();
  return analyse.lignes.map((ligne) => {
    const identite = `${aplatir(ligne.nom)}|${aplatir(ligne.prenom)}`;
    const occurrence = (occurrences.get(identite) ?? 0) + 1;
    occurrences.set(identite, occurrence);
    return { prenom: ligne.prenom, nom: ligne.nom, externe: cleExterne(ligne.prenom, ligne.nom, ligne.identifiantExterne ?? "", occurrence), ligne: ligne.numero };
  });
}

async function tableauDepuisPdf(contenu: Buffer): Promise<Tableau> {
  let texte: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(contenu));
    const extrait = await extractText(pdf, { mergePages: true });
    texte = Array.isArray(extrait.text) ? extrait.text.join("\n") : String(extrait.text);
  } catch {
    throw new FichierIllisible("Ce PDF n’a pas pu être lu. Il est peut-être protégé ou endommagé.");
  }
  const lignes = texte.split(/\r?\n/u).map((l) => l.replace(/\s+/gu, " ").trim()).filter(Boolean);
  if (lignes.length < 2) throw new FichierIllisible("Ce PDF ne contient pas de liste lisible. S’il s’agit d’un scan, exporte-le avec reconnaissance de texte.");
  const separateur = lignes.some((l) => l.includes(";")) ? ";" : lignes.some((l) => l.includes("\t")) ? "\t" : null;
  if (separateur) {
    const cellules = lignes.map((l) => l.split(separateur).map((c) => c.trim()));
    return { entetes: cellules[0]!, lignes: cellules.slice(1) };
  }
  const utiles = lignes.filter((l) => !/^(nom|liste|classe)\b/iu.test(l));
  const lignesTableau = utiles.map((l) => {
    const mots = l.split(" ");
    if (mots.length < 2) return [l, ""];
    const nom = mots.shift()!;
    return [nom, mots.join(" ")];
  });
  return { entetes: ["nom", "prenom"], lignes: lignesTableau };
}

export async function lireListeEleves(nom: string, contenu: Buffer): Promise<EleveImporte[]> {
  if (contenu.length === 0 || contenu.length > TAILLE_MAXIMALE) throw new FichierIllisible(contenu.length === 0 ? "Le fichier est vide." : "Le fichier dépasse 4 Mo.");
  const tableau = nom.toLowerCase().endsWith(".pdf") ? await tableauDepuisPdf(contenu) : lireTableur(nom, contenu);
  const eleves = elevesDepuisTableau(nom, contenu.length, tableau);
  if (!eleves.length) throw new FichierIllisible("Aucun élève n’a été trouvé dans ce fichier.");
  return eleves;
}

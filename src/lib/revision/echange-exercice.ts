import { lireExercice } from "./validation-exercice.ts";

export const LIMITE_FICHIER_EXERCICE = 64 * 1024;
const CHAMPS = ["kind", "enonce", "bonne", "tolerance", "explication", "indice", "exemple", "nouvelleNotion"] as const;
export function exporterExercice(exercice: ReturnType<typeof lireExercice>): string {
  if (!exercice.valide) throw new Error("Complétez les champs de l’exercice avant de l’exporter.");
  const contenu = Object.fromEntries(CHAMPS.map((c) => [c, exercice.valeurs[c]]));
  return JSON.stringify({ format: "study.exercice", version: 1, contenu: { ...contenu, choix: exercice.choix } }, null, 2);
}
export function importerExercice(texte: string): ReturnType<typeof lireExercice> {
  if (new TextEncoder().encode(texte).length > LIMITE_FICHIER_EXERCICE) throw new Error("Le fichier dépasse 64 Ko.");
  let fichier: unknown;
  try { fichier = JSON.parse(texte); } catch { throw new Error("Ce fichier n’est pas un JSON valide."); }
  if (!fichier || typeof fichier !== "object") throw new Error("Format d’exercice inconnu.");
  const f = fichier as Record<string, unknown>;
  if (f.format !== "study.exercice" || f.version !== 1 || !f.contenu || typeof f.contenu !== "object" || Array.isArray(f.contenu)) throw new Error("Utilisez un export Study d’exercice (version 1).");
  const c = f.contenu as Record<string, unknown>;
  const donnees = new FormData();
  for (const champ of CHAMPS) {
    if (typeof c[champ] !== "string") throw new Error(`Champ invalide : ${champ}.`);
    donnees.set(champ === "nouvelleNotion" ? "nouvelle_notion" : champ, c[champ]);
  }
  if (!Array.isArray(c.choix) || c.choix.length > 8 || c.choix.some((x) => typeof x !== "string")) throw new Error("La liste des réponses est invalide.");
  for (const choix of c.choix) donnees.append("choix", choix);
  const e = lireExercice(donnees);
  if (!e.valide) throw new Error(Object.values(e.champs).flat().join(" "));
  return e; // Aucun identifiant de compte, séance, notion ou exercice n'est repris.
}

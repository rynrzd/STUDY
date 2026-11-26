import { z } from "zod";

/**
 * Souhaits pédagogiques déclarés à l'inscription. Ils ne confèrent AUCUN droit
 * sur l'établissement mentionné : les autorisations viennent des adhésions en
 * base et des politiques RLS, jamais des métadonnées Supabase modifiables.
 */
export const MAX_ENSEIGNEMENTS_SOUHAITES = 12;

const enseignement = z.object({
  classe: z.string().trim().min(2).max(80),
  matiere: z.string().trim().min(2).max(80),
});

export const schemaProjetProfesseur = z.object({
  etablissement: z.string().trim().max(120).default(""),
  enseignements: z.array(enseignement).max(MAX_ENSEIGNEMENTS_SOUHAITES).default([]),
});

export type ProjetProfesseur = z.infer<typeof schemaProjetProfesseur>;
export type EnseignementSouhaite = ProjetProfesseur["enseignements"][number];

export function nomNormalise(nom: string): string {
  return nom.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]/gu, "");
}

/** Ignore une même paire saisie deux fois, sans fusionner deux matières. */
export function dedoublonnerEnseignements(liste: readonly EnseignementSouhaite[]): EnseignementSouhaite[] {
  const vus = new Set<string>();
  return liste.filter((entree) => {
    const cle = `${nomNormalise(entree.classe)}|${nomNormalise(entree.matiere)}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

export function projetDepuisMetadonnees(metadata: unknown): ProjetProfesseur {
  if (typeof metadata !== "object" || metadata === null) return { etablissement: "", enseignements: [] };
  const brut = metadata as Record<string, unknown>;
  const resultat = schemaProjetProfesseur.safeParse({
    etablissement: brut.etablissement_enseigne_avecstudy ?? "",
    enseignements: brut.enseignements_souhaites_avecstudy ?? [],
  });
  return resultat.success
    ? { ...resultat.data, enseignements: dedoublonnerEnseignements(resultat.data.enseignements) }
    : { etablissement: "", enseignements: [] };
}

export function classerEnseignements(
  souhaits: readonly EnseignementSouhaite[],
  classes: readonly { label: string; matieres: readonly string[] }[],
): { dejaCrees: EnseignementSouhaite[]; aCreer: EnseignementSouhaite[] } {
  const correspondances = new Set(classes.flatMap((classe) => classe.matieres.map((matiere) =>
    `${nomNormalise(classe.label)}|${nomNormalise(matiere)}`)));
  const resultat = { dejaCrees: [] as EnseignementSouhaite[], aCreer: [] as EnseignementSouhaite[] };
  for (const souhait of dedoublonnerEnseignements(souhaits)) {
    const cle = `${nomNormalise(souhait.classe)}|${nomNormalise(souhait.matiere)}`;
    (correspondances.has(cle) ? resultat.dejaCrees : resultat.aCreer).push(souhait);
  }
  return resultat;
}

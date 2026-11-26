import "server-only";

import { projetDepuisMetadonnees, type ProjetProfesseur } from "./projet-professeur.ts";
import { clientAuthentification } from "./supabase-serveur.ts";

/** Les souhaits sont lus depuis le compte Supabase confirmé, avec SON jeton. */
export async function projetDuProfesseur(jetonAcces: string): Promise<ProjetProfesseur> {
  const { data, error } = await clientAuthentification().auth.getUser(jetonAcces);
  if (error || !data.user) return { etablissement: "", enseignements: [] };
  return projetDepuisMetadonnees(data.user.user_metadata);
}

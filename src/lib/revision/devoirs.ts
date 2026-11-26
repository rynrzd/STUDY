import "server-only";
import { clientUtilisateur } from "../supabase-serveur.ts";

export interface RevisionDevoir {
  devoir_id: string;
  titre: string;
  echeance: string | null;
  notion_id: string;
  notion: string;
  espace_id: string;
  versions: string[];
}

export async function revisionsDesDevoirs(jeton: string): Promise<RevisionDevoir[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("reviser_devoirs");
  if (error) return null;
  return (data ?? []) as RevisionDevoir[];
}

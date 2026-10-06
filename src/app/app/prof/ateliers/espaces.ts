import "server-only";

import { clientUtilisateur } from "@/lib/supabase-serveur";

/** Cours que la personne enseigne (destinataires possibles d'un atelier), sous RLS. */
export async function espacesEnseignes(jeton: string): Promise<{ id: string; libelle: string }[]> {
  const { data } = await clientUtilisateur(jeton).rpc("mes_cours");
  return ((data ?? []) as { id: string; matiere: string; classe: string | null; enseigne: boolean }[])
    .filter((c) => c.enseigne)
    .map((c) => ({ id: c.id, libelle: `${c.matiere}${c.classe ? ` — ${c.classe}` : ""}` }));
}

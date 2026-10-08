import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { VueAteliers } from "./vue";

export const metadata = { title: "Ateliers" };
export const dynamic = "force-dynamic";

/**
 * A18 — Ateliers publiés par les professeurs (actualité, vérifier une réponse
 * d'IA). Lecture sous le jeton de l'élève : la politique de la table ne rend
 * que les ateliers de ses enseignements, publiés ou clos. Aucun contenu
 * d'actualité n'est produit ici.
 */
export default async function PageAteliers({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await contexteApp();
  const { type } = await searchParams;
  let requete = clientUtilisateur(ctx.jeton)
    .from("ateliers")
    .select("id, titre, kind, etat, published_at, question")
    .neq("etat", "brouillon")
    .order("published_at", { ascending: false })
    .limit(60);
  if (type === "actualite" || type === "verifier_ia") requete = requete.eq("kind", type);
  const { data, error } = await requete;
  const ateliers = (data ?? []) as { id: string; titre: string; kind: string; etat: string; published_at: string | null; question: string }[];
  const filtres = [
    { cle: null, libelle: "Tous" },
    { cle: "actualite", libelle: "Actualité" },
    { cle: "verifier_ia", libelle: "Vérifier une réponse d'IA" },
  ];
  return <VueAteliers type={type} error={error} ateliers={ateliers} filtres={filtres} />;
}

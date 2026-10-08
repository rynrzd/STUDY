import Link from "next/link";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesCours } from "@/lib/v6/cours";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { EnTetePage, EtatErreur } from "@/components/study/ui";
import { VueCours } from "./vue";

export const metadata = { title: "Mes cours" };
export const dynamic = "force-dynamic";

/**
 * A03 — Mes cours, R2 (cahier §07). Recherche en tête (service de recherche
 * réel, sous les droits de l'élève), filtre de classe issu des seules
 * affectations vérifiées, puis une grille de deux ou trois colonnes sur
 * ordinateur et une liste sur téléphone. Chaque cours : matière, classe et
 * professeurs, chapitre courant, état réel des publications, action.
 */
export default async function PageCours({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await searchParams;
  const [cours, ateliers] = await Promise.all([
    mesCours(ctx.jeton),
    clientUtilisateur(ctx.jeton).from("ateliers").select("id, titre, kind, etat").neq("etat", "brouillon").order("published_at", { ascending: false }).limit(6),
  ]);
  const listeAteliers = (ateliers.data ?? []) as { id: string; titre: string; kind: string; etat: string }[];

  if (cours === null) {
    return (
      <>
        <EnTetePage titre="Mes cours" />
        <EtatErreur requestId={idRequete()} action={<Link href="/app/cours" className="bouton bouton-secondaire">Réessayer</Link>} />
      </>
    );
  }

  const classes = [...new Map(cours.filter((c) => c.classe).map((c) => [c.classId ?? c.classe!, c.classe!])).entries()];
  const filtre = classes.some(([id]) => id === classe) ? classe : null;
  const visibles = filtre ? cours.filter((c) => (c.classId ?? c.classe) === filtre) : cours;

  return <VueCours classes={classes} filtre={filtre} visibles={visibles} listeAteliers={listeAteliers} />;
}

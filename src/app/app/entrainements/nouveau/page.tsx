import { AccesIndisponible, EnTetePage, Panneau } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { lancerEntrainement } from "../../reviser/actions";

export const metadata = { title: "S'entraîner" };
export const dynamic = "force-dynamic";

/**
 * Ouvrir un entraînement sur un exercice trouvé par la recherche. La page se
 * contente d'afficher l'énoncé ; la création de la session est un POST
 * (aucune écriture en GET).
 */
export default async function PageNouvelEntrainement({ searchParams }: { searchParams: Promise<{ exercice?: string }> }) {
  const ctx = await contexteApp();
  const { exercice } = await searchParams;
  if (!exercice || !/^[0-9a-f-]{36}$/iu.test(exercice)) return <AccesIndisponible retour="/app/reviser" />;
  const { data } = await clientUtilisateur(ctx.jeton)
    .from("exercice_versions")
    .select("id, version, enonce")
    .eq("exercice_id", exercice)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const v = data as { id: string; version: number; enonce: string } | null;
  if (v === null) return <AccesIndisponible retour="/app/reviser" />;
  return (
    <div className="mx-auto max-w-[680px]">
      <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]} titre="S'entraîner sur cet exercice" />
      <Panneau>
        <p className="m-0">{v.enonce}</p>
        <form action={lancerEntrainement} className="mt-5">
          <input type="hidden" name="titre" value="Exercice" />
          <input type="hidden" name="version" value={v.id} />
          <button type="submit" className="bouton bouton-primaire">
            Commencer
          </button>
        </form>
      </Panneau>
    </div>
  );
}

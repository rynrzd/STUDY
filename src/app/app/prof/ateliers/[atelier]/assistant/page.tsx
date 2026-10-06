import { redirect } from "next/navigation";
import { AccesIndisponible, EnTetePage } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { AssistantAtelier } from "../../../../ateliers/AssistantAtelier";
import { espacesEnseignes } from "../../espaces";

export const metadata = { title: "Assistant d'atelier" };
export const dynamic = "force-dynamic";

/** T05 — reprise du brouillon à l'étape demandée ; un atelier publié renvoie à sa page. */
export default async function PageAssistant({ params, searchParams }: { params: Promise<{ atelier: string }>; searchParams: Promise<{ etape?: string }> }) {
  const ctx = await contexteApp();
  if (!ctx.roles.professeur) return <AccesIndisponible />;
  const { atelier } = await params;
  const etape = Math.min(4, Math.max(1, Number((await searchParams).etape) || 1));
  const client = clientUtilisateur(ctx.jeton);
  const [lu, corrige, espaces] = await Promise.all([
    client.from("ateliers").select("id, kind, titre, question, consigne, texte_examine, sources, etat, teaching_space_id, created_by").eq("id", atelier).maybeSingle(),
    client.from("ateliers_corriges").select("corrige").eq("atelier_id", atelier).maybeSingle(),
    espacesEnseignes(ctx.jeton),
  ]);
  const a = lu.data as {
    id: string;
    kind: "actualite" | "verifier_ia";
    titre: string;
    question: string;
    consigne: string | null;
    texte_examine: string | null;
    sources: { titre: string; auteur: string; date: string; url: string; extrait: string }[];
    etat: string;
    teaching_space_id: string;
    created_by: string;
  } | null;
  if (!a) return <AccesIndisponible retour="/app/prof/ateliers" />;
  if (a.etat !== "brouillon") redirect(`/app/prof/ateliers/${a.id}`);
  return (
    <div className="mx-auto max-w-[900px]">
      <EnTetePage filAriane={[{ href: "/app/prof/ateliers", libelle: "Ateliers" }]} titre={a.titre} sousTitre="Brouillon enregistré à chaque étape." />
      <AssistantAtelier
        etape={etape}
        espaces={espaces}
        donnees={{
          id: a.id,
          kind: a.kind,
          titre: a.titre,
          question: a.question,
          consigne: a.consigne ?? "",
          texte: a.texte_examine ?? "",
          sources: a.sources ?? [],
          corrige: (corrige.data as { corrige: string } | null)?.corrige ?? "",
          cours: espaces.find((e) => e.id === a.teaching_space_id)?.libelle ?? null,
        }}
      />
    </div>
  );
}

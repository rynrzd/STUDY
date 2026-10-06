import { EnTetePage } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { Recherche } from "./Recherche";

export const metadata = { title: "Recherche" };
export const dynamic = "force-dynamic";

/**
 * E17 — Recherche globale : cours, passages, exercices, fiches, échanges,
 * décisions et projets accessibles. Le périmètre proposé vient des seules
 * affectations vérifiées ; le choisir réduit, ne l'étend jamais.
 */
export default async function PageRecherche({ searchParams }: { searchParams: Promise<{ q?: string; types?: string; classe?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  return (
    <div className="mx-auto max-w-[920px]">
      <EnTetePage titre="Recherche" sousTitre="Dans tes cours, tes fiches, les échanges de tes classes et tes projets." />
      <Recherche
        initiale={{ q: (q.q ?? "").slice(0, 500), types: (q.types ?? "").split(",").filter(Boolean), classe: q.classe ?? "" }}
        classes={ctx.contextes.map((c) => ({ id: c.classe, libelle: c.libelle }))}
      />
    </div>
  );
}

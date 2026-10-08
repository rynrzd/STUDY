import { BookOpen } from "lucide-react";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { disponibilites, FORMATS, seancesChoisissables } from "@/lib/v6/fiches";
import { FormulaireFiche } from "./FormulaireFiche";

export const metadata = { title: "Créer une révision" };
export const dynamic = "force-dynamic";

/**
 * E04 — Créer une révision : sources, objectif et format avant tout
 * lancement. Ce qui sera inclus ou exclu est montré avant ; aucune barre de
 * progression simulée ensuite.
 */
export default async function PageNouvelleFiche({ searchParams }: { searchParams: Promise<{ seance?: string; format?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  const seances = await seancesChoisissables(ctx.jeton);
  const dispo = await disponibilites(
    ctx.jeton,
    seances.map((s) => s.id),
  );
  const format = q.format && q.format in FORMATS ? q.format : "essentiel";

  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]} sourcil="Fiche à la demande" titre="Créer une révision" sousTitre="Choisis tes sources : la fiche ne contiendra que des extraits de ces séances, cités." />
      {seances.length === 0 ? (
        <EtatVide icone={BookOpen} titre="Aucune séance disponible" texte="Les fiches se construisent à partir des séances publiées dans tes cours. Il n'y en a pas encore." />
      ) : (
        <FormulaireFiche
          seances={seances.map((s) => ({ ...s, passages: dispo.get(s.id)?.passages ?? 0, exercices: dispo.get(s.id)?.exercices ?? 0 }))}
          preselection={q.seance && seances.some((s) => s.id === q.seance) ? [q.seance] : []}
          formatInitial={format}
        />
      )}
    </div>
  );
}

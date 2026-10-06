import { AssistantAtelier } from "@/app/app/ateliers/AssistantAtelier";
import { Coque } from "@/components/study/Coque";
import { EnTetePage } from "@/components/study/ui";
import { CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : assistant d'atelier, données fictives (rien n'est enregistré). */
export default async function ApercuAtelier({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const etape = Math.min(4, Math.max(1, Number((await searchParams).etape) || 2));
  return (
    <Coque ctx={{ ...CONTEXTE_FICTIF, roles: { ...CONTEXTE_FICTIF.roles, professeur: true } }}>
      <div className="mx-auto max-w-[900px]">
        <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
        <EnTetePage titre="Comparer une réponse avec les documents" sousTitre="Brouillon enregistré à chaque étape." />
        <AssistantAtelier
          etape={etape}
          espaces={[]}
          donnees={{
            id: "00000000-0000-4000-8000-0000000000aa",
            kind: "verifier_ia",
            titre: "Comparer une réponse avec les documents",
            question: "À partir des documents, montrez en quoi la liberté d'expression est à la fois une condition et une limite de la démocratie.",
            consigne: "",
            texte: "",
            sources: [{ titre: "Document 1 (fictif)", auteur: "Source d'exemple", date: "2021-03-01", url: "", extrait: "Extrait d'exemple." }],
            corrige: "",
            cours: "Histoire — Première B (fictif)",
          }}
        />
      </div>
    </Coque>
  );
}

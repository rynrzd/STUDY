import Link from "next/link";
import { FileText } from "lucide-react";
import { Depot } from "@/components/studio/Depot";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EnTetePage, Etiquette, Ligne, ListeLignes, type Ton } from "@/components/study/ui";
import type { DocumentStudio, mesDocuments } from "@/lib/studio-documents";

const ETATS: Record<DocumentStudio["etat"], { libelle: string; ton: Ton; action: string }> = {
  importe: { libelle: "Transfert", ton: "neutre", action: "Ouvrir" },
  traitement: { libelle: "Lecture du document", ton: "attention", action: "Suivre" },
  a_verifier: { libelle: "À vérifier", ton: "attention", action: "Vérifier" },
  pret: { libelle: "Prêt", ton: "succes", action: "Ouvrir" },
  echec: { libelle: "Échec", ton: "erreur", action: "Voir" },
};

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueStudioDocuments({ documents }: { documents: Awaited<ReturnType<typeof mesDocuments>> }) {
  return (
    <>
      <RubriqueCours actif="/professeur/studio" />
      <EnTetePage sourcil="Mes cours" titre="Transformer un document en séance" />
      <div id="depot" className="scroll-mt-24">
        <Depot />
      </div>
      <p className="mt-3 text-sm text-[color:var(--color-encre-faible)]">Tu veux conserver la mise en page exacte ? <Link href="/studio" className="font-semibold underline">Joindre le PDF à une séance</Link></p>

      <section className="mt-10" aria-labelledby="derniers">
        <h2 id="derniers" className="titre-section mb-3 flex items-center gap-2">
          Mes derniers cours <span className="nombre">{documents.length}</span>
        </h2>

        {documents.length === 0 ? (
          <p className="meta">Tes documents importés apparaîtront ici.</p>
        ) : (
          <ListeLignes>
            {documents.map((document) => {
              const etat = ETATS[document.etat];
              return (
                <Ligne
                  key={document.id}
                  href={`/professeur/studio/${document.id}`}
                  icone={FileText}
                  titre={document.titre}
                  detail={new Date(document.majLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  fin={
                    <>
                      <Etiquette ton={etat.ton}>{etat.libelle}</Etiquette>
                      <span className="hidden text-[0.875rem] font-semibold text-[color:var(--color-accent)] sm:inline">{etat.action}</span>
                    </>
                  }
                />
              );
            })}
          </ListeLignes>
        )}
      </section>
    </>
  );
}

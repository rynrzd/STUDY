import { FileText, FileUp } from "lucide-react";
import { Depot } from "@/components/studio/Depot";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes, type Ton } from "@/components/study/ui";
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
      <EnTetePage sourcil="Studio" titre="Vos cours, bien présentés." sousTitre="Importez votre document. Gardez le contenu, choisissez la présentation." />

      <Depot />

      <section className="mt-10" aria-labelledby="derniers">
        <h2 id="derniers" className="titre-section mb-3 flex items-center gap-2">
          Mes derniers cours <span className="nombre">{documents.length}</span>
        </h2>

        {documents.length === 0 ? (
          <EtatVide
            icone={FileUp}
            titre="Rien pour l'instant"
            texte="Déposez un cours au format PDF ou Word : il sera lu, mis en page, et vous pourrez le vérifier avant de le publier dans une classe."
          />
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

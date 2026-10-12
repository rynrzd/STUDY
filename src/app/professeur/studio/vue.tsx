import Link from "next/link";
import { ArrowRight, FileCheck, FilePen, FileText, FileUp } from "lucide-react";
import { Depot } from "@/components/studio/Depot";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes, TuileIcone, type Ton } from "@/components/study/ui";
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
      <EnTetePage sourcil="Mes cours" titre="Importer un document" sousTitre="Un PDF ou un Word que vous avez déjà : vous le gardez tel quel, ou vous le transformez en séance modifiable." />

      {/* Deux façons de distribuer un PDF, nommées comme telles (cahier des
          charges ch. 12, PDF-01 et CONV-01) : rien n'est converti sans que le
          professeur l'ait choisi. */}
      <section aria-labelledby="deux-facons" className="mb-6">
        <h2 id="deux-facons" className="sr-only">
          Deux façons d&apos;ajouter un document
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/studio" className="carte-chiffre carte-souleve min-h-0">
            <span className="flex items-center justify-between gap-2">
              <TuileIcone icone={FileCheck} />
              <Etiquette ton="succes">Intact</Etiquette>
            </span>
            <span className="mt-2 font-bold">Garder mon PDF tel quel</span>
            <span className="meta">
              Formules, schémas, mise en page : rien ne bouge. Dans « Mes séances », ouvrez une séance et ajoutez un bloc « Document » : vos élèves le lisent directement dans la séance, ou le téléchargent.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Aller à mes séances <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </Link>
          <a href="#depot" className="carte-chiffre carte-souleve min-h-0">
            <span className="flex items-center justify-between gap-2">
              <TuileIcone icone={FilePen} />
              <Etiquette ton="attention">À relire</Etiquette>
            </span>
            <span className="mt-2 font-bold">Le transformer en cours modifiable</span>
            <span className="meta">
              Le texte est extrait pour être mis en page et modifié. La conversion peut perdre une formule, un tableau ou une image : vous relisez avant de publier, et le fichier d&apos;origine est conservé.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Déposer ci-dessous <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </a>
        </div>
      </section>

      <div id="depot" className="scroll-mt-24">
        <Depot />
      </div>

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

import Link from "next/link";
import { FileText, PanelsTopLeft } from "lucide-react";
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
      <EnTetePage sourcil="Mes cours" titre="Ton document, ton choix" />

      <section className="mt-6" aria-labelledby="choix-studio-titre">
        <h2 id="choix-studio-titre" className="m-0 text-lg font-bold">Que veux-tu faire de ton fichier ?</h2>
        <p className="m-0 mt-2 max-w-[65ch] text-sm text-[color:var(--color-encre-faible)]">
          Les deux chemins sont différents. Choisis selon que tu souhaites préserver les pages ou retravailler la présentation.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="flex min-w-0 flex-col rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5">
            <FileText aria-hidden="true" size={28} className="text-[color:var(--color-accent)]" />
            <h3 className="m-0 mt-3 text-lg font-bold">Conserver mon original</h3>
            <p className="mt-2 flex-1 text-sm text-[color:var(--color-encre-faible)]">
              Garder ton PDF tel quel et le joindre à une séance. Ses pages et sa mise en page ne sont pas transformées.
            </p>
            <Link href="/studio" className="bouton bouton-secondaire mt-3 w-full justify-center text-center sm:w-auto">
              Joindre mon PDF à un cours
            </Link>
          </article>

          <article className="flex min-w-0 flex-col rounded-xl border border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] p-5">
            <PanelsTopLeft aria-hidden="true" size={28} className="text-[color:var(--color-accent)]" />
            <h3 className="m-0 mt-3 text-lg font-bold">Moderniser mon support</h3>
            <p className="mt-2 flex-1 text-sm text-[color:var(--color-encre-faible)]">
              Extraire le texte d&apos;un PDF ou d&apos;un Word pour réorganiser sa présentation. Tu pourras comparer et corriger avant de publier.
            </p>
            <a href="#depot" className="bouton bouton-primaire mt-3 w-full justify-center text-center sm:w-auto">
              Choisir un fichier à transformer
            </a>
          </article>
        </div>
      </section>

      <div id="depot" className="mt-8 scroll-mt-24">
        <h2 className="m-0 mb-3 text-lg font-bold">Transformer mon fichier</h2>
        <Depot />
      </div>
      <p className="mt-3 text-sm text-[color:var(--color-encre-faible)]">
        Les PDF scannés sans texte sélectionnable ne sont pas encore convertis. Tu peux toujours conserver leur version originale.
      </p>

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

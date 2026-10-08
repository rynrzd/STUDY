import { Lock, UserRound } from "lucide-react";
import { EnTetePage, Encadre, EtatVide, Panneau } from "@/components/study/ui";
import { FormulaireNouvelleDemande } from "../formulaires";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueNouvelleDemande({ destinataires, lecon, sujetInitial }: { destinataires: readonly { id: string; nom: string; qualite: string }[]; lecon: string | undefined; sujetInitial: string | undefined }) {
  return (
    <div className="mx-auto max-w-[1040px]">
      <EnTetePage
        filAriane={[{ href: "/app/demandes", libelle: "Demandes personnelles" }]}
        sourcil="Demande personnelle"
        titre="Écrire à un adulte"
        sousTitre="Une question, un conseil, une difficulté : un échange privé avec un professeur qui t'encadre."
      />
      <div className="mb-5">
        <Encadre icone={Lock} titre="Cette demande est privée.">
          Seuls toi et la personne choisie la lisez. Ni ta classe, ni les autres professeurs, ni l&apos;administration n&apos;y ont accès.
        </Encadre>
      </div>
      {destinataires.length === 0 ? (
        <EtatVide icone={UserRound} titre="Aucun destinataire disponible" texte="Les professeurs de tes classes apparaîtront ici. En attendant, adresse-toi à la vie scolaire." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section aria-labelledby="pourquoi" className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6">
            <h2 id="pourquoi" className="titre-bloc m-0 font-bold">
              Pourquoi écrire ici ?
            </h2>
            <ul className="m-0 mt-3 grid gap-1.5 pl-5 text-[0.9375rem]">
              <li>poser une question sur un cours ou un devoir ;</li>
              <li>demander un conseil sur ton orientation ;</li>
              <li>signaler une difficulté ;</li>
              <li>tout autre sujet personnel ou scolaire.</li>
            </ul>
            <p className="meta m-0 mt-4">S&apos;il y a un danger, préviens aussi un adulte de vive voix : un message peut être lu plus tard.</p>
          </section>
          <Panneau titre="Ton message">
            <FormulaireNouvelleDemande destinataires={destinataires} lecon={lecon} sujetInitial={sujetInitial} />
          </Panneau>
        </div>
      )}
    </div>
  );
}

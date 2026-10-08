import Link from "next/link";
import { Lock, MessageCircle, MessageSquareLock } from "lucide-react";
import { ListeSalons } from "@/components/study/ListeSalons";
import { EnTetePage, Encadre, EtatErreur, EtatVide, ICONE } from "@/components/study/ui";
import type { mesSalons } from "@/lib/v6/messagerie";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueMessagerie({ salons, requete }: { salons: Awaited<ReturnType<typeof mesSalons>>; requete: string | null }) {
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage
        sourcil="Messagerie"
        titre="Échanges de tes classes"
        sousTitre="Les salons de tes classes et de tes projets, avec tes professeurs."
        actions={
          <Link href="/app/demandes" className="bouton bouton-secondaire">
            <MessageSquareLock {...ICONE} /> Demandes personnelles
          </Link>
        }
      />
      {salons === null ? (
        <EtatErreur requestId={requete} action={<Link href="/app/messagerie" className="bouton bouton-secondaire">Réessayer</Link>} />
      ) : salons.length === 0 ? (
        <EtatVide icone={MessageCircle} titre="Aucun salon pour l'instant" texte="Les salons apparaissent dès que tu es inscrit dans une classe ou un projet de groupe." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ListeSalons salons={salons} presentation="liste" />
          <Encadre icone={Lock} titre="Qui lit un salon ?">
            Les membres de la classe ou du projet et leurs professeurs. Une question personnelle passe par les demandes à un adulte, lues par la seule personne choisie.
          </Encadre>
        </div>
      )}
    </div>
  );
}

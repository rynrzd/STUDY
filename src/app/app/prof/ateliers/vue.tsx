import Link from "next/link";
import { Bot, Newspaper, Plus } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, ICONE, Ligne, ListeLignes } from "@/components/study/ui";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAteliersProf({ liste, espaces }: { liste: readonly { id: string; kind: string; titre: string; etat: string }[]; espaces: readonly { id: string; libelle: string }[] }) {
  return (
    <>
      <EnTetePage
        sourcil="Ateliers"
        titre="Mes ateliers"
        sousTitre="Distinguer faits et interprétations ; vérifier une réponse d'IA avec les sources du cours."
        actions={
          espaces.length > 0 ? (
            <Link href="/app/prof/ateliers/nouveau" className="bouton bouton-primaire">
              <Plus {...ICONE} /> Créer un atelier
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Mes ateliers">
          {liste.length === 0 ? (
            <EtatVide icone={Newspaper} titre="Aucun atelier pour l'instant" texte="Un atelier croise une question, des documents datés et, si besoin, une réponse d'IA à vérifier." />
          ) : (
            <ListeLignes>
              {liste.map((a) => (
                <Ligne
                  key={a.id}
                  href={a.etat === "brouillon" ? `/app/prof/ateliers/${a.id}/assistant` : `/app/prof/ateliers/${a.id}`}
                  icone={a.kind === "actualite" ? Newspaper : Bot}
                  titre={a.titre}
                  detail={a.kind === "actualite" ? "Actualité" : "Vérifier une réponse d'IA"}
                  fin={<Etiquette ton={a.etat === "publie" ? "succes" : a.etat === "clos" ? "neutre" : "attention"}>{a.etat === "publie" ? "Publié" : a.etat === "clos" ? "Clos" : "Brouillon"}</Etiquette>}
                />
              ))}
            </ListeLignes>
          )}
        </section>
        <aside className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5">
          <h2 className="titre-bloc m-0 font-bold">Nouvel atelier</h2>
          <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">Quatre étapes : objectif, documents datés, consignes, corrigé. Le brouillon est enregistré à chaque étape.</p>
          {espaces.length === 0 ? (
            <p className="meta m-0 mt-3">Aucun cours ne vous est affecté : un atelier s&apos;adresse aux élèves d&apos;un de vos cours.</p>
          ) : (
            <Link href="/app/prof/ateliers/nouveau" className="bouton bouton-primaire mt-4">
              Créer un atelier
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}

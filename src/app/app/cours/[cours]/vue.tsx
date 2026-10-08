import Link from "next/link";
import { BookOpen, FileText, RotateCcw } from "lucide-react";
import { EnTetePage, EtatErreur, EtatVide, ICONE, Ligne, ListeLignes, TuileIcone, dateLisible } from "@/components/study/ui";
import type { mesCours, seancesParChapitre } from "@/lib/v6/cours";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueUnCours({ id, cours, chapitres, nbSeances, requete }: {
  id: string;
  cours: NonNullable<Awaited<ReturnType<typeof mesCours>>>[number] | null;
  chapitres: Awaited<ReturnType<typeof seancesParChapitre>> | null;
  nbSeances: number;
  requete: string | null;
}) {
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage
        filAriane={[{ href: "/app/cours", libelle: "Mes cours" }]}
        titre={cours?.matiere ?? "Cours"}
        sousTitre={cours ? [cours.classe, cours.enseignants].filter(Boolean).join(" · ") : null}
        actions={
          nbSeances > 0 ? (
            <Link href="/app/reviser" className="bouton bouton-primaire">
              <RotateCcw {...ICONE} /> Réviser
            </Link>
          ) : null
        }
      />
      {chapitres === null ? (
        <EtatErreur requestId={requete} action={<Link href={`/app/cours/${id}`} className="bouton bouton-secondaire">Réessayer</Link>} />
      ) : chapitres.length === 0 ? (
        <EtatVide
          icone={BookOpen}
          titre="Aucune séance publiée dans ce cours"
          texte="Ton professeur prépare ses séances avant de les publier. Elles apparaîtront ici dès qu'elles seront visibles par ta classe."
        />
      ) : (
        <>
          <div className="mb-6 flex items-center gap-4 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5">
            <TuileIcone icone={BookOpen} ton="neutre" grande />
            <p className="m-0">
              <span className="block font-bold">
                {nbSeances} séance{nbSeances > 1 ? "s" : ""} publiée{nbSeances > 1 ? "s" : ""}, {chapitres.length} chapitre{chapitres.length > 1 ? "s" : ""}
              </span>
              <span className="meta block">Ouvre une séance pour la lire, poser une question ou la garder hors ligne.</span>
            </p>
          </div>
          <div className="grid gap-6">
            {chapitres.map((ch) => (
              <section key={ch.id ?? "autres"} aria-labelledby={`ch-${ch.id ?? "autres"}`}>
                <h2 id={`ch-${ch.id ?? "autres"}`} className="titre-section mb-3">
                  {ch.libelle}
                </h2>
                <ListeLignes>
                  {ch.seances.map((s) => (
                    <Ligne
                      key={s.id}
                      href={`/app/seances/${s.id}`}
                      icone={FileText}
                      titre={s.titre}
                      detail={s.objectif}
                      fin={<span className="meta">{dateLisible(s.publieeLe, { day: "numeric", month: "short" })}</span>}
                    />
                  ))}
                </ListeLignes>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

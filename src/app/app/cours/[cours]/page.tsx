import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccesIndisponible, EnTetePage, EtatErreur, EtatVide, dateLisible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesCours, seancesParChapitre } from "@/lib/v6/cours";

export const metadata = { title: "Cours" };
export const dynamic = "force-dynamic";

/** Un cours : ses chapitres et ses séances publiées (matière → chapitre → séance). */
export default async function PageUnCours({ params }: { params: Promise<{ cours: string }> }) {
  const ctx = await contexteApp();
  const { cours: id } = await params;
  const tous = await mesCours(ctx.jeton);
  const cours = tous?.find((c) => c.id === id) ?? null;
  // Un cours d'une autre classe n'est pas « introuvable » ni « interdit » : il n'est pas accessible.
  if (tous !== null && cours === null) return <AccesIndisponible retour="/app/cours" />;

  const chapitres = cours === null ? null : await seancesParChapitre(ctx.jeton, cours.id);

  return (
    <>
      <EnTetePage
        filAriane={[{ href: "/app/cours", libelle: "Mes cours" }]}
        titre={cours?.matiere ?? "Cours"}
        sousTitre={cours ? [cours.classe, cours.enseignants].filter(Boolean).join(" · ") : null}
      />
      {chapitres === null ? (
        <EtatErreur requestId={idRequete()} action={<Link href={`/app/cours/${id}`} className="bouton bouton-secondaire">Réessayer</Link>} />
      ) : chapitres.length === 0 ? (
        <EtatVide
          titre="Aucune séance publiée dans ce cours"
          texte="Ton professeur prépare ses séances avant de les publier. Elles apparaîtront ici dès qu'elles seront visibles par ta classe."
        />
      ) : (
        <div className="grid gap-6">
          {chapitres.map((ch) => (
            <section key={ch.id ?? "autres"} className="panneau" aria-labelledby={`ch-${ch.id ?? "autres"}`}>
              <h2 id={`ch-${ch.id ?? "autres"}`} className="titre-section mb-3">
                {ch.libelle}
              </h2>
              <ul className="m-0 list-none p-0">
                {ch.seances.map((s) => (
                  <li key={s.id} className="ligne">
                    <Link href={`/app/seances/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[color:var(--color-encre)]">{s.titre}</span>
                        {s.objectif ? <span className="meta block truncate">{s.objectif}</span> : null}
                      </span>
                      <span className="meta shrink-0">{dateLisible(s.publieeLe, { day: "numeric", month: "short" })}</span>
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-encre-faible)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

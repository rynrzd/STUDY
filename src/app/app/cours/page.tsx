import Link from "next/link";
import { BookOpen, CalendarClock, Sparkles } from "lucide-react";
import { EnTetePage, EtatErreur, EtatVide, ICONE, dateLisible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesCours } from "@/lib/v6/cours";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata = { title: "Mes cours" };
export const dynamic = "force-dynamic";

const TEINTES = ["#f3e4ec", "#edf0e5", "#efeaf7", "#fbf0e1", "#e6eef4", "#f4e9e4"];

/**
 * E02 — Mes cours. Matière, chapitre courant, professeur, nombre réel de
 * séances. Grille sur ordinateur, liste compacte sur téléphone. Les filtres
 * de classe viennent des seules affectations vérifiées.
 */
export default async function PageCours({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await searchParams;
  const [cours, ateliers] = await Promise.all([
    mesCours(ctx.jeton),
    clientUtilisateur(ctx.jeton).from("ateliers").select("id, titre, kind, etat").neq("etat", "brouillon").order("published_at", { ascending: false }).limit(6),
  ]);
  const listeAteliers = (ateliers.data ?? []) as { id: string; titre: string; kind: string; etat: string }[];

  if (cours === null) {
    return (
      <>
        <EnTetePage titre="Mes cours" />
        <EtatErreur requestId={idRequete()} action={<Link href="/app/cours" className="bouton bouton-secondaire">Réessayer</Link>} />
      </>
    );
  }

  const classes = [...new Map(cours.filter((c) => c.classe).map((c) => [c.classId ?? c.classe!, c.classe!])).entries()];
  const filtre = classes.some(([id]) => id === classe) ? classe : null;
  const visibles = filtre ? cours.filter((c) => (c.classId ?? c.classe) === filtre) : cours;

  return (
    <>
      <EnTetePage
        titre="Mes cours"
        sousTitre="Tes matières, leurs chapitres et toutes les séances publiées par tes professeurs."
        actions={
          <>
            <Link href="/app/reviser" className="bouton bouton-secondaire">
              <Sparkles {...ICONE} /> Mes fiches
            </Link>
            <Link href="/app/rattrapage" className="bouton bouton-secondaire">
              <CalendarClock {...ICONE} /> Rattraper une absence
            </Link>
          </>
        }
      />

      {classes.length > 1 ? (
        <nav aria-label="Filtrer par classe" className="mb-6 flex flex-wrap gap-2">
          <Link href="/app/cours" aria-current={filtre ? undefined : "page"} className="etiquette-etat no-underline" data-ton={filtre ? undefined : "rose"}>
            Toutes mes classes
          </Link>
          {classes.map(([id, libelle]) => (
            <Link
              key={id}
              href={`/app/cours?classe=${id}`}
              aria-current={filtre === id ? "page" : undefined}
              className="etiquette-etat no-underline"
              data-ton={filtre === id ? "rose" : undefined}
            >
              {libelle}
            </Link>
          ))}
        </nav>
      ) : null}

      {visibles.length === 0 ? (
        <EtatVide
          icone={BookOpen}
          titre="Aucun cours pour le moment"
          texte="Tes cours apparaîtront ici dès que ton établissement aura confirmé ton inscription dans une classe."
        />
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/app/cours/${c.id}`}
                className="panneau grid h-full grid-cols-[44px_1fr] gap-x-4 gap-y-1 no-underline transition-colors hover:border-[color:var(--color-bordure-forte)] sm:block"
              >
                <span
                  aria-hidden="true"
                  className="row-span-3 inline-grid h-11 w-11 place-items-center rounded-[11px] font-[family-name:var(--font-titre)] text-[1.25rem] font-bold text-[color:var(--color-accent-fonce)] sm:mb-5"
                  style={{ background: TEINTES[i % TEINTES.length] }}
                >
                  {c.matiere.charAt(0)}
                </span>
                <span className="titre-bloc block font-bold text-[color:var(--color-encre)]">{c.matiere}</span>
                <span className="meta block">
                  {[c.classe, c.enseignants].filter(Boolean).join(" · ") || "Cours"}
                </span>
                <span className="mt-1 block text-[0.8125rem] text-[color:var(--color-encre-faible)] sm:mt-3">
                  {c.chapitreCourant ? `En cours : ${c.chapitreCourant}` : "Pas encore de chapitre"}
                </span>
                <span className="meta col-start-2 mt-2 block sm:mt-4">
                  {c.seances === 0 ? "Aucune séance publiée" : `${c.seances} séance${c.seances > 1 ? "s" : ""} publiée${c.seances > 1 ? "s" : ""}`}
                  {c.dernierePublication ? ` · dernière le ${dateLisible(c.dernierePublication, { day: "numeric", month: "short" })}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {listeAteliers.length > 0 ? (
        <section className="panneau mt-8" aria-labelledby="ateliers">
          <h2 id="ateliers" className="titre-section mb-3">
            Ateliers
          </h2>
          <ul className="m-0 list-none p-0">
            {listeAteliers.map((a) => (
              <li key={a.id} className="ligne">
                <Link href={`/app/ateliers/${a.id}`} className="min-w-0 flex-1">
                  {a.titre}
                </Link>
                <span className="meta">{a.kind === "actualite" ? "Actualité" : "Vérifier une réponse d'IA"}{a.etat === "clos" ? " · clos" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

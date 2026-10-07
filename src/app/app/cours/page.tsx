import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, Search } from "lucide-react";
import { EnTetePage, EtatErreur, EtatVide, ICONE, dateLisible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesCours } from "@/lib/v6/cours";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata = { title: "Mes cours" };
export const dynamic = "force-dynamic";

/**
 * A03 — Mes cours, R2 (cahier §07). Recherche en tête (service de recherche
 * réel, sous les droits de l'élève), filtre de classe issu des seules
 * affectations vérifiées, puis une grille de deux ou trois colonnes sur
 * ordinateur et une liste sur téléphone. Chaque cours : matière, classe et
 * professeurs, chapitre courant, état réel des publications, action.
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
          <Link href="/app/rattrapage" className="bouton bouton-secondaire">
            <CalendarClock {...ICONE} /> Rattraper une absence
          </Link>
        }
      />

      <form action="/app/recherche" method="get" role="search" className="mb-5 flex max-w-[640px] items-center gap-2">
        <label htmlFor="recherche-cours" className="sr-only">
          Rechercher dans mes cours
        </label>
        <div className="flex h-12 flex-1 items-center gap-2 rounded-[12px] border border-[color:var(--color-bordure-champ)] bg-[color:var(--color-surface)] px-3 focus-within:border-[color:var(--color-accent)]">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-encre-faible)]" />
          <input id="recherche-cours" name="q" type="search" maxLength={500} placeholder="Un cours, un chapitre, une notion…" className="w-full border-0 bg-transparent text-[1rem] outline-none" />
        </div>
        <button type="submit" className="bouton bouton-primaire">
          Rechercher
        </button>
      </form>

      {classes.length > 1 ? (
        <nav aria-label="Filtrer par classe" className="mb-6 flex flex-wrap gap-2">
          {[["", "Toutes mes classes"] as const, ...classes].map(([id, libelle]) => {
            const actif = id === "" ? !filtre : filtre === id;
            return (
              <Link
                key={id || "toutes"}
                href={id ? `/app/cours?classe=${id}` : "/app/cours"}
                aria-current={actif ? "page" : undefined}
                className={`inline-flex min-h-[40px] items-center rounded-full border px-4 text-[0.9375rem] font-bold no-underline ${actif ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white" : "border-[color:var(--color-bordure-forte)] bg-[color:var(--color-surface)] text-[color:var(--color-encre)]"}`}
              >
                {libelle}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {visibles.length === 0 ? (
        <EtatVide
          icone={BookOpen}
          titre="Aucun cours pour le moment"
          texte="Tes cours apparaîtront ici dès que ton établissement aura confirmé ton inscription dans une classe."
        />
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visibles.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/cours/${c.id}`}
                className="carte-souleve flex h-full items-start gap-4 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 no-underline sm:flex-col sm:p-5"
              >
                <span aria-hidden="true" className="livre">
                  {c.matiere.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.0625rem] font-extrabold text-[color:var(--color-encre)]">{c.matiere}</span>
                  <span className="meta block">{[c.classe, c.enseignants].filter(Boolean).join(" · ") || "Cours"}</span>
                  <span className="mt-2 block text-[0.9375rem] text-[color:var(--color-encre)]">
                    {c.chapitreCourant ? `En cours : ${c.chapitreCourant}` : "Pas encore de chapitre"}
                  </span>
                  <span className="meta mt-1 block">
                    {c.seances === 0 ? "Aucune séance publiée" : `${c.seances} séance${c.seances > 1 ? "s" : ""} publiée${c.seances > 1 ? "s" : ""}`}
                    {c.dernierePublication ? ` · dernière le ${dateLisible(c.dernierePublication, { day: "numeric", month: "short" })}` : ""}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-[0.9375rem] font-bold text-[color:var(--color-accent)]">
                    Ouvrir <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
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

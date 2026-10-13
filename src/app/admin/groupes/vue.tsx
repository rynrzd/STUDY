import Link from "next/link";
import { ArrowRight, Layers, Search, Users } from "lucide-react";
import { CreerGroupe } from "@/components/admin/GroupeFormulaires";
import { EnTetePage, EtatVide, ICONE } from "@/components/study/ui";
import type { DetailGroupe, GroupeEtab } from "@/lib/etablissement";
import { RubriqueClasses } from "@/components/study/Rubriques";
import { AideTrois } from "@/components/study/AideTrois";

export interface FiltresGroupes {
  readonly q: string;
  readonly type: "" | "interclasses" | "sous_groupe";
  readonly matiere: string;
  readonly professeur: string;
  readonly classe: string;
  readonly effectif: "" | "vides" | "avec";
}

const AUCUN_FILTRE: FiltresGroupes = { q: "", type: "", matiere: "", professeur: "", classe: "", effectif: "" };

/** Minuscules sans accent : « spé » trouve « Spé Maths ». */
const plat = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueGroupes({
  liste,
  details = new Map(),
  filtres = AUCUN_FILTRE,
}: {
  liste: readonly GroupeEtab[];
  details?: ReadonlyMap<string, DetailGroupe>;
  filtres?: FiltresGroupes;
}) {
  const tri = (valeurs: Iterable<string>) => [...new Set(valeurs)].sort((a, b) => a.localeCompare(b, "fr"));
  const toutes = [...details.values()];
  const matieres = tri(toutes.flatMap((d) => d.matieres));
  const professeurs = tri(toutes.flatMap((d) => d.professeurs));
  const classes = tri(toutes.flatMap((d) => d.classes_sources));

  const visibles = liste.filter((g) => {
    const d = details.get(g.id);
    if (filtres.q && !plat(g.label).includes(plat(filtres.q))) return false;
    if (filtres.type && g.kind !== filtres.type) return false;
    if (filtres.matiere && !d?.matieres.includes(filtres.matiere)) return false;
    if (filtres.professeur && !d?.professeurs.includes(filtres.professeur)) return false;
    if (filtres.classe && !d?.classes_sources.includes(filtres.classe)) return false;
    if (filtres.effectif === "vides" && g.effectif > 0) return false;
    if (filtres.effectif === "avec" && g.effectif === 0) return false;
    return true;
  });
  const filtre = Object.values(filtres).some((v) => v !== "");

  return (
    <>
      <RubriqueClasses actif="/admin/groupes" />
      <EnTetePage
        sourcil="Classes et groupes"
        titre="Groupes pédagogiques"
        sousTitre="Spécialités, langues, options, demi-groupes : un groupe réunit des élèves choisis, de plusieurs classes si besoin. Sa composition ne touche pas la classe principale des élèves."
        actions={
          liste.length > 0 ? (
            <a href="/admin/groupes/export" className="bouton bouton-secondaire" download>
              Exporter les membres (CSV)
            </a>
          ) : null
        }
      />
      <AideTrois pourquoi="Spécialités, langues, options : des élèves de plusieurs classes suivent un même cours, sans quitter leur classe." quiVoit="Seuls les membres du groupe et ses professeurs voient ses cours. Les autres élèves des mêmes classes, non." apres="Ajoutez les élèves, affectez un professeur pour une matière : le cours apparaît chez eux aussitôt." />

      <CreerGroupe />
      <p className="meta m-0 mt-2">
        Beaucoup de groupes à créer ? <Link href="/admin/import#groupes">Importez-les depuis un fichier</Link>.
      </p>

      <section className="mt-8" aria-labelledby="liste">
        <h2 id="liste" className="titre-section mb-3 flex items-center gap-2">
          Groupes <span className="nombre">{filtre ? `${visibles.length} / ${liste.length}` : liste.length}</span>
        </h2>

        {liste.length > 0 ? (
          <form method="get" action="/admin/groupes" className="panneau mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6 md:items-end" role="search" aria-label="Chercher un groupe">
            <div className="md:col-span-3 xl:col-span-2">
              <label className="etiquette" htmlFor="g-q">
                Nom du groupe
              </label>
              <input id="g-q" name="q" type="search" defaultValue={filtres.q} className="champ" placeholder="Spé Maths, Anglais B…" maxLength={80} />
            </div>
            <Choix id="g-type" nom="type" libelle="Type" valeur={filtres.type} options={[["interclasses", "Interclasses"], ["sous_groupe", "Demi-groupe"]]} />
            <Choix id="g-matiere" nom="matiere" libelle="Matière" valeur={filtres.matiere} options={matieres.map((m) => [m, m])} />
            <Choix id="g-prof" nom="professeur" libelle="Professeur" valeur={filtres.professeur} options={professeurs.map((m) => [m, m])} />
            <Choix id="g-classe" nom="classe" libelle="Classe d'origine" valeur={filtres.classe} options={classes.map((m) => [m, m])} />
            <Choix id="g-effectif" nom="effectif" libelle="Effectif" valeur={filtres.effectif} options={[["avec", "Avec des élèves"], ["vides", "Vides"]]} />
            <div className="flex flex-wrap gap-2 md:col-span-3 xl:col-span-6">
              <button type="submit" className="bouton bouton-secondaire bouton-compact">
                <Search {...ICONE} /> Filtrer
              </button>
              {filtre ? (
                <Link href="/admin/groupes" className="bouton bouton-discret bouton-compact">
                  Tout afficher
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}

        {liste.length === 0 ? (
          <EtatVide
            icone={Layers}
            titre="Aucun groupe pour l'instant."
            texte="Créez-en un avec le formulaire ci-dessus, puis ajoutez-y des élèves et affectez un professeur."
          />
        ) : visibles.length === 0 ? (
          <EtatVide icone={Search} titre="Aucun groupe ne correspond." texte="Retirez un filtre, ou cherchez un autre nom." />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((g) => {
              const d = details.get(g.id);
              return (
                <li key={g.id}>
                  <Link href={`/admin/groupes/${g.id}`} className="carte-chiffre carte-souleve min-h-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="tuile" aria-hidden="true">
                        {g.kind === "interclasses" ? <Layers size={20} strokeWidth={1.75} /> : <Users size={20} strokeWidth={1.75} />}
                      </span>
                      <span className="etiquette-etat">{g.kind === "interclasses" ? "Interclasses" : "Demi-groupe"}</span>
                    </span>
                    <span className="mt-2 block font-bold">{g.label}</span>
                    <span className="meta">
                      {g.annee}
                      {d && d.matieres.length > 0 ? ` · ${d.matieres.join(", ")}` : ""}
                    </span>
                    {d && d.professeurs.length > 0 ? <span className="meta">{d.professeurs.join(", ")}</span> : null}
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="meta">
                        {g.effectif} élève{g.effectif > 1 ? "s" : ""} · {g.cours} cours
                      </span>
                      <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-accent)]" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Choix({ id, nom, libelle, valeur, options }: { id: string; nom: string; libelle: string; valeur: string; options: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <label className="etiquette" htmlFor={id}>
        {libelle}
      </label>
      <select id={id} name={nom} defaultValue={valeur} className="champ">
        <option value="">Tous</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

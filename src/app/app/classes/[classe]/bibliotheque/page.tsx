import Link from "next/link";
import { BadgeCheck, Library } from "lucide-react";
import { FormulaireRessource } from "@/components/study/classe-formulaires";
import { EtatVide, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { bibliotheque, droits as lireDroits, nomsAffichables } from "@/lib/v6/classe";
import { statutRessource } from "../../actions";

export const metadata = { title: "Bibliothèque de classe" };
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { explication: "Explication", fiche: "Fiche", methode: "Méthode", lien: "Lien utile" };

/**
 * E13 — Bibliothèque de classe : les explications réutilisables. Auteur,
 * statut et version sur chaque ressource ; un professeur valide ou retire ;
 * une ressource retirée disparaît pour la classe (et de la recherche). Les
 * fiches personnelles n'y apparaissent que si leur auteur les propose.
 */
export default async function PageBibliotheque({
  params,
  searchParams,
}: {
  params: Promise<{ classe: string }>;
  searchParams: Promise<{ type?: string; message?: string; fiche?: string; titre?: string }>;
}) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const filtres = await searchParams;
  const [ressources, droits] = await Promise.all([bibliotheque(ctx.jeton, classe), lireDroits(ctx.jeton, classe)]);
  const noms = await nomsAffichables(ctx.jeton, ressources.map((r) => r.auteur_id));
  const type = filtres.type && TYPES[filtres.type] ? filtres.type : null;
  const visibles = ressources.filter((r) => (type ? r.kind === type : true) && (r.statut !== "retiree" || droits.enseignant));
  const proposition = Boolean(filtres.message || filtres.fiche);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <nav aria-label="Filtrer par type" className="mb-4 flex flex-wrap gap-2">
          <Link href={`/app/classes/${classe}/bibliotheque`} className="etiquette-etat no-underline" data-ton={type ? undefined : "rose"} aria-current={type ? undefined : "page"}>
            Tout
          </Link>
          {Object.entries(TYPES).map(([cle, libelle]) => (
            <Link
              key={cle}
              href={`/app/classes/${classe}/bibliotheque?type=${cle}`}
              className="etiquette-etat no-underline"
              data-ton={type === cle ? "rose" : undefined}
              aria-current={type === cle ? "page" : undefined}
            >
              {libelle}
            </Link>
          ))}
        </nav>
        {visibles.length === 0 ? (
          <EtatVide
            icone={Library}
            titre="La bibliothèque est encore vide"
            texte="Les explications utiles de la classe se rangent ici : une réponse de professeur marquée « À retenir », une fiche partagée, une méthode."
          />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {visibles.map((r) => (
              <li key={r.id} className="panneau">
                <div className="flex flex-wrap items-center gap-2">
                  <Etiquette>{TYPES[r.kind] ?? r.kind}</Etiquette>
                  {r.statut === "validee" ? (
                    <Etiquette ton="succes">
                      <BadgeCheck size={14} strokeWidth={1.75} aria-hidden="true" /> Validée par un professeur
                    </Etiquette>
                  ) : r.statut === "retiree" ? (
                    <Etiquette ton="erreur">Retirée</Etiquette>
                  ) : (
                    <Etiquette ton="attention">Proposée, non validée</Etiquette>
                  )}
                </div>
                <h3 className="titre-bloc mt-3">{r.titre}</h3>
                <p className="m-0 mt-2 line-clamp-6 whitespace-pre-line text-[0.875rem]">{r.corps}</p>
                <p className="meta m-0 mt-3">
                  {noms.get(r.auteur_id)?.affichage ?? "Membre de la classe"} · {dateLisible(r.created_at, { day: "numeric", month: "short" })} · version {r.version}
                  {r.source_message_id ? " · issue du salon" : r.source_fiche_id ? " · issue d'une fiche" : ""}
                </p>
                {droits.enseignant ? (
                  <form action={statutRessource} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="ressource" value={r.id} />
                    <input type="hidden" name="classe" value={classe} />
                    <input type="hidden" name="version" value={r.version} />
                    {r.statut !== "validee" ? (
                      <button type="submit" name="statut" value="validee" className="bouton bouton-secondaire bouton-compact">
                        Valider
                      </button>
                    ) : (
                      <button type="submit" name="statut" value="proposee" className="bouton bouton-discret bouton-compact">
                        Retirer la validation
                      </button>
                    )}
                    {r.statut !== "retiree" ? (
                      <button type="submit" name="statut" value="retiree" className="bouton bouton-discret bouton-compact">
                        Retirer de la bibliothèque
                      </button>
                    ) : null}
                  </form>
                ) : r.auteur_id === ctx.personne.profileId && r.statut !== "retiree" ? (
                  <form action={statutRessource} className="mt-3">
                    <input type="hidden" name="ressource" value={r.id} />
                    <input type="hidden" name="classe" value={classe} />
                    <input type="hidden" name="version" value={r.version} />
                    <button type="submit" name="statut" value="retiree" className="bouton bouton-discret bouton-compact">
                      Retirer ma proposition
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Panneau titre={proposition ? "Proposer cette ressource" : "Partager une explication"} as="aside">
        <FormulaireRessource classe={classe} message={filtres.message} fiche={filtres.fiche} titre={filtres.titre} />
      </Panneau>
    </div>
  );
}

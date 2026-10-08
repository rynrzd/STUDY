import Link from "next/link";
import { Bot, Newspaper } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes, dateLisible } from "@/components/study/ui";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAteliers({ type, error, ateliers, filtres }: {
  type: string | undefined;
  error: unknown;
  ateliers: readonly { id: string; titre: string; kind: string; etat: string; published_at: string | null; question: string }[];
  filtres: readonly { cle: string | null; libelle: string }[];
}) {
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage sourcil="Ateliers" titre="Lire, vérifier, répondre" sousTitre="Lire des sources datées, puis répondre. Proposés par tes professeurs." />
      <nav aria-label="Filtrer les ateliers" className="mb-5 flex flex-wrap gap-2">
        {filtres.map((f) => (
          <Link
            key={f.libelle}
            href={f.cle ? `/app/ateliers?type=${f.cle}` : "/app/ateliers"}
            aria-current={(type ?? null) === f.cle ? "page" : undefined}
            className="pilule"
          >
            {f.libelle}
          </Link>
        ))}
      </nav>
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Les ateliers n&apos;ont pas pu être chargés. Réessaie dans un instant.
        </p>
      ) : ateliers.length === 0 ? (
        <EtatVide icone={Newspaper} titre="Aucun atelier pour l'instant" texte="Quand un professeur en publiera un pour l'une de tes classes, il apparaîtra ici." />
      ) : (
        <ListeLignes>
          {ateliers.map((a) => (
            <Ligne
              key={a.id}
              href={`/app/ateliers/${a.id}`}
              icone={a.kind === "actualite" ? Newspaper : Bot}
              titre={a.titre}
              detail={<span className="block truncate">{a.question}</span>}
              fin={
                <>
                  <Etiquette ton={a.kind === "actualite" ? "rose" : "neutre"}>{a.kind === "actualite" ? "Actualité" : "Vérifier l'IA"}</Etiquette>
                  {a.etat === "clos" ? <Etiquette>Clos</Etiquette> : null}
                  {a.published_at ? <span className="meta hidden sm:inline">{dateLisible(a.published_at, { day: "numeric", month: "short" })}</span> : null}
                </>
              }
            />
          ))}
        </ListeLignes>
      )}
    </div>
  );
}

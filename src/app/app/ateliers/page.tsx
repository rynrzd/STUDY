import Link from "next/link";
import { EnTetePage, EtatVide, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata = { title: "Ateliers" };
export const dynamic = "force-dynamic";

/**
 * A18 — Ateliers publiés par les professeurs (actualité, vérifier une réponse
 * d'IA). Lecture sous le jeton de l'élève : la politique de la table ne rend
 * que les ateliers de ses enseignements, publiés ou clos. Aucun contenu
 * d'actualité n'est produit ici.
 */
export default async function PageAteliers({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await contexteApp();
  const { type } = await searchParams;
  let requete = clientUtilisateur(ctx.jeton)
    .from("ateliers")
    .select("id, titre, kind, etat, published_at, question")
    .neq("etat", "brouillon")
    .order("published_at", { ascending: false })
    .limit(60);
  if (type === "actualite" || type === "verifier_ia") requete = requete.eq("kind", type);
  const { data, error } = await requete;
  const ateliers = (data ?? []) as { id: string; titre: string; kind: string; etat: string; published_at: string | null; question: string }[];
  const filtres = [
    { cle: null, libelle: "Tous" },
    { cle: "actualite", libelle: "Actualité" },
    { cle: "verifier_ia", libelle: "Vérifier une réponse d'IA" },
  ];
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage titre="Ateliers" sousTitre="Lire des sources datées, puis répondre. Proposés par tes professeurs." />
      <nav aria-label="Filtrer les ateliers" className="mb-5 flex flex-wrap gap-2">
        {filtres.map((f) => (
          <Link
            key={f.libelle}
            href={f.cle ? `/app/ateliers?type=${f.cle}` : "/app/ateliers"}
            aria-current={(type ?? null) === f.cle ? "page" : undefined}
            className={`bouton bouton-compact ${(type ?? null) === f.cle ? "bouton-primaire" : "bouton-secondaire"}`}
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
        <EtatVide titre="Aucun atelier pour l'instant" texte="Quand un professeur en publiera un pour l'une de tes classes, il apparaîtra ici." />
      ) : (
        <Panneau>
          <ul className="m-0 list-none p-0">
            {ateliers.map((a) => (
              <li key={a.id} className="ligne">
                <span className="min-w-0 flex-1">
                  <Link href={`/app/ateliers/${a.id}`} className="block font-semibold">
                    {a.titre}
                  </Link>
                  <span className="meta block truncate">{a.question}</span>
                </span>
                <Etiquette ton={a.kind === "actualite" ? "rose" : "neutre"}>{a.kind === "actualite" ? "Actualité" : "Vérifier l'IA"}</Etiquette>
                {a.etat === "clos" ? <Etiquette>Clos</Etiquette> : null}
                {a.published_at ? <span className="meta hidden sm:inline">{dateLisible(a.published_at, { day: "numeric", month: "short" })}</span> : null}
              </li>
            ))}
          </ul>
        </Panneau>
      )}
    </div>
  );
}

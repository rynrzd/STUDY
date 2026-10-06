import Link from "next/link";
import { AccesIndisponible, EnTetePage, Etiquette, Panneau } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata = { title: "Ateliers" };
export const dynamic = "force-dynamic";

/** E38/E39 côté professeur : ses ateliers et la création d'un brouillon. */
export default async function PageAteliersProf() {
  const ctx = await contexteApp();
  if (!ctx.roles.professeur) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const [ateliers, cours] = await Promise.all([
    client.from("ateliers").select("id, kind, titre, etat, created_by").eq("created_by", ctx.personne.profileId).order("created_at", { ascending: false }),
    client.rpc("mes_cours"),
  ]);
  const espaces = ((cours.data ?? []) as { id: string; matiere: string; classe: string | null; enseigne: boolean }[])
    .filter((c) => c.enseigne)
    .map((c) => ({ id: c.id, libelle: `${c.matiere}${c.classe ? ` — ${c.classe}` : ""}` }));
  const liste = (ateliers.data ?? []) as { id: string; kind: string; titre: string; etat: string }[];
  return (
    <>
      <EnTetePage titre="Ateliers" sousTitre="Distinguer faits et interprétations ; vérifier une réponse d'IA avec les sources du cours." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <Panneau titre="Mes ateliers">
          {liste.length === 0 ? <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun atelier pour l&apos;instant.</p> : null}
          <ul className="m-0 list-none p-0">
            {liste.map((a) => (
              <li key={a.id} className="ligne">
                <Link href={a.etat === "brouillon" ? `/app/prof/ateliers/${a.id}/assistant` : `/app/prof/ateliers/${a.id}`} className="min-w-0 flex-1">
                  {a.titre}
                </Link>
                <span className="meta">{a.kind === "actualite" ? "Actualité" : "Vérifier une réponse d'IA"}</span>
                <Etiquette ton={a.etat === "publie" ? "succes" : a.etat === "clos" ? "neutre" : "attention"}>{a.etat === "publie" ? "Publié" : a.etat === "clos" ? "Clos" : "Brouillon"}</Etiquette>
              </li>
            ))}
          </ul>
        </Panneau>
        <Panneau titre="Nouvel atelier" as="aside">
          <p className="m-0 text-[color:var(--color-encre-faible)]">Quatre étapes : objectif, documents datés, consignes, corrigé. Le brouillon est enregistré à chaque étape.</p>
          {espaces.length === 0 ? (
            <p className="meta m-0 mt-3">Aucun cours ne vous est affecté : un atelier s&apos;adresse aux élèves d&apos;un de vos cours.</p>
          ) : (
            <Link href="/app/prof/ateliers/nouveau" className="bouton bouton-primaire mt-4">
              Créer un atelier
            </Link>
          )}
        </Panneau>
      </div>
    </>
  );
}

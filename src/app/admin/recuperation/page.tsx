import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnTetePage, EtatVide, Panneau, dateHeure } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata = { title: "Demandes d'accès" };
export const dynamic = "force-dynamic";

async function marquerTraitee(donnees: FormData) {
  "use server";
  const id = z.string().uuid().safeParse(String(donnees.get("demande") ?? ""));
  if (!id.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("recuperation_traiter", { p_demande: id.data });
  revalidatePath("/admin/recuperation");
}

/**
 * Demandes de récupération d'accès (E31, côté établissement). Study n'envoie
 * aucun courrier : l'administration vérifie l'identité en personne, puis
 * remet un nouvel accès (fiche imprimée ou lien d'invitation).
 */
export default async function PageRecuperation() {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const { data, error } = await clientUtilisateur(ctx.jeton).rpc("recuperation_a_traiter");
  const demandes = (data ?? []) as { id: string; prenom: string; nom: string; identifiant: string; classe: string | null; demandee_le: string }[];
  return (
    <div className="mx-auto max-w-[900px]">
      <EnTetePage titre="Demandes d'accès" sousTitre="Des personnes signalent avoir perdu leur accès. Vérifiez leur identité avant de remettre un nouvel accès." />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Ces demandes n&apos;ont pas pu être chargées. Le second facteur de votre session est-il validé ?
        </p>
      ) : demandes.length === 0 ? (
        <EtatVide titre="Aucune demande en attente" texte="Les demandes faites depuis « Accès oublié » apparaissent ici, et seulement pour les comptes de votre établissement." />
      ) : (
        <Panneau>
          <ul className="m-0 list-none p-0">
            {demandes.map((d) => (
              <li key={d.id} className="ligne flex-wrap">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {d.prenom} {d.nom}
                  </span>
                  <span className="meta">
                    {d.identifiant}
                    {d.classe ? ` · ${d.classe}` : ""} · demandé le {dateHeure(d.demandee_le)}
                  </span>
                </span>
                <Link href={`/admin/utilisateurs?q=${encodeURIComponent(d.identifiant)}`} className="bouton bouton-secondaire bouton-compact">
                  Réinitialiser l&apos;accès
                </Link>
                <form action={marquerTraitee}>
                  <input type="hidden" name="demande" value={d.id} />
                  <button type="submit" className="bouton bouton-discret bouton-compact">
                    Marquer traitée
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Panneau>
      )}
    </div>
  );
}

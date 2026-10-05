import Link from "next/link";
import { MessageSquareLock, Plus } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, ICONE, Panneau, dateHeure } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";

export const metadata = { title: "Demandes personnelles" };
export const dynamic = "force-dynamic";

export default async function PageDemandes() {
  const ctx = await contexteApp();
  const { data } = await clientUtilisateur(ctx.jeton)
    .from("demandes_adulte")
    .select("id, subject, state, created_at, author_id, recipient_id")
    .order("created_at", { ascending: false })
    .limit(50);
  const lignes = (data ?? []) as { id: string; subject: string; state: string; created_at: string; author_id: string; recipient_id: string }[];
  const noms = await nomsAffichables(ctx.jeton, lignes.flatMap((l) => [l.author_id, l.recipient_id]));
  return (
    <>
      <EnTetePage
        titre="Demandes personnelles"
        sousTitre="Un échange privé avec un adulte qui t'encadre, hors du salon de classe."
        actions={
          ctx.roles.eleve ? (
            <Link href="/app/demandes/nouvelle" className="bouton bouton-primaire">
              <Plus {...ICONE} /> Nouvelle demande
            </Link>
          ) : null
        }
      />
      {lignes.length === 0 ? (
        <EtatVide icone={MessageSquareLock} titre="Aucune demande" texte="Les demandes envoyées et reçues apparaissent ici. Elles ne sont visibles que par leur auteur et leur destinataire." />
      ) : (
        <Panneau>
          <ul className="m-0 list-none p-0">
            {lignes.map((l) => {
              const autre = l.author_id === ctx.personne.profileId ? l.recipient_id : l.author_id;
              return (
                <li key={l.id} className="ligne">
                  <Link href={`/app/demandes/${l.id}`} className="min-w-0 flex-1 no-underline">
                    <span className="block truncate font-semibold text-[color:var(--color-encre)]">{l.subject}</span>
                    <span className="meta">
                      {l.author_id === ctx.personne.profileId ? "À" : "De"} {noms.get(autre)?.affichage ?? "—"} · {dateHeure(l.created_at)}
                    </span>
                  </Link>
                  <Etiquette ton={l.state === "ouverte" ? "rose" : "neutre"}>{l.state === "ouverte" ? "Ouverte" : "Close"}</Etiquette>
                </li>
              );
            })}
          </ul>
        </Panneau>
      )}
    </>
  );
}

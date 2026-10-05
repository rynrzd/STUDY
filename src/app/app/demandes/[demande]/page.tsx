import { AccesIndisponible, EnTetePage, Etiquette, Panneau, dateHeure } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { clore } from "../actions";
import { FormulaireReponseDemande } from "../formulaires";

export const metadata = { title: "Demande personnelle" };
export const dynamic = "force-dynamic";

export default async function PageDemande({ params, searchParams }: { params: Promise<{ demande: string }>; searchParams: Promise<{ envoyee?: string }> }) {
  const ctx = await contexteApp();
  const { demande: id } = await params;
  const { envoyee } = await searchParams;
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const [d, messages] = await Promise.all([
    client.from("demandes_adulte").select("id, subject, state, author_id, recipient_id, created_at").eq("id", id).maybeSingle(),
    client.from("demandes_adulte_messages").select("id, author_id, body, created_at").eq("demande_id", id).order("created_at"),
  ]);
  const demande = d.data as { id: string; subject: string; state: string; author_id: string; recipient_id: string } | null;
  if (demande === null) return <AccesIndisponible retour="/app/demandes" />;
  const lignes = (messages.data ?? []) as { id: string; author_id: string; body: string; created_at: string }[];
  const noms = await nomsAffichables(ctx.jeton, [demande.author_id, demande.recipient_id]);

  return (
    <div className="mx-auto max-w-[760px]">
      <EnTetePage
        filAriane={[{ href: "/app/demandes", libelle: "Demandes personnelles" }]}
        titre={demande.subject}
        sousTitre={`Entre ${noms.get(demande.author_id)?.affichage ?? "—"} et ${noms.get(demande.recipient_id)?.affichage ?? "—"} · personne d'autre ne lit cet échange.`}
      />
      {envoyee ? (
        <p role="status" className="mb-4 rounded-[10px] bg-[color:var(--color-succes-fond)] p-3 text-[color:var(--color-succes)]">
          Demande envoyée. La réponse apparaîtra dans tes notifications.
        </p>
      ) : null}
      <Panneau>
        <ol className="m-0 list-none p-0">
          {lignes.map((m) => (
            <li key={m.id} className="ligne items-start">
              <span className="min-w-0 flex-1">
                <span className="meta block">
                  {noms.get(m.author_id)?.affichage ?? "—"} · {dateHeure(m.created_at)}
                </span>
                <p className="m-0 mt-1 whitespace-pre-wrap">{m.body}</p>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          {demande.state === "ouverte" ? (
            <>
              <FormulaireReponseDemande demande={id} />
              <form action={clore} className="mt-3">
                <input type="hidden" name="demande" value={id} />
                <button type="submit" className="bouton bouton-discret bouton-compact">
                  Clore la demande
                </button>
              </form>
            </>
          ) : (
            <Etiquette>Demande close</Etiquette>
          )}
        </div>
      </Panneau>
    </div>
  );
}

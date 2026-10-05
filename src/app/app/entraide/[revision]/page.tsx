import Link from "next/link";
import { AccesIndisponible, EnTetePage, Etiquette, Panneau, dateHeure } from "@/components/study/ui";
import { Confirmer } from "@/components/study/Dialogue";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { inscriptionRevision } from "../../classes/actions";

export const metadata = { title: "Révision collective" };
export const dynamic = "force-dynamic";

/**
 * E25 — Révision collective volontaire. Inscription atomique sous capacité,
 * sans doublon ; les participants se voient entre eux (ils ont consenti en
 * s'inscrivant) ; les résultats restent individuels. Pas de visioconférence.
 */
export default async function PageRevisionCollective({
  params,
  searchParams,
}: {
  params: Promise<{ revision: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const ctx = await contexteApp();
  const { revision } = await params;
  const { erreur } = await searchParams;
  if (!/^[0-9a-f-]{36}$/iu.test(revision)) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const lue = await client
    .from("revisions_collectives")
    .select("id, class_id, titre, deroule, debut, duree_minutes, capacite, etat, organisateur_id")
    .eq("id", revision)
    .maybeSingle();
  const r = lue.data as {
    id: string;
    class_id: string;
    titre: string;
    deroule: string | null;
    debut: string;
    duree_minutes: number;
    capacite: number;
    etat: string;
    organisateur_id: string;
  } | null;
  if (r === null) return <AccesIndisponible />;
  const inscrits = await client.from("revisions_collectives_inscrits").select("profile_id").eq("revision_id", revision);
  const ids = ((inscrits.data ?? []) as { profile_id: string }[]).map((i) => i.profile_id);
  const noms = await nomsAffichables(ctx.jeton, [...ids, r.organisateur_id]);
  const inscrit = ids.includes(ctx.personne.profileId);
  const organisateur = r.organisateur_id === ctx.personne.profileId;
  const passee = new Date(r.debut) <= new Date();
  const complet = !inscrit && ids.length >= r.capacite;

  return (
    <div className="mx-auto max-w-[760px]">
      <EnTetePage
        filAriane={[{ href: `/app/classes/${r.class_id}`, libelle: "Ma classe" }]}
        sourcil="Révision collective"
        titre={r.titre}
        sousTitre={`${dateHeure(r.debut)} · ${r.duree_minutes} min · organisée par ${noms.get(r.organisateur_id)?.affichage ?? "un membre de la classe"}`}
      />
      {erreur ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-[color:var(--color-erreur-fond)] p-3 text-[color:var(--color-erreur)]">
          {erreur === "COMPLET" ? "La séance est complète." : "L'inscription n'a pas pu être enregistrée."}
        </p>
      ) : null}
      <div className="grid gap-6">
        <Panneau titre="Déroulé">
          <p className="m-0 whitespace-pre-line">{r.deroule ?? "Questions individuelles d'abord, puis discussion."}</p>
          <p className="meta m-0 mt-3">Chacun répond d&apos;abord seul ; les résultats restent personnels. La discussion vient ensuite.</p>
        </Panneau>
        <Panneau titre={`Participants (${ids.length}/${r.capacite})`}>
          {inscrit || organisateur ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {ids.map((id) => (
                <li key={id}>
                  <Etiquette>{noms.get(id)?.affichage ?? "Participant"}</Etiquette>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[color:var(--color-encre-faible)]">La liste des participants est visible une fois inscrit.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {r.etat !== "ouverte" ? (
              <Etiquette ton={r.etat === "annulee" ? "erreur" : "neutre"}>{r.etat === "annulee" ? "Annulée" : "Terminée"}</Etiquette>
            ) : passee ? (
              <Etiquette>Commencée</Etiquette>
            ) : (
              <form action={inscriptionRevision}>
                <input type="hidden" name="revision" value={r.id} />
                <input type="hidden" name="classe" value={r.class_id} />
                <input type="hidden" name="action" value={inscrit ? "desinscrire" : "inscrire"} />
                <button type="submit" className={`bouton ${inscrit ? "bouton-secondaire" : "bouton-primaire"}`} disabled={complet}>
                  {inscrit ? "Me désinscrire" : complet ? "Complet" : "Rejoindre"}
                </button>
              </form>
            )}
            {organisateur && r.etat === "ouverte" ? (
              <Confirmer variante="discret" declencheur="Annuler la séance" titre="Annuler cette séance ?" impact={<p className="m-0">Les participants verront qu&apos;elle est annulée, sans motif affiché.</p>}>
                <form action={inscriptionRevision}>
                  <input type="hidden" name="revision" value={r.id} />
                  <input type="hidden" name="classe" value={r.class_id} />
                  <input type="hidden" name="action" value="annuler" />
                  <button type="submit" className="bouton bouton-danger">
                    Annuler la séance
                  </button>
                </form>
              </Confirmer>
            ) : null}
            <Link href={`/app/classes/${r.class_id}/salons`} className="bouton bouton-discret">
              Ouvrir la messagerie de la classe
            </Link>
          </div>
        </Panneau>
      </div>
    </div>
  );
}

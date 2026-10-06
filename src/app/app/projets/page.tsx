import Link from "next/link";
import { Compass, FolderKanban, Lock, Users } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { repondreInvitation } from "./actions";
import { FormulaireProjet } from "./formulaires";

export const metadata = { title: "Mes projets" };
export const dynamic = "force-dynamic";

/**
 * E14 — Mes projets. Personnels (privés) ou de groupe (sur invitation
 * acceptée). Pas d'accès administratif implicite aux projets privés.
 */
export default async function PageProjets() {
  const ctx = await contexteApp();
  const client = clientUtilisateur(ctx.jeton);
  const [projets, membres, taches] = await Promise.all([
    client.from("projets").select("id, titre, description, visibilite, class_id, updated_at, archived_at").is("archived_at", null).order("updated_at", { ascending: false }),
    client.from("projet_membres").select("projet_id, profile_id, etat, role"),
    client.from("projet_taches").select("projet_id, titre, statut, echeance").neq("statut", "termine").order("echeance", { ascending: true, nullsFirst: false }),
  ]);
  const lignes = (projets.data ?? []) as { id: string; titre: string; description: string | null; visibilite: string; updated_at: string }[];
  const mesInvitations = ((membres.data ?? []) as { projet_id: string; profile_id: string; etat: string }[]).filter(
    (m) => m.profile_id === ctx.personne.profileId && m.etat === "invite",
  );
  const participants = (id: string) => ((membres.data ?? []) as { projet_id: string; etat: string }[]).filter((m) => m.projet_id === id && m.etat === "actif").length;
  const prochaine = (id: string) => ((taches.data ?? []) as { projet_id: string; titre: string; echeance: string | null }[]).find((t) => t.projet_id === id);
  const invitations = lignes.filter((p) => mesInvitations.some((i) => i.projet_id === p.id));
  const actifs = lignes.filter((p) => !mesInvitations.some((i) => i.projet_id === p.id));

  return (
    <>
      <EnTetePage
        titre="Mes projets"
        sousTitre="Projets personnels et projets de groupe, avec leurs tâches et documents."
        actions={
          <Link href="/app/orientation" className="bouton bouton-secondaire">
            <Compass {...ICONE} /> Orientation et stages
          </Link>
        }
      />
      {invitations.length > 0 ? (
        <Panneau titre="Invitations reçues" className="mb-6">
          <ul className="m-0 list-none p-0">
            {invitations.map((p) => (
              <li key={p.id} className="ligne">
                <span className="min-w-0 flex-1 font-semibold">{p.titre}</span>
                <form action={repondreInvitation} className="flex gap-2">
                  <input type="hidden" name="projet" value={p.id} />
                  <button type="submit" name="accepter" value="oui" className="bouton bouton-primaire bouton-compact">
                    Accepter
                  </button>
                  <button type="submit" name="accepter" value="non" className="bouton bouton-discret bouton-compact">
                    Refuser
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Panneau>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {actifs.length === 0 ? (
            <EtatVide icone={FolderKanban} titre="Pas encore de projet" texte="Un exposé, un dossier, un club, une idée à creuser : crée un projet pour organiser les tâches et les documents." />
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
              {actifs.map((p) => {
                const t = prochaine(p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/app/projets/${p.id}`} className="panneau block h-full no-underline hover:border-[color:var(--color-bordure-forte)]">
                      <span className="flex items-center justify-between gap-2">
                        <span className="titre-bloc font-bold text-[color:var(--color-encre)]">{p.titre}</span>
                        <Etiquette ton={p.visibilite === "prive" ? "neutre" : "rose"}>
                          {p.visibilite === "prive" ? <Lock size={12} strokeWidth={1.75} aria-hidden="true" /> : <Users size={12} strokeWidth={1.75} aria-hidden="true" />}
                          {p.visibilite === "prive" ? "Privé" : "Groupe"}
                        </Etiquette>
                      </span>
                      {p.description ? <span className="meta mt-1 block line-clamp-2">{p.description}</span> : null}
                      <span className="meta mt-3 block">
                        {participants(p.id)} participant{participants(p.id) > 1 ? "s" : ""} · {t ? `Prochaine étape : ${t.titre}${t.echeance ? ` (${dateLisible(t.echeance, { day: "numeric", month: "short" })})` : ""}` : "Aucune tâche en cours"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Panneau titre="Nouveau projet" as="aside">
          <FormulaireProjet classes={ctx.contextes.filter((c) => c.role !== "professeur").map((c) => ({ id: c.classe, libelle: c.libelle }))} />
        </Panneau>
      </div>
    </>
  );
}

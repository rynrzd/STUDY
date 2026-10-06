import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageCircle, Trash2 } from "lucide-react";
import { Confirmer } from "@/components/study/Dialogue";
import { AccesIndisponible, EnTetePage, Etiquette, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { membres as membresClasse, nomsAffichables } from "@/lib/v6/classe";
import { archiverProjet, modifierTache, retirerMembre, supprimerTache } from "../actions";
import { FormulaireInvitationProjet, FormulaireNote, FormulaireTache } from "../formulaires";

export const metadata = { title: "Projet" };
export const dynamic = "force-dynamic";

const COLONNES = [
  { cle: "a_faire", libelle: "À faire" },
  { cle: "en_cours", libelle: "En cours" },
  { cle: "termine", libelle: "Terminé" },
] as const;

/**
 * E15 — Tableau de projet. Trois colonnes ; chaque déplacement a son bouton
 * (aucun glisser-déposer indispensable) ; chaque modification porte la
 * version lue, et un conflit est montré plutôt qu'écrasé.
 */
export default async function PageProjet({ params, searchParams }: { params: Promise<{ projet: string }>; searchParams: Promise<{ conflit?: string }> }) {
  const ctx = await contexteApp();
  const { projet: id } = await params;
  const { conflit } = await searchParams;
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return <AccesIndisponible retour="/app/projets" />;
  const client = clientUtilisateur(ctx.jeton);
  const [p, membresP, taches, notes, salon, editeur] = await Promise.all([
    client.from("projets").select("id, titre, description, visibilite, class_id, owner_id, archived_at").eq("id", id).maybeSingle(),
    client.from("projet_membres").select("profile_id, role, etat").eq("projet_id", id),
    client.from("projet_taches").select("id, titre, statut, responsable, echeance, version, position").eq("projet_id", id).order("position"),
    client.from("projet_notes").select("id, kind, titre, corps, url, auteur_id, created_at").eq("projet_id", id).order("created_at", { ascending: false }),
    client.from("salons").select("id").eq("project_id", id).maybeSingle(),
    client.rpc("projet_editeur", { projet: id }),
  ]);
  const projet = p.data as { id: string; titre: string; description: string | null; visibilite: string; class_id: string | null; owner_id: string } | null;
  const lesMembres = (membresP.data ?? []) as { profile_id: string; role: string; etat: string }[];
  const moi = lesMembres.find((m) => m.profile_id === ctx.personne.profileId);
  if (projet === null || moi?.etat !== "actif") return <AccesIndisponible retour="/app/projets" />;

  const lesTaches = (taches.data ?? []) as { id: string; titre: string; statut: string; responsable: string | null; echeance: string | null; version: number }[];
  const lesNotes = (notes.data ?? []) as { id: string; kind: string; titre: string; corps: string | null; url: string | null; auteur_id: string; created_at: string }[];
  const noms = await nomsAffichables(ctx.jeton, [...lesMembres.map((m) => m.profile_id), ...lesNotes.map((n) => n.auteur_id)]);
  const actifs = lesMembres.filter((m) => m.etat === "actif");
  const peutModifier = editeur.data === true;
  const proprietaire = projet.owner_id === ctx.personne.profileId;
  const candidats =
    proprietaire && projet.visibilite === "groupe" && projet.class_id
      ? ((await membresClasse(ctx.jeton, projet.class_id)) ?? [])
          .filter((m) => !lesMembres.some((x) => x.profile_id === m.profileId && ["actif", "invite"].includes(x.etat)))
          .map((m) => ({ id: m.profileId, nom: m.affichage }))
      : [];
  const nom = (pid: string | null) => (pid ? (noms.get(pid)?.affichage ?? "Ancien membre") : "Volontaire à trouver");

  return (
    <>
      <EnTetePage
        filAriane={[{ href: "/app/projets", libelle: "Mes projets" }]}
        titre={projet.titre}
        sousTitre={projet.description}
        actions={
          <>
            <Etiquette ton={projet.visibilite === "prive" ? "neutre" : "rose"}>{projet.visibilite === "prive" ? "Privé" : "Groupe"}</Etiquette>
            {salon.data ? (
              <Link href={`/app/messagerie/${(salon.data as { id: string }).id}`} className="bouton bouton-secondaire">
                <MessageCircle {...ICONE} /> Discussion
              </Link>
            ) : null}
          </>
        }
      />
      {conflit === "1" ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-[color:var(--color-attention-fond)] p-3 text-[color:var(--color-attention)]">
          Quelqu&apos;un a modifié cette tâche entre-temps : le tableau a été rechargé avec la dernière version. Refais ton changement si besoin.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {COLONNES.map((col, ci) => {
          const liste = lesTaches.filter((t) => t.statut === col.cle);
          return (
            <section key={col.cle} className="rounded-[14px] bg-[color:var(--color-surface-douce)] p-4" aria-labelledby={`col-${col.cle}`}>
              <h2 id={`col-${col.cle}`} className="titre-bloc mb-3">
                {col.libelle} <span className="meta">({liste.length})</span>
              </h2>
              {liste.length === 0 ? <p className="meta m-0">Rien ici.</p> : null}
              <ul className="m-0 grid list-none gap-3 p-0">
                {liste.map((t) => (
                  <li key={t.id} className="panneau statut-change p-4 md:p-4">
                    <p className="m-0 font-semibold">{t.titre}</p>
                    <p className="meta m-0 mt-1">
                      {nom(t.responsable)}
                      {t.echeance ? ` · pour le ${dateLisible(t.echeance, { day: "numeric", month: "short" })}` : ""}
                    </p>
                    {peutModifier ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ci > 0 ? (
                          <form action={modifierTache}>
                            <input type="hidden" name="tache" value={t.id} />
                            <input type="hidden" name="projet" value={id} />
                            <input type="hidden" name="version" value={t.version} />
                            <input type="hidden" name="statut" value={COLONNES[ci - 1]!.cle} />
                            <button type="submit" className="bouton bouton-discret bouton-compact" aria-label={`Déplacer « ${t.titre} » vers ${COLONNES[ci - 1]!.libelle}`}>
                              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> {COLONNES[ci - 1]!.libelle}
                            </button>
                          </form>
                        ) : null}
                        {ci < COLONNES.length - 1 ? (
                          <form action={modifierTache}>
                            <input type="hidden" name="tache" value={t.id} />
                            <input type="hidden" name="projet" value={id} />
                            <input type="hidden" name="version" value={t.version} />
                            <input type="hidden" name="statut" value={COLONNES[ci + 1]!.cle} />
                            <button type="submit" className="bouton bouton-secondaire bouton-compact" aria-label={`Déplacer « ${t.titre} » vers ${COLONNES[ci + 1]!.libelle}`}>
                              {COLONNES[ci + 1]!.libelle} <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </form>
                        ) : null}
                        {t.responsable === null ? (
                          <form action={modifierTache}>
                            <input type="hidden" name="tache" value={t.id} />
                            <input type="hidden" name="projet" value={id} />
                            <input type="hidden" name="version" value={t.version} />
                            <input type="hidden" name="responsable" value={ctx.personne.profileId} />
                            <button type="submit" className="bouton bouton-discret bouton-compact">
                              Je m&apos;en charge
                            </button>
                          </form>
                        ) : null}
                        <Confirmer variante="discret" declencheur={<Trash2 size={14} strokeWidth={1.75} aria-label="Supprimer la tâche" />} titre="Supprimer cette tâche ?" impact={<p className="m-0">« {t.titre} » sera supprimée pour tous les participants.</p>}>
                          <form action={supprimerTache}>
                            <input type="hidden" name="tache" value={t.id} />
                            <input type="hidden" name="projet" value={id} />
                            <input type="hidden" name="version" value={t.version} />
                            <button type="submit" className="bouton bouton-danger">
                              Supprimer
                            </button>
                          </form>
                        </Confirmer>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          {peutModifier ? (
            <Panneau titre="Ajouter une tâche">
              <FormulaireTache projet={id} membres={actifs.map((m) => ({ id: m.profile_id, nom: nom(m.profile_id) }))} />
            </Panneau>
          ) : null}
          <Panneau titre="Documents et décisions">
            {lesNotes.length === 0 ? <p className="m-0 mb-4 text-[color:var(--color-encre-faible)]">Aucun document pour l&apos;instant.</p> : null}
            <ul className="m-0 mb-4 list-none p-0">
              {lesNotes.map((n) => (
                <li key={n.id} className="ligne items-start">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Etiquette>{n.kind === "decision" ? "Décision" : n.kind === "lien" ? "Lien" : "Document"}</Etiquette>
                      <span className="font-semibold">{n.titre}</span>
                    </span>
                    {n.corps ? <p className="m-0 mt-1 whitespace-pre-line text-[0.875rem]">{n.corps}</p> : null}
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="meta break-all">
                        {n.url}
                      </a>
                    ) : null}
                    <span className="meta block">
                      {nom(n.auteur_id)} · {dateLisible(n.created_at, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {peutModifier ? <FormulaireNote projet={id} /> : null}
          </Panneau>
        </div>
        <aside className="grid content-start gap-6">
          <Panneau titre="Participants">
            <ul className="m-0 list-none p-0">
              {lesMembres
                .filter((m) => m.etat === "actif" || m.etat === "invite")
                .map((m) => (
                  <li key={m.profile_id} className="ligne">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{nom(m.profile_id)}</span>
                      <span className="meta">
                        {m.role === "owner" ? "Responsable" : m.role === "editor" ? "Peut modifier" : "Lecture seule"}
                        {m.etat === "invite" ? " · invitation en attente" : ""}
                      </span>
                    </span>
                    {(proprietaire && m.profile_id !== ctx.personne.profileId) || (!proprietaire && m.profile_id === ctx.personne.profileId) ? (
                      <form action={retirerMembre}>
                        <input type="hidden" name="projet" value={id} />
                        <input type="hidden" name="profil" value={m.profile_id} />
                        <button type="submit" className="bouton bouton-discret bouton-compact">
                          {m.profile_id === ctx.personne.profileId ? "Quitter" : "Retirer"}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
            </ul>
            {proprietaire && projet.visibilite === "groupe" ? (
              <div className="mt-4">
                <FormulaireInvitationProjet projet={id} candidats={candidats} />
              </div>
            ) : null}
            <p className="meta m-0 mt-3">Retirer quelqu&apos;un coupe son accès au projet ; ses contributions restent.</p>
          </Panneau>
          {proprietaire ? (
            <Confirmer variante="discret" declencheur="Archiver le projet" titre="Archiver ce projet ?" impact={<p className="m-0">Le projet et sa discussion passeront en archive pour tous les participants.</p>}>
              <form action={archiverProjet}>
                <input type="hidden" name="projet" value={id} />
                <button type="submit" className="bouton bouton-danger">
                  Archiver
                </button>
              </form>
            </Confirmer>
          ) : null}
        </aside>
      </div>
    </>
  );
}

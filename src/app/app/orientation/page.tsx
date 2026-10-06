import { Compass } from "lucide-react";
import { Confirmer } from "@/components/study/Dialogue";
import { AvisVisibilite, EnTetePage, EtatVide, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { partagerPiste, supprimerPiste } from "./actions";
import { FormulaireModifierPiste, FormulairePiste } from "./formulaires";

export const metadata = { title: "Orientation et stages" };
export const dynamic = "force-dynamic";

const STATUTS: Record<string, string> = { a_explorer: "À explorer", a_contacter: "À contacter", contacte: "Contacté", reponse: "Réponse reçue", clos: "Clos" };

/**
 * E26 — Orientation et stages : un espace privé. Partager se fait piste par
 * piste, avec un adulte qui t'encadre ; aucune candidature n'est envoyée,
 * aucun profil n'est découvrable.
 */
export default async function PageOrientation() {
  const ctx = await contexteApp();
  const client = clientUtilisateur(ctx.jeton);
  const [pistes, partages, destinataires] = await Promise.all([
    client.from("orientation_pistes").select("id, owner_id, kind, intitule, organisation, statut, contact_pro, echeance, notes, version").order("updated_at", { ascending: false }),
    client.from("orientation_partages").select("piste_id, destinataire_id"),
    client.rpc("demande_destinataires"),
  ]);
  const lignes = (pistes.data ?? []) as {
    id: string;
    owner_id: string;
    kind: string;
    intitule: string;
    organisation: string | null;
    statut: string;
    contact_pro: string | null;
    echeance: string | null;
    notes: string | null;
    version: number;
  }[];
  const miennes = lignes.filter((l) => l.owner_id === ctx.personne.profileId);
  const recues = lignes.filter((l) => l.owner_id !== ctx.personne.profileId);
  const adultes = ((destinataires.data ?? []) as { profile_id: string; prenom: string; nom: string }[]).map((d) => ({ id: d.profile_id, nom: `${d.prenom} ${d.nom}` }));
  const lesPartages = (partages.data ?? []) as { piste_id: string; destinataire_id: string }[];
  const noms = await nomsAffichables(ctx.jeton, [...recues.map((r) => r.owner_id), ...lesPartages.map((p) => p.destinataire_id)]);
  const intentions = miennes.filter((m) => m.kind === "intention");
  const autres = miennes.filter((m) => m.kind !== "intention");

  return (
    <>
      <EnTetePage filAriane={[{ href: "/app/projets", libelle: "Mes projets" }]} titre="Orientation et stages" sousTitre="Tes envies, tes pistes et tes démarches, pour toi." />
      <div className="mb-6">
        <AvisVisibilite>
          Cet espace est privé : ni tes camarades, ni tes professeurs, ni l&apos;administration ne le voient. Tu peux partager une piste à la fois
          avec un adulte qui t&apos;encadre. Study n&apos;envoie aucune candidature à ta place.
        </AvisVisibilite>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          {miennes.length === 0 ? (
            <EtatVide icone={Compass} titre="Rien pour l'instant" texte="Note une envie, une formation qui t'intrigue, une entreprise pour un stage : tu pourras suivre chaque démarche ici." />
          ) : null}
          {intentions.length > 0 ? (
            <Panneau titre="Ce que j'aimerais">
              <ul className="m-0 grid list-none gap-2 p-0">
                {intentions.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span>{i.intitule}</span>
                    <form action={supprimerPiste}>
                      <input type="hidden" name="piste" value={i.id} />
                      <button type="submit" className="bouton bouton-discret bouton-compact">
                        Retirer
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Panneau>
          ) : null}
          {autres.map((p) => {
            const partagesPiste = lesPartages.filter((x) => x.piste_id === p.id);
            return (
              <section key={p.id} className="panneau">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Etiquette>{p.kind === "stage" ? "Stage" : "Piste"}</Etiquette>
                  <Etiquette ton={p.statut === "reponse" ? "succes" : p.statut === "clos" ? "neutre" : "rose"}>{STATUTS[p.statut]}</Etiquette>
                  {p.echeance ? <span className="meta">Échéance : {dateLisible(p.echeance)}</span> : null}
                </div>
                <FormulaireModifierPiste
                  piste={p.id}
                  version={p.version}
                  valeurs={{
                    intitule: p.intitule,
                    organisation: p.organisation ?? "",
                    statut: p.statut,
                    contact: p.contact_pro ?? "",
                    echeance: p.echeance ?? "",
                    notes: p.notes ?? "",
                  }}
                />
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[color:var(--color-bordure)] pt-4">
                  {partagesPiste.length > 0 ? (
                    <p className="meta m-0 w-full">Partagée avec : {partagesPiste.map((x) => noms.get(x.destinataire_id)?.affichage ?? "un adulte").join(", ")}</p>
                  ) : null}
                  {adultes.length > 0 ? (
                    <form action={partagerPiste} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="piste" value={p.id} />
                      <label className="sr-only" htmlFor={`dest-${p.id}`}>
                        Partager avec
                      </label>
                      <select id={`dest-${p.id}`} name="destinataire" className="champ w-auto min-h-[36px] py-1" defaultValue="">
                        <option value="" disabled>
                          Partager avec…
                        </option>
                        {adultes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nom}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="bouton bouton-secondaire bouton-compact">
                        Partager cette piste
                      </button>
                    </form>
                  ) : null}
                  <Confirmer variante="discret" declencheur="Supprimer" titre="Supprimer cette piste ?" impact={<p className="m-0">Elle et ses notes seront effacées.</p>}>
                    <form action={supprimerPiste}>
                      <input type="hidden" name="piste" value={p.id} />
                      <button type="submit" className="bouton bouton-danger">
                        Supprimer
                      </button>
                    </form>
                  </Confirmer>
                </div>
              </section>
            );
          })}
          {recues.length > 0 ? (
            <Panneau titre="Pistes partagées avec moi">
              <ul className="m-0 list-none p-0">
                {recues.map((r) => (
                  <li key={r.id} className="ligne items-start">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.intitule}</span>
                      <span className="meta">
                        {noms.get(r.owner_id)?.affichage ?? "Élève"} · {STATUTS[r.statut]}
                        {r.organisation ? ` · ${r.organisation}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panneau>
          ) : null}
        </div>
        <Panneau titre="Ajouter" as="aside">
          <FormulairePiste />
        </Panneau>
      </div>
    </>
  );
}

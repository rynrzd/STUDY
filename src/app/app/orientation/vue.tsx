import Link from "next/link";
import { Briefcase, Compass, GraduationCap, Heart } from "lucide-react";
import { Confirmer } from "@/components/study/Dialogue";
import { AvisVisibilite, EnTetePage, EtatVide, Etiquette, Panneau, TuileIcone, dateLisible } from "@/components/study/ui";
import type { nomsAffichables } from "@/lib/v6/classe";
import { partagerPiste, supprimerPiste } from "./actions";
import { FormulaireModifierPiste, FormulairePiste } from "./formulaires";

const STATUTS: Record<string, string> = { a_explorer: "À explorer", a_contacter: "À contacter", contacte: "Contacté", reponse: "Réponse reçue", clos: "Clos" };

export const FILTRES = [
  { cle: "toutes", libelle: "Tout" },
  { cle: "intention", libelle: "Envies" },
  { cle: "piste", libelle: "Pistes" },
  { cle: "stage", libelle: "Stages" },
] as const;

export interface Piste {
  readonly id: string;
  readonly owner_id: string;
  readonly kind: string;
  readonly intitule: string;
  readonly organisation: string | null;
  readonly statut: string;
  readonly contact_pro: string | null;
  readonly echeance: string | null;
  readonly notes: string | null;
  readonly version: number;
}

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueOrientation({ filtre, miennes, intentions, autres, recues, adultes, lesPartages, noms }: {
  filtre: string;
  miennes: readonly Piste[];
  intentions: readonly Piste[];
  autres: readonly Piste[];
  recues: readonly Piste[];
  adultes: readonly { id: string; nom: string }[];
  lesPartages: readonly { piste_id: string; destinataire_id: string }[];
  noms: Awaited<ReturnType<typeof nomsAffichables>>;
}) {
  return (
    <>
      <EnTetePage filAriane={[{ href: "/app/projets", libelle: "Mes projets" }]} sourcil="Orientation" titre="Tes pistes et tes démarches" sousTitre="Tes envies, les formations qui t'intriguent, tes recherches de stage. Pour toi." />
      <nav aria-label="Filtrer" className="mb-4 flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Link key={f.cle} href={f.cle === "toutes" ? "/app/orientation" : `/app/orientation?type=${f.cle}`} aria-current={filtre === f.cle ? "page" : undefined} className="pilule">
            {f.libelle}
          </Link>
        ))}
      </nav>
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
            <Panneau titre="Ce que j'aimerais" compte={intentions.length}>
              <ul className="m-0 grid list-none gap-2 p-0">
                {intentions.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-[12px] bg-[color:var(--color-rose-clair)] py-1 pl-3 pr-1">
                    <span className="flex items-center gap-2 font-semibold"><Heart size={16} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-accent)]" />{i.intitule}</span>
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
                  <TuileIcone icone={p.kind === "stage" ? Briefcase : GraduationCap} />
                  <span className="font-bold">{p.intitule}</span>
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
        <Panneau titre="Ajouter une piste" as="aside" className="border-0 bg-[color:var(--color-rose-clair)]">
          <FormulairePiste />
        </Panneau>
      </div>
    </>
  );
}

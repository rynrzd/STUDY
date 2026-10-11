import { Camera, ExternalLink } from "lucide-react";
import { ChoixAmenagement, DeposerPhoto } from "@/components/evaluations/FormulairesProf";
import { Etiquette, type Ton } from "@/components/study/ui";
import type { StatutCopie } from "@/lib/evaluations/analyse";
import type { EvaluationProf, Suivi } from "@/lib/v6/evaluations";

const STATUT: Record<StatutCopie, { libelle: string; ton: Ton }> = {
  absent: { libelle: "Pas commencé", ton: "neutre" },
  en_cours: { libelle: "En train de composer", ton: "attention" },
  a_corriger: { libelle: "À corriger", ton: "erreur" },
  corrigee: { libelle: "Corrigée", ton: "succes" },
};

const heure = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso)) : "—";

/** Onglet « Élèves » : qui compose, qui a rendu, aménagements, photos des copies papier. */
export function OngletEleves({ prof, suivi }: { prof: EvaluationProf; suivi: Suivi }) {
  const e = prof.evaluation;
  const papier = e.support === "papier";
  const copies = new Map(suivi.copies.map((c) => [c.profileId, c]));
  const resultats = new Map(suivi.analyse.eleves.map((r) => [r.profileId, r]));

  return (
    <section className="panneau" aria-labelledby="eleves">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="eleves" className="titre-bloc m-0 font-bold">
          {suivi.eleves.length} élève{suivi.eleves.length > 1 ? "s" : ""}
        </h2>
        <p className="meta m-0">
          {papier
            ? "Sur papier : joignez la photo de chaque copie, puis corrigez dans l'onglet Correction."
            : "Le temps majoré s'applique au moment où l'élève commence."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.9375rem]">
          <thead>
            <tr className="border-b border-[color:var(--color-bordure)] text-[0.75rem] uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
              <th className="py-2 pr-3 font-bold">Élève</th>
              <th className="py-2 pr-3 font-bold">État</th>
              {!papier ? (
                <>
                  <th className="py-2 pr-3 font-bold">Commencé · limite</th>
                  <th className="py-2 pr-3 font-bold">Rendu</th>
                  <th className="py-2 pr-3 font-bold">Sorties d&apos;onglet</th>
                  <th className="py-2 pr-3 font-bold">Temps</th>
                </>
              ) : (
                <th className="py-2 pr-3 font-bold">Copie papier</th>
              )}
            </tr>
          </thead>
          <tbody>
            {suivi.eleves.map((eleve) => {
              const c = copies.get(eleve.profileId);
              const r = resultats.get(eleve.profileId);
              const photos = c ? (suivi.photos.get(c.id) ?? []) : [];
              return (
                <tr key={eleve.profileId} className="border-b border-[color:var(--color-bordure)] align-top">
                  <td className="py-3 pr-3 font-semibold">
                    {eleve.nom} {eleve.prenom}
                  </td>
                  <td className="py-3 pr-3">
                    {!c ? <Etiquette>Pas de copie</Etiquette> : r ? <Etiquette ton={STATUT[r.statut].ton}>{papier && r.statut === "absent" ? "À saisir" : STATUT[r.statut].libelle}</Etiquette> : null}
                  </td>
                  {!papier ? (
                    <>
                      <td className="py-3 pr-3">
                        {heure(c?.commenceeLe ?? null)} · {heure(c?.limiteLe ?? null)}
                      </td>
                      <td className="py-3 pr-3">{heure(c?.rendueLe ?? null)}</td>
                      <td className="py-3 pr-3">
                        {c && c.sortiesOnglet > 0 ? <Etiquette ton="attention">{c.sortiesOnglet}</Etiquette> : <span className="meta">0</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <ChoixAmenagement evaluation={e.id} eleve={eleve.profileId} valeur={prof.amenagements[eleve.profileId] ?? null} figee={Boolean(c?.commenceeLe)} />
                      </td>
                    </>
                  ) : (
                    <td className="py-3 pr-3">
                      {c ? (
                        <div className="grid gap-2">
                          {photos.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {photos.map((f, i) => (
                                <a key={f} href={`/documents/${f}`} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold">
                                  <Camera size={14} aria-hidden="true" /> Photo {i + 1} <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {!e.resultatsPubliesLe ? <DeposerPhoto evaluation={e.id} copie={c.id} /> : null}
                        </div>
                      ) : (
                        <span className="meta">Distribuez pour créer sa copie.</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

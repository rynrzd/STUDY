"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { creerFiche } from "@/app/app/reviser/actions";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";

const FORMATS = [
  { cle: "essentiel", libelle: "L'essentiel", aide: "Notions et méthodes clés, en extraits courts." },
  { cle: "detaille", libelle: "Explication détaillée", aide: "Les passages complets, pour comprendre." },
  { cle: "cartes", libelle: "Cartes mémoire", aide: "Une question, une réponse tirée du cours." },
  { cle: "quiz", libelle: "Quiz", aide: "Les exercices publiés par ton professeur." },
  { cle: "controle", libelle: "Préparer un contrôle", aide: "L'essentiel, une liste de vérification et les exercices." },
] as const;

interface SeanceDispo {
  readonly id: string;
  readonly titre: string;
  readonly cours: string;
  readonly passages: number;
  readonly exercices: number;
}

export function FormulaireFiche({ seances, preselection, formatInitial }: { seances: readonly SeanceDispo[]; preselection: readonly string[]; formatInitial: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerFiche, {});
  const [choisies, setChoisies] = useState<Set<string>>(() => new Set(etat.valeurs?.seances?.split(",").filter(Boolean) ?? preselection));
  const [format, setFormat] = useState(etat.valeurs?.format ?? formatInitial);
  const cle = useMemo(() => crypto.randomUUID(), []);
  const parCours = useMemo(() => {
    const m = new Map<string, SeanceDispo[]>();
    for (const s of seances) m.set(s.cours, [...(m.get(s.cours) ?? []), s]);
    return [...m.entries()];
  }, [seances]);
  const selection = seances.filter((s) => choisies.has(s.id));
  const exclues = selection.filter((s) => (format === "quiz" ? s.exercices === 0 : s.passages === 0));
  const incluses = selection.filter((s) => !exclues.includes(s));
  const titreDefaut = selection[0] ? `${FORMATS.find((f) => f.cle === format)?.libelle ?? "Fiche"} — ${selection[0].titre}` : "";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <input type="hidden" name="cle" value={cle} />
      <div className="grid content-start gap-6">
        <RetourFormulaire etat={etat} />
        <fieldset className="panneau">
          <legend className="titre-section px-1">1. Sources</legend>
          {etat.champs?.seance ? (
            <p role="alert" className="m-0 mb-3 text-[0.8125rem] text-[color:var(--color-erreur)]">
              {etat.champs.seance.join(" ")}
            </p>
          ) : null}
          <div className="grid max-h-[420px] gap-4 overflow-y-auto pr-1">
            {parCours.map(([cours, liste]) => (
              <div key={cours}>
                <p className="sourcil mb-2">{cours}</p>
                <ul className="m-0 grid list-none gap-1 p-0">
                  {liste.map((s) => (
                    <li key={s.id}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[8px] px-2 hover:bg-[color:var(--color-survol)]">
                        <input
                          type="checkbox"
                          name="seance"
                          value={s.id}
                          checked={choisies.has(s.id)}
                          disabled={!choisies.has(s.id) && choisies.size >= 8}
                          onChange={(e) =>
                            setChoisies((c) => {
                              const n = new Set(c);
                              if (e.target.checked) n.add(s.id);
                              else n.delete(s.id);
                              return n;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{s.titre}</span>
                          <span className="meta">
                            {s.passages > 0 ? `${s.passages} passage${s.passages > 1 ? "s" : ""}` : "Pas de texte lisible"}
                            {s.exercices > 0 ? ` · ${s.exercices} exercice${s.exercices > 1 ? "s" : ""}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="meta m-0 mt-3">Huit séances au plus.</p>
        </fieldset>

        <fieldset className="panneau">
          <legend className="titre-section px-1">2. Format</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <label key={f.cle} className={`flex cursor-pointer gap-3 rounded-[10px] border p-3 ${format === f.cle ? "border-[color:var(--color-focus)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)]"}`}>
                <input type="radio" name="format" value={f.cle} checked={format === f.cle} onChange={() => setFormat(f.cle)} />
                <span>
                  <span className="block font-semibold">{f.libelle}</span>
                  <span className="meta">{f.aide}</span>
                </span>
              </label>
            ))}
          </div>
          {format === "essentiel" || format === "detaille" || format === "controle" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="longueur" value="courte" defaultChecked={etat.valeurs?.longueur !== "detaillee"} /> Courte (600 mots au plus)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="longueur" value="detaillee" defaultChecked={etat.valeurs?.longueur === "detaillee"} /> Détaillée (1 500 mots au plus)
              </label>
            </div>
          ) : null}
          <input type="hidden" name="objectif" value={format === "detaille" ? "comprendre" : "essentiel"} />
        </fieldset>
      </div>

      <aside className="panneau grid content-start gap-4 lg:sticky lg:top-24">
        <h2 className="titre-section">3. Avant de lancer</h2>
        {selection.length === 0 ? (
          <p className="m-0 text-[color:var(--color-encre-faible)]">Choisis au moins une séance.</p>
        ) : (
          <>
            {incluses.length > 0 ? (
              <div>
                <p className="m-0 mb-1 flex items-center gap-2 font-semibold text-[color:var(--color-succes)]">
                  <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" /> Incluses ({incluses.length})
                </p>
                <ul className="m-0 pl-5 text-[0.8125rem]">
                  {incluses.map((s) => (
                    <li key={s.id}>{s.titre}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {exclues.length > 0 ? (
              <div>
                <p className="m-0 mb-1 flex items-center gap-2 font-semibold text-[color:var(--color-attention)]">
                  <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" /> Sans contenu utilisable ({exclues.length})
                </p>
                <ul className="m-0 pl-5 text-[0.8125rem]">
                  {exclues.map((s) => (
                    <li key={s.id}>
                      {s.titre} — {format === "quiz" ? "aucun exercice publié" : "pas de texte lisible"}
                    </li>
                  ))}
                </ul>
                <p className="meta m-0 mt-1">Rien ne sera inventé à leur place.</p>
              </div>
            ) : null}
          </>
        )}
        <Champ libelle="Titre de la fiche" nom="titre" requis maxLength={140} valeur={etat.valeurs?.titre ?? titreDefaut} key={titreDefaut} erreurs={etat.champs?.titre} />
        <p className="meta m-0">
          La fiche est assemblée à partir d&apos;extraits de tes cours, chacun relié à sa source. Elle restera marquée « à vérifier » : aucun
          professeur ne l&apos;a validée. Tu peux quitter la page pendant la préparation.
        </p>
        <BoutonEnvoi enCours="Lancement…" motifDesactivation={selection.length === 0 ? "Choisis d'abord une séance." : incluses.length === 0 ? "Aucune source utilisable." : null}>
          Préparer ma fiche
        </BoutonEnvoi>
      </aside>
    </form>
  );
}

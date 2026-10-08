import Link from "next/link";
import { ListChecks, Search, Target } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, OngletsLiens, Panneau, TuileIcone } from "@/components/study/ui";
import type { banqueExercices, corrigeDe } from "@/lib/v6/banque";
import { AjouterASeance } from "./AjouterASeance";

const TYPES: Record<string, string> = { qcm: "QCM", numerique: "Numérique", texte: "Réponse rédigée" };

const DIFFICULTES: Record<number, string> = { 1: "Facile", 2: "Moyen", 3: "Difficile" };

export type Params = { q?: string; matiere?: string; difficulte?: string | string[]; type?: string; vue?: string; tri?: string; ex?: string };

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueBanque({ p, miens, total, exercices, erreur, ouvert, corrige, matieres, difficultes, choixSeances }: {
  p: Params;
  miens: boolean;
  total: number;
  exercices: Awaited<ReturnType<typeof banqueExercices>>["exercices"];
  erreur: Awaited<ReturnType<typeof banqueExercices>>["erreur"];
  ouvert: Awaited<ReturnType<typeof banqueExercices>>["exercices"][number] | null;
  corrige: Awaited<ReturnType<typeof corrigeDe>> | null;
  matieres: readonly string[];
  difficultes: readonly number[];
  choixSeances: readonly { id: string; libelle: string }[];
}) {
  const lien = (changements: Partial<Params>) => {
    const q = new URLSearchParams();
    const fusion = { ...p, ...changements };
    for (const [k, v] of Object.entries(fusion)) {
      if (v === undefined || v === "" || k === "ex") continue;
      for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
    }
    if (changements.ex) q.set("ex", changements.ex);
    const s = q.toString();
    return s ? `/studio/exercices?${s}` : "/studio/exercices";
  };

  return (
    <div className="mx-auto max-w-[1240px]">
      <EnTetePage
        filAriane={[{ href: "/studio", libelle: "Studio" }]}
        sourcil="Banque d'exercices"
        titre="Réutiliser un exercice"
        sousTitre="Parcourez, filtrez et ajoutez à vos séances les exercices de vos enseignements."
      />

      <OngletsLiens
        etiquette="Vue"
        onglets={[
          { href: lien({ vue: undefined }), libelle: "Tous les exercices", compte: !miens ? total : null, actif: !miens },
          { href: lien({ vue: "miens" }), libelle: "Mes exercices", compte: miens ? total : null, actif: miens },
        ]}
      />

      {/* Filtres en GET : l'adresse conserve la recherche, partageable et rechargeable. */}
      <form method="get" action="/studio/exercices" className="panneau mb-5 grid gap-4 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:items-end">
        {miens ? <input type="hidden" name="vue" value="miens" /> : null}
        <div>
          <label className="etiquette" htmlFor="q">
            Rechercher
          </label>
          <div className="relative">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-encre-faible)]" />
            <input id="q" name="q" type="search" defaultValue={p.q ?? ""} className="champ pl-10" placeholder="Énoncé, notion, séance…" />
          </div>
        </div>
        <div>
          <label className="etiquette" htmlFor="matiere">
            Matière
          </label>
          <select id="matiere" name="matiere" defaultValue={p.matiere ?? ""} className="champ">
            <option value="">Toutes les matières</option>
            {matieres.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="type">
            Type d&apos;exercice
          </label>
          <select id="type" name="type" defaultValue={p.type ?? ""} className="champ">
            <option value="">Tous les types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="tri">
            Trier par
          </label>
          <select id="tri" name="tri" defaultValue={p.tri ?? "recents"} className="champ">
            <option value="recents">Plus récents</option>
            <option value="anciens">Plus anciens</option>
          </select>
        </div>
        <fieldset className="m-0 flex flex-wrap items-center gap-4 border-0 p-0 md:col-span-3">
          <legend className="etiquette mb-1">Niveau de difficulté</legend>
          {[1, 2, 3].map((d) => (
            <label key={d} className="flex min-h-[44px] items-center gap-2">
              <input type="checkbox" name="difficulte" value={d} defaultChecked={difficultes.includes(d)} className="size-4" />
              {DIFFICULTES[d]}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="bouton bouton-primaire">
          Filtrer
        </button>
      </form>

      {erreur ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          La banque n&apos;a pas pu être chargée. Réessayez dans un instant.
        </p>
      ) : total === 0 ? (
        <EtatVide icone={Target} titre="Aucun exercice pour l'instant" texte="Créez vos premiers exercices depuis une séance du Studio : ils apparaîtront ici." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="resultats">
            <p id="resultats" className="meta m-0 mb-3" role="status">
              {exercices.length} exercice{exercices.length > 1 ? "s" : ""}
              {exercices.length !== total ? ` sur ${total}` : ""}
            </p>
            {exercices.length === 0 ? (
              <EtatVide icone={Search} titre="Aucun exercice ne correspond" texte="Élargissez les filtres ou effacez la recherche." />
            ) : (
              <ul className="liste-r2">
                {exercices.map((e) => (
                  <li key={e.version}>
                    <Link href={lien({ ex: e.version })} aria-current={ouvert?.version === e.version ? "true" : undefined} className="ligne-r2 items-start">
                      <TuileIcone icone={e.kind === "qcm" ? ListChecks : Target} />
                      <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-semibold text-[color:var(--color-encre)]">{e.enonce}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Etiquette>{e.matiere}</Etiquette>
                        <Etiquette>{TYPES[e.kind]}</Etiquette>
                        <Etiquette ton={e.difficulte === 3 ? "attention" : e.difficulte === 1 ? "succes" : "rose"}>{DIFFICULTES[e.difficulte]}</Etiquette>
                        {!e.publie ? <Etiquette ton="attention">Non publié</Etiquette> : null}
                      </span>
                      <span className="meta mt-1 block truncate">
                        {e.cours}
                        {e.seance ? ` · ${e.seance}` : ""}
                        {e.notion ? ` · ${e.notion}` : ""} · version {e.numero}
                      </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside aria-label="Détail de l'exercice" className="lg:sticky lg:top-24 lg:self-start">
            {ouvert ? (
              <Panneau titre="Aperçu">
                <p className="m-0 whitespace-pre-wrap">{ouvert.enonce}</p>
                {ouvert.choix ? (
                  <ol className="m-0 mt-3 grid gap-1 pl-5">
                    {ouvert.choix.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                ) : null}
                <div className="mt-4 rounded-[12px] bg-[color:var(--color-rose-clair)] p-3 text-[0.875rem]">
                  <p className="m-0 font-semibold">Corrigé — visible des professeurs seulement</p>
                  {corrige ? (
                    <>
                      {ouvert.kind === "qcm" && typeof (corrige.bonne_reponse as { index?: number } | null)?.index === "number" ? (
                        <p className="m-0 mt-1">Bonne réponse : choix {((corrige.bonne_reponse as { index: number }).index ?? 0) + 1}</p>
                      ) : ouvert.kind === "numerique" && corrige.bonne_reponse ? (
                        <p className="m-0 mt-1">Valeur attendue : {String((corrige.bonne_reponse as { valeur?: unknown }).valeur ?? "")}</p>
                      ) : null}
                      <p className="m-0 mt-1">{corrige.explication}</p>
                      {corrige.indice ? <p className="meta m-0 mt-1">Indice : {corrige.indice}</p> : null}
                    </>
                  ) : (
                    <p className="meta m-0 mt-1">Aucun corrigé enregistré.</p>
                  )}
                </div>
                <div className="mt-4">
                  {choixSeances.length === 0 ? (
                    <p className="meta m-0">Aucune séance disponible : créez-en une dans le Studio.</p>
                  ) : (
                    <AjouterASeance version={ouvert.version} seances={choixSeances} />
                  )}
                </div>
              </Panneau>
            ) : (
              <Panneau titre="Aperçu">
                <p className="m-0 text-[color:var(--color-encre-faible)]">Choisissez un exercice pour voir son énoncé, son corrigé et l&apos;ajouter à une séance.</p>
              </Panneau>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

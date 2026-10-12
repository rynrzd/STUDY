"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleAlert, CircleCheck, Layers, School, Search } from "lucide-react";
import { compterDestinataires, publierDocument } from "@/app/professeur/studio/actions";
import { ETAT_PUBLICATION_INITIAL, type EtatPublication, type ResultatPublication } from "@/app/professeur/studio/etats";

/**
 * Publier dans un ou plusieurs cours — cahier des charges, ch. 14.
 *
 * Les garde-fous de la version mono-cible sont conservés et étendus :
 *
 *  1. **Aucun cours n'est présélectionné.** Publier au mauvais endroit est
 *     l'erreur la plus facile à commettre et la plus pénible à rattraper.
 *  2. **Le bouton dit combien** — « Publier dans 3 cours » — et le
 *     récapitulatif compte les élèves distincts : l'élève présent dans une
 *     classe et dans un groupe n'est compté qu'une fois.
 *  3. **La case de relecture reste obligatoire.**
 *  4. **Le résultat est rendu cours par cours.** Une cible refusée (affectation
 *     retirée entre-temps) est nommée, jamais noyée dans un « publié ».
 */

export interface CoursPubliable {
  readonly id: string;
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly effectif: number;
  readonly dejaPublie: boolean;
  readonly versionAJour: boolean;
}

const RAISONS: Record<string, string> = {
  non_affecte: "Vous n'enseignez plus dans ce cours.",
  cours_introuvable: "Ce cours n'existe plus ou a été archivé.",
  erreur: "Erreur inattendue : réessayez.",
};

export function Publication({
  document,
  titre,
  cours,
  lectureEchouee = false,
}: {
  document: string;
  titre: string;
  cours: readonly CoursPubliable[];
  lectureEchouee?: boolean;
}) {
  // Une réponse perdue (réseau coupé, session expirée, refus du serveur) ne doit
  // pas finir sur l'écran d'erreur général : on dit ce qui est sûr. La base
  // rend un renvoi inoffensif (« déjà publié »), d'où le conseil de recharger.
  const [etat, action] = useActionState<EtatPublication, FormData>(async (precedent, donnees) => {
    try {
      return await publierDocument(precedent, donnees);
    } catch {
      return {
        etat: "erreur",
        message: "La réponse du serveur n'est pas arrivée. Rechargez la page : l'état de chaque cours y est à jour, et republier ne crée jamais de doublon.",
      };
    }
  }, ETAT_PUBLICATION_INITIAL);
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set());
  const [revue, setRevue] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [compte, setCompte] = useState<{ cle: string; valeur: number | null }>({ cle: "", valeur: 0 });

  const selection = useMemo(() => [...choisis].sort(), [choisis]);
  const cle = selection.join(",");
  const visibles = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return r === "" ? cours : cours.filter((c) => `${c.matiere} ${c.cible}`.toLowerCase().includes(r));
  }, [cours, recherche]);
  const inscriptions = cours.filter((c) => choisis.has(c.id)).reduce((n, c) => n + c.effectif, 0);

  // Élèves distincts : demandés au serveur un court instant après chaque
  // changement de sélection. Le chargement se déduit de la clé, sans état posé
  // dans l'effet lui-même.
  useEffect(() => {
    if (selection.length === 0) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      compterDestinataires(selection)
        .catch(() => null)
        .then((valeur) => {
          if (!annule) setCompte({ cle, valeur });
        });
    }, 250);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [cle, selection]);

  const distincts = selection.length === 0 ? 0 : compte.cle === cle ? compte.valeur : undefined;

  function basculer(id: string) {
    setChoisis((prec) => {
      const suite = new Set(prec);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
  }

  if (lectureEchouee) {
    return (
      <p role="alert" className="ajout-erreur m-0">
        <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> Vos cours ne sont pas disponibles pour le moment. Rechargez la page.
      </p>
    );
  }

  if (cours.length === 0) {
    return (
      <p className="m-0 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
        Aucun cours ne vous est affecté pour le moment. L&apos;administration de votre établissement vous affecte à une classe ou à un groupe ; cette liste se remplira ensuite.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="document" value={document} />
      <input type="hidden" name="titre" value={titre} />
      {revue ? <input type="hidden" name="revue" value="oui" /> : null}

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="titre-bloc m-0 font-bold">Publier dans</h2>
        <span className="flex gap-3 text-[0.8125rem]">
          <button type="button" className="font-semibold text-[color:var(--color-accent)]" onClick={() => setChoisis(new Set(visibles.map((c) => c.id)))}>
            Tout
          </button>
          <button type="button" className="font-semibold text-[color:var(--color-encre-faible)]" onClick={() => setChoisis(new Set())}>
            Aucun
          </button>
        </span>
      </div>

      {cours.length > 6 ? (
        <span className="relative mt-3 block">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-encre-faible)]" />
          <label htmlFor="publication-recherche" className="sr-only">
            Filtrer les cours
          </label>
          <input id="publication-recherche" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Classe, groupe ou matière" className="champ pl-10" />
        </span>
      ) : null}

      <ul className="m-0 mt-3 list-none space-y-2 p-0" aria-label="Cours où publier">
        {visibles.map((c) => {
          const actif = choisis.has(c.id);
          return (
            <li key={c.id}>
              <label className="cible-publication" data-actif={actif ? "" : undefined}>
                <input type="checkbox" name="cours" value={c.id} checked={actif} onChange={() => basculer(c.id)} className="sr-only" />
                <span className="picker-coche" aria-hidden="true">
                  {actif ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.cible}</span>
                  <span className="meta block">
                    {c.matiere} · {c.effectif} élève{c.effectif > 1 ? "s" : ""}
                    {c.dejaPublie ? (c.versionAJour ? " · déjà publié, à jour" : " · publié, ancienne version") : ""}
                  </span>
                </span>
                <span className="etiquette-etat shrink-0" data-ton={c.genre === "groupe" ? "rose" : undefined}>
                  {c.genre === "groupe" ? <Layers size={12} strokeWidth={2} aria-hidden="true" /> : <School size={12} strokeWidth={2} aria-hidden="true" />}{" "}
                  {c.genre === "groupe" ? "Groupe" : "Classe"}
                </span>
              </label>
            </li>
          );
        })}
        {visibles.length === 0 ? <li className="meta py-3 text-center">Aucun cours ne correspond.</li> : null}
      </ul>

      <div className="recap-publication mt-4" aria-live="polite">
        {selection.length === 0 ? (
          <span>Choisissez au moins un cours.</span>
        ) : (
          <>
            <span className="font-bold">
              {selection.length} cours choisi{selection.length > 1 ? "s" : ""}
            </span>
            <span>
              {distincts === undefined
                ? "Calcul des élèves…"
                : distincts === null
                  ? "Nombre d'élèves indisponible"
                  : `${distincts} élève${distincts > 1 ? "s" : ""} distinct${distincts > 1 ? "s" : ""}${distincts !== inscriptions ? ` (certains sont dans plusieurs cours)` : ""}`}
            </span>
          </>
        )}
      </div>

      <label className="mt-5 flex min-h-[var(--spacing-cible)] items-start gap-3">
        <input type="checkbox" checked={revue} onChange={(e) => setRevue(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]" />
        <span className="text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
          J&apos;ai vérifié le contenu du cours
          <span className="aide-champ">La conversion peut avoir manqué une formule ou un tableau. Votre relecture est la seule garantie.</span>
        </span>
      </label>

      <Bouton nombre={selection.length} pret={selection.length > 0 && revue} />

      {etat.etat !== "vierge" ? <Resultats etat={etat} /> : null}
    </form>
  );
}

function Bouton({ nombre, pret }: { nombre: number; pret: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      // Désactivé pendant l'envoi ; la base garantit de toute façon qu'un
      // second envoi ne publie rien de plus (« déjà publiée »).
      disabled={!pret || pending}
      className="bouton bouton-primaire mt-5 w-full"
    >
      {pending ? "Publication…" : nombre === 0 ? "Choisissez un cours" : nombre === 1 ? "Publier dans ce cours" : `Publier dans ${nombre} cours`}
    </button>
  );
}

const ISSUES: Record<ResultatPublication["resultat"], { texte: string; ton: "succes" | "neutre" | "erreur" }> = {
  publiee: { texte: "Publié", ton: "succes" },
  mise_a_jour: { texte: "Mis à jour vers cette version", ton: "succes" },
  deja_publiee: { texte: "Déjà publié, rien à refaire", ton: "neutre" },
  refusee: { texte: "Refusé", ton: "erreur" },
};

function Resultats({ etat }: { etat: EtatPublication }) {
  const Icone = etat.etat === "ok" ? CircleCheck : CircleAlert;
  return (
    <div className="mt-4" role="status">
      <p className="resultat-publication m-0" data-ton={etat.etat}>
        <Icone size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> {etat.message}
      </p>
      {etat.resultats !== undefined && etat.resultats.length > 0 ? (
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {etat.resultats.map((r) => {
            const issue = ISSUES[r.resultat];
            return (
              <li key={r.cible} className="flex items-start justify-between gap-3 text-[0.875rem]">
                <span className="min-w-0">
                  <span className="block font-semibold">{r.libelle}</span>
                  <span className={issue.ton === "erreur" ? "block text-[color:var(--color-erreur)]" : issue.ton === "succes" ? "block text-[color:var(--color-succes)]" : "meta block"}>
                    {issue.texte}
                    {r.resultat === "refusee" && r.raison !== null ? ` — ${RAISONS[r.raison] ?? RAISONS.erreur}` : ""}
                  </span>
                </span>
                {r.seance !== null && r.resultat !== "refusee" ? (
                  <Link href={`/app/seances/${r.seance}`} className="shrink-0 font-semibold text-[color:var(--color-accent)]">
                    Vue élève
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

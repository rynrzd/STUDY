"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { publierDocument } from "@/app/professeur/studio/actions";
import {
  ETAT_PUBLICATION_INITIAL,
  type EtatPublication,
} from "@/app/professeur/studio/etats";

/**
 * Publier dans une classe — S13 à S15.
 *
 * Trois garde-fous, tous délibérés :
 *
 *  1. **Aucune classe n'est présélectionnée.** Publier dans la mauvaise classe
 *     est l'erreur la plus facile à commettre et la plus pénible à rattraper.
 *  2. **Le bouton nomme la classe** — « Publier en Seconde 1 » — parce qu'un
 *     bouton « Publier » ne dit pas où.
 *  3. **La case de relecture est obligatoire.** Rien dans une conversion
 *     réussie ne prouve qu'aucun contenu n'a été perdu ; seul le professeur
 *     peut l'affirmer.
 *
 * Chaque classe se publie séparément : la Seconde 2 ne reçoit rien tant qu'on
 * n'a pas refait le geste pour elle.
 */

export interface CoursPubliable {
  readonly id: string;
  readonly libelle: string;
  readonly effectif: number;
  readonly dejaPublie: boolean;
}

export function Publication({
  document,
  titre,
  cours,
}: {
  document: string;
  titre: string;
  cours: readonly CoursPubliable[];
}) {
  const [etat, action] = useActionState<EtatPublication, FormData>(
    publierDocument,
    ETAT_PUBLICATION_INITIAL,
  );
  const [choisi, setChoisi] = useState<string | null>(null);
  const [revue, setRevue] = useState(false);

  const classe = cours.find((entree) => entree.id === choisi) ?? null;

  if (cours.length === 0) {
    return (
      <p className="m-0 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
        Aucune classe ne vous est affectée pour le moment. L&apos;administration
        de votre établissement vous affecte à une classe et à une matière ;
        cette liste se remplira ensuite.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="document" value={document} />
      <input type="hidden" name="titre" value={titre} />
      {choisi !== null ? <input type="hidden" name="cours" value={choisi} /> : null}
      {revue ? <input type="hidden" name="revue" value="oui" /> : null}

      <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
        Publier dans
      </h2>

      <ul role="radiogroup" aria-label="Classe" className="m-0 mt-3 list-none space-y-2 p-0">
        {cours.map((entree) => {
          const actif = entree.id === choisi;
          return (
            <li key={entree.id}>
              <button
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setChoisi(entree.id)}
                className={`flex min-h-[var(--spacing-cible)] w-full items-center justify-between gap-3 rounded-[var(--radius-champ)] border px-3.5 py-2 text-left ${
                  actif
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]"
                    : "border-[color:var(--color-bordure)]"
                }`}
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[length:var(--text-tableau)] ${
                      actif ? "font-semibold text-[color:var(--color-accent)]" : ""
                    }`}
                  >
                    {entree.libelle}
                  </span>
                  <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                    {entree.effectif} élève{entree.effectif > 1 ? "s" : ""}
                    {entree.dejaPublie ? " · déjà publié" : ""}
                  </span>
                </span>
                {actif ? (
                  <span aria-hidden="true" className="text-[color:var(--color-accent)]">
                    ●
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="m-0 mt-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
        Seule la classe sélectionnée recevra ce cours. Pour une autre classe, le
        geste se refait séparément.
      </p>

      <label className="mt-6 flex min-h-[var(--spacing-cible)] items-start gap-3">
        <input
          type="checkbox"
          checked={revue}
          onChange={(evenement) => setRevue(evenement.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]"
        />
        <span className="text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
          J&apos;ai vérifié le contenu du cours
          <span className="aide-champ">
            La conversion peut avoir manqué une formule ou un tableau. Votre
            relecture est la seule garantie.
          </span>
        </span>
      </label>

      <Bouton classe={classe?.libelle ?? null} pret={choisi !== null && revue} />

      {etat.etat !== "vierge" && etat.message !== undefined ? (
        <p
          role="status"
          className={`m-0 mt-3 text-[length:var(--text-tableau)] ${
            etat.etat === "ok"
              ? "text-[color:var(--color-succes)]"
              : "text-[color:var(--color-erreur)]"
          }`}
        >
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}

function Bouton({ classe, pret }: { classe: string | null; pret: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      // Désactivé pendant l'envoi : un double clic ne produit pas deux
      // publications. La base le garantit aussi, mais mieux vaut que
      // l'interface ne l'invite pas.
      disabled={!pret || pending}
      className="bouton bouton-primaire mt-5 w-full"
    >
      {pending
        ? "Publication…"
        : classe === null
          ? "Choisissez une classe"
          : `Publier en ${classe}`}
    </button>
  );
}

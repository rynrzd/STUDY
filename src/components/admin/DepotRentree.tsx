"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deposerFichiers, deposerProfesseurs } from "@/app/admin/import/actions";
import { ETAT_DEPOT_INITIAL, type EtatDepot } from "@/app/admin/import/etats";

/**
 * Dépôt multi-fichiers (§5.1).
 *
 * Un lycée n'a presque jamais un seul fichier : il a un export par classe, ou
 * un export global, ou les deux. L'écran accepte les deux sans poser la
 * question — c'est l'analyse qui reconnaît ce qu'elle a reçu.
 *
 * La liste des fichiers choisis reste visible avant l'envoi, avec un moyen
 * d'en retirer un. Sans cela, se tromper d'un fichier oblige à tout
 * resélectionner.
 */
export function DepotRentree({ cible }: { cible: "eleves" | "professeurs" }) {
  const eleves = cible === "eleves";

  const [etat, deposer] = useActionState<EtatDepot, FormData>(
    eleves ? deposerFichiers : deposerProfesseurs,
    ETAT_DEPOT_INITIAL,
  );

  const champ = useRef<HTMLInputElement>(null);
  const [choisis, setChoisis] = useState<File[]>([]);
  const [survol, setSurvol] = useState(false);

  /**
   * Le champ `<input type="file">` est la source de vérité de l'envoi : le
   * navigateur n'accepte pas qu'on lui pose une liste de fichiers à la main,
   * sauf en passant par un `DataTransfer`. C'est ce que fait cette fonction,
   * et c'est aussi ce qui permet le glisser-déposer.
   */
  function poser(fichiers: File[]) {
    const transfert = new DataTransfer();
    for (const fichier of fichiers) transfert.items.add(fichier);
    if (champ.current !== null) champ.current.files = transfert.files;
    setChoisis(fichiers);
  }

  function ajouter(nouveaux: FileList | null) {
    if (nouveaux === null) return;
    const liste = [...choisis];
    for (const fichier of Array.from(nouveaux)) {
      // Redéposer le même fichier deux fois est une erreur silencieuse
      // coûteuse : elle doublerait chaque élève dans l'aperçu.
      if (liste.some((deja) => deja.name === fichier.name && deja.size === fichier.size)) continue;
      liste.push(fichier);
    }
    poser(liste);
  }

  return (
    <form action={deposer} data-testid="depot-rentree" className="space-y-5">
      <div
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setSurvol(false);
          ajouter(evenement.dataTransfer.files);
        }}
        className={`rounded-[var(--radius-carte)] border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          survol
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)]"
            : "border-[color:var(--color-bordure)]"
        }`}
      >
        <p className="m-0 text-[length:var(--text-tableau)] font-semibold">
          {eleves ? "Déposez vos fichiers de classes" : "Déposez votre fichier de professeurs"}
        </p>
        <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          {eleves
            ? "Un fichier par classe, ou un seul fichier pour tout le lycée. Format .xlsx ou .csv."
            : "Nom, prénom, matière(s) et classe(s) par ligne. Format .xlsx ou .csv."}{" "}
          Rien n&apos;est créé maintenant : vous verrez d&apos;abord ce qui a été
          compris.
        </p>

        <input
          ref={champ}
          id={`fichiers-${cible}`}
          data-testid="depot-fichiers"
          name="fichiers"
          type="file"
          multiple
          /* Le champ est masque et pilote par le bouton voisin : sans intitule
             explicite, un lecteur d ecran qui l atteint ne sait pas ce que
             c est. Aucune etiquette visible ne lui correspond, donc on le dit
             ici. */
          aria-label={
            eleves
              ? "Fichiers d eleves a deposer (.xlsx ou .csv)"
              : "Fichiers de professeurs a deposer (.xlsx ou .csv)"
          }
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(evenement) => ajouter(evenement.target.files)}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => champ.current?.click()}
          className="bouton bouton-secondaire mt-5 w-full sm:w-auto"
        >
          Choisir des fichiers
        </button>
      </div>

      {choisis.length > 0 ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {choisis.map((fichier) => (
            <li
              key={`${fichier.name}-${fichier.size}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-tableau)]">
                  {fichier.name}
                </span>
                <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                  {Math.max(1, Math.round(fichier.size / 1024))} Ko
                </span>
              </span>
              <button
                type="button"
                onClick={() => poser(choisis.filter((autre) => autre !== fichier))}
                className="shrink-0 rounded-[6px] px-2 py-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)] underline underline-offset-2 hover:text-[color:var(--color-encre)]"
              >
                Retirer<span className="sr-only"> {fichier.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {etat.etat === "erreur" ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonDepot nombre={choisis.length} />
    </form>
  );
}

function BoutonDepot({ nombre }: { nombre: number }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <button
        type="submit"
        data-testid="depot-valider"
        disabled={pending || nombre === 0}
        className="bouton bouton-primaire w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending
          ? "Lecture des fichiers…"
          : nombre <= 1
            ? "Analyser"
            : `Analyser les ${nombre} fichiers`}
      </button>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        L&apos;analyse ne crée aucun compte.
      </p>
    </div>
  );
}

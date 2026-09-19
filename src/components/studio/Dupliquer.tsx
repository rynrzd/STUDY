"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { dupliquerVersUneClasse } from "@/app/studio/actions";
import { ETAT_STUDIO_INITIAL, type EtatStudio } from "@/app/studio/etats";

/**
 * Dupliquer une séance vers une autre classe — cahier V5, §4.5.
 *
 * La liste ne propose que les cours où le professeur est affecté, et le cours
 * d'origine en est retiré. Ce n'est pas la protection — la base revérifie les
 * deux affectations — c'est la politesse : ne pas offrir un choix qui sera
 * refusé.
 *
 * L'écran dit avant d'agir ce qui ne sera pas copié. Un professeur qui
 * découvre après coup que ses devoirs ne sont pas passés a perdu sa
 * confiance dans le bouton.
 */
export function Dupliquer({
  seance,
  titre,
  cours,
  coursActuel,
}: {
  seance: string;
  titre: string;
  cours: readonly { id: string; libelle: string }[];
  coursActuel: string;
}) {
  const [etat, dupliquer] = useActionState<EtatStudio, FormData>(
    dupliquerVersUneClasse,
    ETAT_STUDIO_INITIAL,
  );
  const [ouvert, setOuvert] = useState(false);

  const destinations = cours.filter((unCours) => unCours.id !== coursActuel);

  if (etat.etat === "ok" && etat.cree !== undefined) {
    return (
      <div className="rounded-[var(--radius-champ)] border border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-4">
        <p className="m-0 text-[length:var(--text-tableau)]">{etat.message}</p>
        <Link
          href={`/studio/${etat.cree}`}
          className="bouton bouton-secondaire mt-3 inline-flex"
        >
          Ouvrir la copie
        </Link>
      </div>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="bouton bouton-secondaire"
      >
        Dupliquer vers une autre classe
      </button>
    );
  }

  return (
    <form action={dupliquer} className="carte p-5">
      <input type="hidden" name="seance" value={seance} />

      <h3 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
        Dupliquer « {titre} »
      </h3>
      <p className="m-0 mt-2 max-w-[60ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        La copie arrive en brouillon : l&apos;autre classe ne la verra pas tant
        que vous ne l&apos;aurez pas publiée. Les devoirs ne sont pas recopiés —
        ils ont leurs propres dates — et rien de ce qui appartient aux élèves ne
        traverse.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="cours-cible">
            Classe de destination
          </label>
          <select id="cours-cible" name="cours" required className="champ" defaultValue="">
            <option value="" disabled>
              Choisir…
            </option>
            {destinations.map((unCours) => (
              <option key={unCours.id} value={unCours.id}>
                {unCours.libelle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="titre-copie">
            Titre de la copie
          </label>
          <input
            id="titre-copie"
            name="titre"
            type="text"
            maxLength={160}
            defaultValue={titre}
            className="champ"
          />
        </div>
      </div>

      {etat.etat === "erreur" ? (
        <p
          role="alert"
          className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-erreur)]"
        >
          {etat.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <BoutonDupliquer />
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="bouton bouton-secondaire"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function BoutonDupliquer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire">
      {pending ? "Copie en cours…" : "Dupliquer"}
    </button>
  );
}

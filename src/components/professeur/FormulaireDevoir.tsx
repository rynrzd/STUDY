"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { creerUnDevoir, modifierUnDevoir } from "@/app/professeur/devoirs/actions";
import { ETAT_DEVOIR_INITIAL, type EtatDevoirAction } from "@/app/professeur/devoirs/etats";

/**
 * Créer ou modifier un devoir — cahier V5, §2.1.
 *
 * Un seul formulaire pour les deux gestes : ce sont les mêmes champs, et deux
 * écrans distincts finiraient par diverger sur un détail.
 *
 * Le mode de remise commande le reste de l'écran. Choisir « à rendre sur
 * papier » ou « rien à rendre » masque le remplacement et la politique de
 * retard : ces réglages ne veulent rien dire sans fichier, et les laisser
 * visibles laisserait croire qu'ils s'appliquent.
 */
export interface CoursDisponible {
  readonly id: string;
  readonly libelle: string;
}

export interface SeanceDisponible {
  readonly id: string;
  readonly titre: string;
  readonly cours: string;
}

export interface ValeursDevoir {
  readonly id: string;
  readonly titre: string;
  readonly consigne: string;
  readonly date: string;
  readonly heure: string;
  readonly mode: string;
  readonly remplacement: boolean;
  readonly retard: string;
}

export function FormulaireDevoir({
  cours,
  seances,
  valeurs,
  coursInitial,
}: {
  cours: readonly CoursDisponible[];
  seances: readonly SeanceDisponible[];
  /** Absent : on crée. Présent : on modifie. */
  valeurs?: ValeursDevoir;
  coursInitial?: string;
}) {
  const modification = valeurs !== undefined;

  const [etat, action] = useActionState<EtatDevoirAction, FormData>(
    modification ? modifierUnDevoir : creerUnDevoir,
    ETAT_DEVOIR_INITIAL,
  );

  const base = useId();
  const [coursChoisi, setCoursChoisi] = useState(cours.find(c => c.id === coursInitial)?.id ?? cours[0]?.id ?? "");
  const [mode, setMode] = useState(valeurs?.mode ?? "numerique");

  const attendUnFichier = mode === "numerique" || mode === "mixte";
  const seancesDuCours = seances.filter((seance) => seance.cours === coursChoisi);

  return (
    <form action={action} data-testid="devoir-formulaire" className="carte w-full min-w-0 max-w-3xl p-4 sm:p-6">
      {modification ? <input type="hidden" name="devoir" value={valeurs.id} /> : null}

      {!modification ? (
        <div className="mb-6 border-b border-[color:var(--color-bordure)] pb-5">
          <h3 className="m-0 text-xl font-bold">Nouveau devoir</h3>
        </div>
      ) : null}

      {!modification ? (
        <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor={`${base}-cours`}>
              Classe
            </label>
            <select
              id={`${base}-cours`}
              data-testid="devoir-cours"
              name="cours"
              required
              className="champ"
              value={coursChoisi}
              onChange={(evenement) => setCoursChoisi(evenement.target.value)}
            >
              {cours.map((unCours) => (
                <option key={unCours.id} value={unCours.id}>
                  {unCours.libelle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiquette" htmlFor={`${base}-seance`}>
              Rattacher à une séance
            </label>
            <select
              id={`${base}-seance`}
              data-testid="devoir-seance"
              name="seance"
              className="champ"
              defaultValue=""
            >
              <option value="">Sans séance</option>
              {seancesDuCours.map((seance) => (
                <option key={seance.id} value={seance.id}>
                  {seance.titre}
                </option>
              ))}
            </select>
            <p className="aide-champ">
              Facultatif. Un devoir rattaché reste visible depuis la séance.
            </p>
          </div>
        </div>
        </>
      ) : null}

      <div className={modification ? "" : "mt-4"}>
        <label className="etiquette" htmlFor={`${base}-titre`}>
          Titre du devoir
        </label>
        <input
          id={`${base}-titre`}
          data-testid="devoir-titre-champ"
          name="titre"
          type="text"
          required
          maxLength={160}
          defaultValue={valeurs?.titre ?? ""}
          placeholder="Devoir maison n° 2"
          className="champ"
        />
      </div>

      <div className="mt-4">
        <label className="etiquette" htmlFor={`${base}-consigne`}>
          Consigne
        </label>
        <textarea
          id={`${base}-consigne`}
          data-testid="devoir-consigne"
          name="consigne"
          rows={4}
          maxLength={5000}
          defaultValue={valeurs?.consigne ?? ""}
          className="champ min-h-[7rem] py-2.5"
        />
      </div>

      <fieldset className="m-0 mt-5 border-0 p-0">
        <legend className="mb-2 text-base font-bold">Comment les élèves rendent-ils le travail ?</legend>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["numerique", "Fichier en ligne", "Les élèves déposent leur copie en ligne."],
            ["papier", "Sur papier", "La copie est remise en classe."],
            ["mixte", "Papier ou fichier", "Papier ou fichier, selon l’élève."],
            ["aucune", "Rien à rendre", "Un travail à faire, sans dépôt de copie."],
          ].map(([valeur, libelle]) => (
            <label key={valeur} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${mode === valeur ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] hover:border-[color:var(--color-accent)]"}`}>
              <input
                type="radio"
                name="mode"
                value={valeur}
                data-testid={`mode-${valeur}`}
                checked={mode === valeur}
                onChange={() => setMode(valeur!)}
                className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="min-w-0"><span className="block font-bold">{libelle}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <details open={Boolean(valeurs?.date)} className="mt-4 rounded-xl border border-[color:var(--color-bordure)] p-4">
        <summary className="cursor-pointer font-semibold">Date de remise (facultatif)</summary>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor={`${base}-date`}>
            À rendre le
          </label>
          <input
            id={`${base}-date`}
            data-testid="devoir-date"
            name="date"
            type="date"
            defaultValue={valeurs?.date ?? ""}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor={`${base}-heure`}>
            À quelle heure
          </label>
          <input
            id={`${base}-heure`}
            data-testid="devoir-heure"
            name="heure"
            type="time"
            defaultValue={valeurs?.heure ?? ""}
            className="champ"
          />
          <p className="aide-champ">
            Heure de Paris. Sans précision, l&apos;échéance tombe à 23 h 59.
          </p>
        </div>
      </div>

      </details>
      {attendUnFichier ? (
        <details className="mt-6 rounded-xl border border-[color:var(--color-bordure)] p-4">
          <summary className="cursor-pointer text-sm font-bold text-[color:var(--color-accent)]">Options de remise (facultatif)</summary>
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor={`${base}-remplacement`}>
              Remplacer sa copie
            </label>
            <select
              id={`${base}-remplacement`}
              data-testid="devoir-remplacement"
              name="remplacement"
              className="champ"
              defaultValue={valeurs === undefined || valeurs.remplacement ? "oui" : "non"}
            >
              <option value="oui">Autorisé jusqu&apos;à l&apos;échéance</option>
              <option value="non">Une seule remise</option>
            </select>
          </div>

          <div>
            <label className="etiquette" htmlFor={`${base}-retard`}>
              Après l&apos;échéance
            </label>
            <select
              id={`${base}-retard`}
              data-testid="devoir-retard"
              name="retard"
              className="champ"
              defaultValue={valeurs?.retard ?? "accepter_avec_retard"}
            >
              <option value="accepter_avec_retard">Accepter, en notant le retard</option>
              <option value="fermer">Fermer la remise</option>
            </select>
          </div>
          </div>
        </details>
      ) : (
        <>
          <input type="hidden" name="remplacement" value="oui" />
          <input type="hidden" name="retard" value="accepter_avec_retard" />
        </>
      )}

      {etat.etat !== "vierge" ? (
        <p
          role={etat.etat === "erreur" ? "alert" : "status"}
          data-testid="devoir-retour"
          className={`m-0 mt-4 rounded-[var(--radius-champ)] p-3 text-[length:var(--text-tableau)] ${
            etat.etat === "erreur"
              ? "border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]"
              : "border border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]"
          }`}
        >
          {etat.message}
        </p>
      ) : null}

      <Bouton libelle={modification ? "Enregistrer le devoir" : "Créer mon brouillon"} />

      {!modification ? (
        <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Rien n&apos;est envoyé aux élèves pour le moment. Tu pourras relire ton devoir et le publier quand il sera prêt.
        </p>
      ) : null}
    </form>
  );
}

function Bouton({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="devoir-valider"
      disabled={pending}
      className="bouton bouton-primaire mt-5 w-full min-w-0 whitespace-normal py-3 text-center leading-5 sm:w-auto"
    >
      {pending ? "Enregistrement…" : libelle}
    </button>
  );
}

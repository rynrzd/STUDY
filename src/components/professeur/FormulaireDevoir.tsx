"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
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
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [titre, setTitre] = useState(valeurs?.titre ?? "");
  const [consigne, setConsigne] = useState(valeurs?.consigne ?? "");
  const [date, setDate] = useState(valeurs?.date ?? "");
  const [heure, setHeure] = useState(valeurs?.heure ?? "");
  const champTitre = useRef<HTMLInputElement>(null);
  const etapePrecedente = useRef(etape);

  useEffect(() => {
    if (modification || etapePrecedente.current === etape) return;
    etapePrecedente.current = etape;
    document.getElementById(`${base}-etape-${etape}`)?.focus();
  }, [base, etape, modification]);

  const attendUnFichier = mode === "numerique" || mode === "mixte";
  const seancesDuCours = seances.filter((seance) => seance.cours === coursChoisi);
  const libelleCours = cours.find((unCours) => unCours.id === coursChoisi)?.libelle ?? "Classe non choisie";
  const libelleMode = {
    numerique: "Fichier en ligne",
    papier: "Sur papier",
    mixte: "Papier ou fichier",
    aucune: "Rien à rendre",
  }[mode];

  function avancer() {
    if (etape === 2) {
      champTitre.current?.setCustomValidity(titre.trim() ? "" : "Indique un titre pour le devoir.");
      if (!champTitre.current?.reportValidity()) return;
    }
    setEtape(etape === 1 ? 2 : 3);
  }

  return (
    <form
      action={action}
      noValidate={!modification}
      onSubmit={(evenement) => {
        if (!modification && etape !== 3) {
          evenement.preventDefault();
          avancer();
        }
      }}
      data-testid="devoir-formulaire"
      className="carte w-full min-w-0 max-w-3xl p-4 sm:p-6"
    >
      {modification ? <input type="hidden" name="devoir" value={valeurs.id} /> : null}

      {!modification ? (
        <div className="mb-6 border-b border-[color:var(--color-bordure)] pb-5">
          <h3 className="m-0 text-xl font-bold">Nouveau devoir</h3>
          <p className="m-0 mt-2 text-sm text-[color:var(--color-encre-faible)]">
            Trois petites étapes, puis un brouillon à relire avant la publication.
          </p>
          <ol className="mt-5 grid list-none grid-cols-3 gap-2 p-0" aria-label="Progression du devoir">
            {(["Pour qui ?", "Quoi faire ?", "Quand et comment ?"] as const).map((libelle, index) => (
              <li
                key={libelle}
                aria-current={etape === index + 1 ? "step" : undefined}
                className={`rounded-lg border px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
                  etape === index + 1
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"
                    : "border-[color:var(--color-bordure)] text-[color:var(--color-encre-faible)]"
                }`}
              >
                <span className="block text-[11px]">Étape {index + 1}/3</span>
                {libelle}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!modification ? (
        <section aria-label="Choisir les destinataires" className={etape === 1 ? "" : "hidden"}>
        <h4 id={`${base}-etape-1`} tabIndex={-1} className="m-0 mb-4 text-lg font-bold">Pour quelle classe ?</h4>
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
              key={coursChoisi}
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
        </section>
      ) : null}

      <section aria-label="Décrire le travail" className={!modification && etape !== 2 ? "hidden" : ""}>
      {!modification ? <h4 id={`${base}-etape-2`} tabIndex={-1} className="m-0 mb-4 text-lg font-bold">Quel travail donner ?</h4> : null}
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
          ref={champTitre}
          value={titre}
          onChange={(evenement) => {
            evenement.target.setCustomValidity("");
            setTitre(evenement.target.value);
          }}
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
          value={consigne}
          onChange={(evenement) => setConsigne(evenement.target.value)}
          className="champ min-h-[7rem] py-2.5"
        />
      </div>
      </section>

      <section aria-label="Organiser la remise" className={!modification && etape !== 3 ? "hidden" : ""}>
      {!modification ? <h4 id={`${base}-etape-3`} tabIndex={-1} className="m-0 mb-4 text-lg font-bold">Quand et comment rendre ?</h4> : null}
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
            value={date}
            onChange={(evenement) => setDate(evenement.target.value)}
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
            value={heure}
            onChange={(evenement) => setHeure(evenement.target.value)}
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

      {!modification ? (
        <aside className="mt-6 rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4" data-testid="devoir-recapitulatif">
          <h5 className="m-0 text-base font-bold">Avant d&apos;enregistrer le brouillon</h5>
          <dl className="mb-0 mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="font-semibold">Classe</dt><dd className="m-0">{libelleCours}</dd>
            <dt className="font-semibold">Devoir</dt><dd className="m-0 break-words">{titre.trim() || "Titre à compléter"}</dd>
            <dt className="font-semibold">Consigne</dt><dd className="m-0 whitespace-pre-wrap break-words">{consigne.trim() || "Aucune consigne supplémentaire"}</dd>
            <dt className="font-semibold">Remise</dt><dd className="m-0">{libelleMode}</dd>
            <dt className="font-semibold">Échéance</dt><dd className="m-0">{date ? `${date.split("-").reverse().join("/")} à ${heure || "23 h 59"}` : "Aucune date limite"}</dd>
          </dl>
          <p className="m-0 mt-3 text-sm font-semibold text-[color:var(--color-accent)]">
            Les élèves ne verront rien tant que tu n&apos;auras pas publié ce devoir.
          </p>
        </aside>
      ) : null}
      </section>

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

      {!modification && etape !== 1 ? (
        <button type="button" data-testid="devoir-precedent" className="bouton bouton-secondaire mt-5 mr-3" onClick={() => setEtape(etape === 3 ? 2 : 1)}>
          Étape précédente
        </button>
      ) : null}
      {!modification && etape !== 3 ? (
        <button type="button" data-testid="devoir-suivant" className="bouton bouton-primaire mt-5" onClick={avancer}>
          Continuer
        </button>
      ) : null}
      {modification || etape === 3 ? <Bouton libelle={modification ? "Enregistrer le devoir" : "Créer mon brouillon"} /> : null}

      {!modification && etape === 3 ? (
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

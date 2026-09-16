"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  affecterUnProfesseur,
  creerUnCompte,
  creerUneClasse,
  creerUneMatiere,
} from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

/**
 * Formulaires d'administration — cahier V2, §14.2 à §14.4.
 *
 * Tous suivent la même forme : des champs courts, un seul bouton, et une
 * réponse écrite sous le formulaire. Aucun ne dépend de JavaScript pour
 * fonctionner — `useActionState` améliore l'expérience, il ne la conditionne
 * pas : sans JS, le navigateur poste et la page se recharge avec le résultat.
 */

export interface Option {
  readonly id: string;
  readonly label: string;
}

/* ----------------------------------------------------------- Classes ----- */

export function FormulaireClasse() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUneClasse, ETAT_ADMIN_INITIAL);

  return (
    <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
      <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Nouvelle classe
      </h2>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Le nom est celui que verront les professeurs et les élèves. Créer deux
        fois la même classe ne la duplique pas.
      </p>

      <label className="etiquette mt-4" htmlFor="classe-label">
        Nom de la classe
      </label>
      <input
        id="classe-label"
        name="label"
        type="text"
        className="champ"
        placeholder="Seconde 4"
        required
        maxLength={80}
      />

      <Bouton libelle="Créer la classe" />
      <Retour etat={etat} />
    </form>
  );
}

/* ---------------------------------------------------------- Matières ----- */

export function FormulaireMatiere() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUneMatiere, ETAT_ADMIN_INITIAL);

  return (
    <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
      <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Nouvelle matière
      </h2>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Les matières sont propres à votre établissement : vous gardez vos
        intitulés.
      </p>

      <label className="etiquette mt-4" htmlFor="matiere-label">
        Nom de la matière
      </label>
      <input
        id="matiere-label"
        name="label"
        type="text"
        className="champ"
        placeholder="Mathématiques"
        required
        maxLength={80}
      />

      <Bouton libelle="Créer la matière" />
      <Retour etat={etat} />
    </form>
  );
}

/* ------------------------------------------------------- Affectation ----- */

export function FormulaireAffectation({
  professeurs,
  listeClasses,
  matieres,
}: {
  professeurs: readonly Option[];
  listeClasses: readonly Option[];
  matieres: readonly Option[];
}) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(
    affecterUnProfesseur,
    ETAT_ADMIN_INITIAL,
  );

  const incomplet =
    professeurs.length === 0 || listeClasses.length === 0 || matieres.length === 0;

  return (
    <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
      <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Affecter un professeur
      </h2>
      <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Un professeur, une classe, une matière : c&apos;est ce qui fait apparaître
        le cours dans son Studio, et les séances publiées chez les élèves de la
        classe.
      </p>

      {incomplet ? (
        <p className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          Il faut au moins un professeur, une classe et une matière pour créer une
          affectation.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Choix nom="professeur" libelle="Professeur" options={professeurs} />
            <Choix nom="classe" libelle="Classe" options={listeClasses} />
            <Choix nom="matiere" libelle="Matière" options={matieres} />
          </div>
          <Bouton libelle="Affecter" />
        </>
      )}

      <Retour etat={etat} />
    </form>
  );
}

/* ------------------------------------------------------------ Compte ----- */

export function FormulaireCompte({ listeClasses }: { listeClasses: readonly Option[] }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUnCompte, ETAT_ADMIN_INITIAL);

  return (
    <div>
      <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
        <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Nouveau compte
        </h2>
        <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          Pour un arrivant en cours d&apos;année. L&apos;identifiant de connexion
          est calculé à partir du nom ; le mot de passe temporaire s&apos;affiche
          une seule fois, à imprimer et à remettre en main propre.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="compte-prenom">
              Prénom
            </label>
            <input
              id="compte-prenom"
              name="prenom"
              type="text"
              className="champ"
              required
              maxLength={60}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="compte-nom">
              Nom
            </label>
            <input
              id="compte-nom"
              name="nom"
              type="text"
              className="champ"
              required
              maxLength={60}
              autoComplete="off"
            />
          </div>
        </div>

        <fieldset className="mt-4 border-0 p-0">
          <legend className="etiquette p-0">Rôle</legend>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[length:var(--text-tableau)]">
              <input type="radio" name="role" value="eleve" defaultChecked /> Élève
            </label>
            <label className="flex items-center gap-2 text-[length:var(--text-tableau)]">
              <input type="radio" name="role" value="professeur" /> Professeur
            </label>
          </div>
        </fieldset>

        {listeClasses.length > 0 ? (
          <div className="mt-4">
            <label className="etiquette" htmlFor="compte-classe">
              Classe <span className="font-normal">(obligatoire pour un élève)</span>
            </label>
            <select id="compte-classe" name="classe" className="champ" defaultValue="">
              <option value="">Sans classe</option>
              {listeClasses.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Aucune classe n&apos;existe encore : créez-en une avant d&apos;ajouter
            un élève.
          </p>
        )}

        <div className="mt-4">
          <label className="etiquette" htmlFor="compte-email">
            Adresse professionnelle <span className="font-normal">(professeur, facultatif)</span>
          </label>
          <input
            id="compte-email"
            name="email"
            type="email"
            className="champ"
            maxLength={120}
            autoComplete="off"
          />
          <p className="aide-champ">
            Les élèves n&apos;ont pas d&apos;adresse dans AvecStudy : rien ne leur
            est envoyé par courriel.
          </p>
        </div>

        <Bouton libelle="Créer le compte" />
        <Retour etat={etat} />
      </form>

      {etat.etat === "ok" && etat.acces !== undefined ? (
        <FicheAcces acces={etat.acces} />
      ) : null}
    </div>
  );
}

/**
 * Fiche d'accès imprimable.
 *
 * Le mot de passe n'existe qu'ici et qu'une fois : il n'est stocké nulle part
 * en clair, et rechargeant la page il aura disparu. C'est volontaire — une
 * liste de mots de passe consultable serait une liste de mots de passe à
 * dérober.
 */
function FicheAcces({
  acces,
}: {
  acces: {
    prenom: string;
    nom: string;
    role: string;
    classe: string | null;
    login: string;
    motDePasseTemporaire: string;
  };
}) {
  return (
    <section className="carte mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h3 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Fiche d&apos;accès
          </h3>
          <p className="m-0 mt-1.5 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            À imprimer maintenant et à remettre en main propre. Ce mot de passe ne
            sera plus affiché : il est temporaire, et la personne en choisira un
            autre à sa première connexion.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="bouton bouton-secondaire bouton-compact"
        >
          Imprimer
        </button>
      </div>

      <dl className="m-0 mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Champ terme="Nom" valeur={`${acces.prenom} ${acces.nom}`} />
        <Champ terme="Rôle" valeur={acces.role === "eleve" ? "Élève" : "Professeur"} />
        {acces.classe === null ? null : <Champ terme="Classe" valeur={acces.classe} />}
        <Champ terme="Identifiant" valeur={acces.login} mono />
        <Champ terme="Mot de passe temporaire" valeur={acces.motDePasseTemporaire} mono />
      </dl>
    </section>
  );
}

function Champ({ terme, valeur, mono = false }: { terme: string; valeur: string; mono?: boolean }) {
  return (
    <div>
      <dt className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {terme}
      </dt>
      <dd className={`m-0 mt-0.5 font-semibold ${mono ? "font-mono text-[1rem]" : ""}`}>
        {valeur}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Choix({
  nom,
  libelle,
  options,
}: {
  nom: string;
  libelle: string;
  options: readonly Option[];
}) {
  return (
    <div>
      <label className="etiquette" htmlFor={`affectation-${nom}`}>
        {libelle}
      </label>
      <select id={`affectation-${nom}`} name={nom} className="champ" required defaultValue="">
        <option value="" disabled>
          Choisir…
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Bouton({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-rose mt-4">
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.etat === "vierge" || etat.message === undefined) return null;
  return (
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
  );
}

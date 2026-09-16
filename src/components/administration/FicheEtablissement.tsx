"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ajouterAdministrateur,
  desactiverCompte,
  ETAT_ACTION_INITIAL,
  majEtatEtablissement,
  type EtatAction,
} from "@/app/administration/actions";
import type { Etablissement, MembreEtablissement } from "@/lib/administration";

/**
 * Un établissement : son état, ses comptes, et les deux opérations sensibles.
 *
 * Les deux opérations qui coupent un accès — suspendre l'établissement,
 * suspendre un compte — exigent un motif écrit. Ce n'est pas une formalité :
 * il part au journal d'audit, et c'est lui qu'on relit quand une direction
 * demande pourquoi un professeur a perdu l'accès un mardi matin.
 */
export function FicheEtablissement({
  etablissement,
  membres,
}: {
  etablissement: Etablissement;
  membres: MembreEtablissement[];
}) {
  const [onglet, setOnglet] = useState<"etat" | "comptes">("etat");

  return (
    <article className="carte p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              {etablissement.name}
            </h2>
            <EtatEtablissement etat={etablissement.state} />
          </div>
          <p className="m-0 mt-1.5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Code <span className="font-mono font-semibold">{etablissement.public_code}</span>
            {etablissement.commune === null ? "" : ` · ${etablissement.commune}`}
            {` · ${membres.length} compte${membres.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Sections" className="mt-5 flex gap-6 border-b border-[color:var(--color-bordure)]">
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "etat"}
          onClick={() => setOnglet("etat")}
          className="onglet"
        >
          État et accès
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "comptes"}
          onClick={() => setOnglet("comptes")}
          className="onglet"
        >
          Comptes ({membres.length})
        </button>
      </div>

      {onglet === "etat" ? (
        <div className="grid gap-6 pt-5 lg:grid-cols-2">
          <FormulaireEtat etablissement={etablissement} />
          <FormulaireAdministrateur etablissement={etablissement} />
        </div>
      ) : (
        <ListeComptes etablissement={etablissement} membres={membres} />
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function FormulaireEtat({ etablissement }: { etablissement: Etablissement }) {
  const [etat, action] = useActionState<EtatAction, FormData>(
    majEtatEtablissement,
    ETAT_ACTION_INITIAL,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organisation" value={etablissement.id} />
      <h3 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
        Changer l&apos;état
      </h3>

      <div>
        <label className="etiquette" htmlFor={`etat-${etablissement.id}`}>
          Nouvel état
        </label>
        <select
          id={`etat-${etablissement.id}`}
          name="etat"
          className="champ"
          defaultValue={etablissement.state}
        >
          <option value="preparation">Préparation</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
          <option value="archive">Archivé</option>
        </select>
      </div>

      <div>
        <label className="etiquette" htmlFor={`motif-${etablissement.id}`}>
          Motif
        </label>
        <input
          id={`motif-${etablissement.id}`}
          name="motif"
          type="text"
          className="champ"
          minLength={10}
          required
          aria-describedby={`aide-motif-${etablissement.id}`}
        />
        <span className="aide-champ" id={`aide-motif-${etablissement.id}`}>
          Inscrit au journal. Suspendre coupe les sessions en cours.
        </span>
      </div>

      <Bouton libelle="Appliquer" variante="secondaire" />
      <Retour etat={etat} />
    </form>
  );
}

function FormulaireAdministrateur({ etablissement }: { etablissement: Etablissement }) {
  const [etat, action] = useActionState<EtatAction, FormData>(
    ajouterAdministrateur,
    ETAT_ACTION_INITIAL,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organisation" value={etablissement.id} />
      <input type="hidden" name="code" value={etablissement.public_code} />

      <h3 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
        Créer un administrateur
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor={`prenom-${etablissement.id}`}>
            Prénom
          </label>
          <input id={`prenom-${etablissement.id}`} name="prenom" type="text" className="champ" required />
        </div>
        <div>
          <label className="etiquette" htmlFor={`nom-${etablissement.id}`}>
            Nom
          </label>
          <input id={`nom-${etablissement.id}`} name="nom" type="text" className="champ" required />
        </div>
      </div>

      <div>
        <label className="etiquette" htmlFor={`email-${etablissement.id}`}>
          Adresse professionnelle
        </label>
        <input id={`email-${etablissement.id}`} name="email" type="email" className="champ" required />
      </div>

      <div>
        <label className="etiquette" htmlFor={`identifiant-${etablissement.id}`}>
          Identifiant de connexion
        </label>
        <input
          id={`identifiant-${etablissement.id}`}
          name="identifiant"
          type="text"
          className="champ"
          required
          aria-describedby={`aide-id-${etablissement.id}`}
        />
        <span className="aide-champ" id={`aide-id-${etablissement.id}`}>
          Minuscules, sans espace. Exemple : p.martin
        </span>
      </div>

      <Bouton libelle="Créer le compte" variante="secondaire" />

      {etat.etat === "ok" && etat.acces ? (
        <div
          role="status"
          className="rounded-[var(--radius-champ)] border border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-4"
        >
          <p className="m-0 font-semibold text-[color:var(--color-succes)]">
            Accès créés — notez-les maintenant
          </p>
          <dl className="m-0 mt-3 space-y-1.5 font-mono text-[length:var(--text-tableau)]">
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Code :</dt>
              <dd className="m-0 font-semibold">{etat.acces.code}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Identifiant :</dt>
              <dd className="m-0 font-semibold">{etat.acces.identifiant}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Mot de passe :</dt>
              <dd className="m-0 font-semibold">{etat.acces.motDePasseTemporaire}</dd>
            </div>
          </dl>
          <p className="m-0 mt-3 font-sans text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
            Ce mot de passe est temporaire et ne sera plus affiché. Il n&apos;ouvre
            que l&apos;écran de choix du mot de passe.
          </p>
        </div>
      ) : (
        <Retour etat={etat} />
      )}
    </form>
  );
}

function ListeComptes({
  etablissement,
  membres,
}: {
  etablissement: Etablissement;
  membres: MembreEtablissement[];
}) {
  const [etat, action] = useActionState<EtatAction, FormData>(
    desactiverCompte,
    ETAT_ACTION_INITIAL,
  );

  if (membres.length === 0) {
    return (
      <p className="m-0 pt-5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        Aucun compte dans cet établissement. Créez son administrateur depuis
        l&apos;onglet « État et accès » : c&apos;est lui qui importera ensuite
        les classes.
      </p>
    );
  }

  return (
    <div className="pt-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[length:var(--text-tableau)]">
          <caption className="sr-only">Comptes de l&apos;établissement</caption>
          <thead>
            <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
              <th scope="col" className="p-2.5 font-semibold">Identifiant</th>
              <th scope="col" className="p-2.5 font-semibold">Rôles</th>
              <th scope="col" className="p-2.5 font-semibold">État</th>
              <th scope="col" className="p-2.5 font-semibold">Suspendre</th>
            </tr>
          </thead>
          <tbody>
            {membres.map((membre) => (
              <tr key={membre.profile_id} className="border-b border-[color:var(--color-bordure)]">
                <th scope="row" className="p-2.5 text-left font-mono font-normal">
                  {membre.local_login}
                </th>
                <td className="p-2.5 text-[color:var(--color-encre-faible)]">
                  {membre.roles.join(", ")}
                </td>
                <td className="p-2.5 text-[color:var(--color-encre-faible)]">
                  {membre.account_state}
                </td>
                <td className="p-2.5">
                  {membre.account_state === "suspendu" ? (
                    <span className="text-[color:var(--color-encre-faible)]">—</span>
                  ) : (
                    <form action={action} className="flex gap-2">
                      <input type="hidden" name="organisation" value={etablissement.id} />
                      <input type="hidden" name="profil" value={membre.profile_id} />
                      <label className="sr-only" htmlFor={`motif-compte-${membre.profile_id}`}>
                        Motif de suspension de {membre.local_login}
                      </label>
                      <input
                        id={`motif-compte-${membre.profile_id}`}
                        name="motif"
                        type="text"
                        placeholder="Motif (10 car. min.)"
                        minLength={10}
                        required
                        className="champ min-h-9 py-1 text-[length:var(--text-aide)]"
                      />
                      <Bouton libelle="Suspendre" variante="secondaire" compact />
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Retour etat={etat} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Bouton({
  libelle,
  variante,
  compact = false,
}: {
  libelle: string;
  variante: "primaire" | "secondaire";
  compact?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`bouton bouton-${variante} ${compact ? "min-h-9 shrink-0 px-3 text-[length:var(--text-aide)]" : ""}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatAction }) {
  if (etat.etat === "vierge" || !etat.message) return null;
  return (
    <p
      role="status"
      className={`m-0 mt-3 text-[length:var(--text-aide)] ${
        etat.etat === "ok"
          ? "text-[color:var(--color-succes)]"
          : "text-[color:var(--color-erreur)]"
      }`}
    >
      {etat.message}
    </p>
  );
}

function EtatEtablissement({ etat }: { etat: string }) {
  const tons: Record<string, string> = {
    preparation: "bg-[color:var(--color-surface-douce)] text-[color:var(--color-encre-faible)]",
    actif: "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]",
    suspendu: "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]",
    archive: "bg-[color:var(--color-surface-douce)] text-[color:var(--color-encre-faible)]",
  };
  const libelles: Record<string, string> = {
    preparation: "Préparation",
    actif: "Actif",
    suspendu: "Suspendu",
    archive: "Archivé",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[length:var(--text-aide)] font-semibold ${
        tons[etat] ?? tons.preparation
      }`}
    >
      {libelles[etat] ?? etat}
    </span>
  );
}

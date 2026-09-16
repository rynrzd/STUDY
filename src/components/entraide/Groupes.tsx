"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { creerGroupe, quitterGroupe, rejoindreGroupe } from "@/app/eleve/entraide/actions";
import { ETAT_ENTRAIDE_INITIAL, type EtatEntraide } from "@/app/eleve/entraide/etats";

/**
 * Groupes d'entraide — cahier V2, §13.
 *
 * Trois gestes : créer, rejoindre, quitter. Chacun est un formulaire à part
 * entière, donc chacun fonctionne sans JavaScript.
 *
 * Les prénoms des membres sont affichés, pas leurs identifiants : c'est une
 * liste de camarades de classe, pas un annuaire.
 */

export interface GroupeAffiche {
  readonly id: string;
  readonly label: string;
  readonly maxMembres: number;
  readonly membres: { readonly id: string; readonly prenom: string; readonly nom: string }[];
  readonly jEnSuis: boolean;
  readonly complet: boolean;
}

export function Groupes({ cours, groupes }: { cours: string; groupes: readonly GroupeAffiche[] }) {
  return (
    <>
      <ul className="m-0 mt-6 grid list-none gap-4 p-0 sm:grid-cols-2">
        {groupes.map((groupe) => (
          <li key={groupe.id} className="carte flex flex-col p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                {groupe.label}
              </h3>
              <span
                className={`pastille ${
                  groupe.complet ? "pastille-attention" : "pastille-publie"
                }`}
              >
                {groupe.membres.length} / {groupe.maxMembres}
              </span>
            </div>

            <p className="m-0 mt-2 flex-1 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
              {groupe.membres.length === 0
                ? "Personne pour l'instant."
                : groupe.membres
                    .map((membre) => `${membre.prenom} ${membre.nom.slice(0, 1).toUpperCase()}.`)
                    .join(", ")}
            </p>

            <div className="mt-4">
              {groupe.jEnSuis ? (
                <FormulaireGroupe
                  action={quitterGroupe}
                  groupe={groupe.id}
                  libelle="Quitter"
                  style="bouton-discret"
                />
              ) : groupe.complet ? (
                <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                  Ce groupe est complet.
                </p>
              ) : (
                <FormulaireGroupe
                  action={rejoindreGroupe}
                  groupe={groupe.id}
                  libelle="Rejoindre"
                  style="bouton-secondaire"
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <NouveauGroupe cours={cours} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function FormulaireGroupe({
  action,
  groupe,
  libelle,
  style,
}: {
  action: (precedent: EtatEntraide, donnees: FormData) => Promise<EtatEntraide>;
  groupe: string;
  libelle: string;
  style: string;
}) {
  const [etat, envoyer] = useActionState<EtatEntraide, FormData>(action, ETAT_ENTRAIDE_INITIAL);

  return (
    <form action={envoyer}>
      <input type="hidden" name="groupe" value={groupe} />
      <Bouton libelle={libelle} style={style} />
      <Retour etat={etat} />
    </form>
  );
}

export function NouveauGroupe({ cours }: { cours: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState<EtatEntraide, FormData>(
    creerGroupe,
    ETAT_ENTRAIDE_INITIAL,
  );

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="bouton bouton-rose">
        + Créer un groupe
      </button>
    );
  }

  return (
    <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
      <h3 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Nouveau groupe
      </h3>
      <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Le groupe est visible par les élèves de ce cours, et par votre
        professeur. Vous en faites partie dès sa création.
      </p>

      <input type="hidden" name="cours" value={cours} />

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <label className="etiquette" htmlFor="groupe-label">
            Nom du groupe
          </label>
          <input
            id="groupe-label"
            name="label"
            type="text"
            className="champ"
            placeholder="Révisions du chapitre 4"
            required
            autoFocus
            minLength={2}
            maxLength={80}
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="groupe-taille">
            Taille maximale
          </label>
          <select id="groupe-taille" name="taille" className="champ" defaultValue="4">
            {[2, 3, 4, 5, 6].map((taille) => (
              <option key={taille} value={taille}>
                {taille} élèves
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton libelle="Créer le groupe" style="bouton-rose" />
        <button type="button" onClick={() => setOuvert(false)} className="bouton bouton-discret">
          Annuler
        </button>
      </div>

      <Retour etat={etat} />
    </form>
  );
}

function Bouton({ libelle, style }: { libelle: string; style: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`bouton ${style}`}>
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatEntraide }) {
  if (etat.etat === "vierge" || etat.message === undefined) return null;
  return (
    <p
      role="status"
      className={`m-0 mt-2 text-[length:var(--text-aide)] ${
        etat.etat === "ok"
          ? "text-[color:var(--color-succes)]"
          : "text-[color:var(--color-erreur)]"
      }`}
    >
      {etat.message}
    </p>
  );
}

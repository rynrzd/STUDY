"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  ajouterEtablissement,
  ETAT_ACTION_INITIAL,
  type EtatAction,
} from "@/app/administration/actions";

/**
 * Création d'un établissement.
 *
 * Le code proposé est modifiable : un lycée préfère souvent un code qu'il
 * reconnaît, et il sera imprimé sur les fiches de rentrée. Il n'est pas secret.
 */
export function FormulaireEtablissement({ codePropose }: { codePropose: string }) {
  const [etat, action] = useActionState<EtatAction, FormData>(
    ajouterEtablissement,
    ETAT_ACTION_INITIAL,
  );

  return (
    <aside className="carte p-6">
      <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
        Nouvel établissement
      </h2>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Créé à l&apos;état « préparation » : personne ne peut s&apos;y connecter
        tant qu&apos;il n&apos;est pas activé.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <div>
          <label className="etiquette" htmlFor="etab-nom">
            Nom
          </label>
          <input id="etab-nom" name="nom" type="text" className="champ" required maxLength={120} />
        </div>

        <div>
          <label className="etiquette" htmlFor="etab-code">
            Code établissement
          </label>
          <input
            id="etab-code"
            name="code"
            type="text"
            className="champ uppercase"
            defaultValue={codePropose}
            required
            maxLength={16}
            aria-describedby="aide-etab-code"
          />
          <span className="aide-champ" id="aide-etab-code">
            Saisi à la connexion. Public, jamais secret.
          </span>
        </div>

        <div>
          <label className="etiquette" htmlFor="etab-type">
            Type
          </label>
          <select id="etab-type" name="type" className="champ" defaultValue="public">
            <option value="public">Établissement public</option>
            <option value="prive">Établissement privé sous contrat</option>
            <option value="autre">Autre structure</option>
          </select>
        </div>

        <div>
          <label className="etiquette" htmlFor="etab-commune">
            Commune
          </label>
          <input id="etab-commune" name="commune" type="text" className="champ" maxLength={120} />
        </div>

        <Bouton />

        {etat.etat !== "vierge" && etat.message ? (
          <p
            role="status"
            className={`m-0 text-[length:var(--text-aide)] ${
              etat.etat === "ok"
                ? "text-[color:var(--color-succes)]"
                : "text-[color:var(--color-erreur)]"
            }`}
          >
            {etat.message}
          </p>
        ) : null}
      </form>
    </aside>
  );
}

function Bouton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire w-full">
      {pending ? "Création…" : "Créer l'établissement"}
    </button>
  );
}

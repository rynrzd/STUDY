"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { trouverEtablissement } from "@/app/connexion/actions";
import { ETAT_ETABLISSEMENT_INITIAL, type EtatEtablissement } from "@/app/connexion/etats";

/**
 * Étape 1 — « Trouver mon établissement ».
 *
 * Accepte le code établissement (sur la fiche remise par le lycée) ou un lien
 * d'invitation collé tel quel. Ne propose ni liste ni recherche par nom :
 * on ne découvre un établissement qu'en connaissant son code.
 */
export function FormulaireEtablissement({ suite, codeInitial }: { suite: string | null; codeInitial: string | null }) {
  const [etat, action] = useActionState<EtatEtablissement, FormData>(async (precedent, donnees) => {
    // Champ vide : rien ne part au serveur, aucun essai n'est consommé.
    if (String(donnees.get("code") ?? "").trim() === "") return { etat: "refus", message: "Indique le code de ton établissement." };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { etat: "refus", message: "Pas de connexion internet. Vérifie ton réseau, puis réessaie.", code: String(donnees.get("code") ?? "") };
    }
    try {
      return await trouverEtablissement(precedent, donnees);
    } catch (e) {
      if (e instanceof TypeError) return { etat: "refus", message: "La requête n'a pas abouti : connexion internet interrompue. Réessaie.", code: String(donnees.get("code") ?? "") };
      throw e;
    }
  }, ETAT_ETABLISSEMENT_INITIAL);
  const erreur = etat.etat === "refus" ? etat.message : null;

  return (
    <form action={action} noValidate>
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}
      <label className="etiquette" htmlFor="code-etablissement">
        Code établissement ou lien d&apos;invitation
      </label>
      <input
        id="code-etablissement"
        name="code"
        type="text"
        className="champ champ-acces"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={400}
        defaultValue={etat.code ?? codeInitial ?? ""}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={`aide-code-etablissement${erreur ? " erreur-code-etablissement" : ""}`}
        required
      />
      {erreur ? (
        <p id="erreur-code-etablissement" role="alert" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
          {erreur}
        </p>
      ) : null}
      <p id="aide-code-etablissement" className="aide-champ m-0">
        Il figure sur la fiche remise par ton lycée, par exemple <span className="font-mono">LYC-4821</span>. Il ne donne accès à aucun compte.
      </p>
      <Continuer />
    </form>
  );
}

function Continuer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bouton bouton-primaire bouton-acces mt-6 w-full" disabled={pending} data-testid="etablissement-continuer">
      {pending ? (
        <>
          <Loader2 size={18} strokeWidth={2} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Recherche…
        </>
      ) : (
        "Continuer"
      )}
    </button>
  );
}

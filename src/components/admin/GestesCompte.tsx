"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { changerLEtatDUnCompte, reinitialiserUnAcces } from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";
import { FicheImprimable } from "./FicheImprimable";

/**
 * Les gestes possibles sur un compte — cahier V5, §7.3 et §9.
 *
 * Deux gestes, et tous deux demandent confirmation avant d'agir : l'un coupe
 * la connexion de quelqu'un, l'autre change son mot de passe. Le §9 l'exige
 * pour toute action destructive, et la raison est banale — ces boutons vivent
 * au bout d'une ligne de tableau, à quelques pixels de la ligne voisine.
 *
 * La confirmation est un second bouton, pas une boîte de dialogue du
 * navigateur : elle reste lisible au clavier, à la loupe, et sur un téléphone.
 */
export function GestesCompte({
  profil,
  nom,
  prenom,
  classe,
  professeur,
  actif,
  codeEtablissement,
}: {
  profil: string;
  nom: string;
  prenom: string;
  classe: string | null;
  professeur: boolean;
  actif: boolean;
  codeEtablissement: string;
}) {
  const [reinit, reinitialiser] = useActionState<EtatAdmin, FormData>(
    reinitialiserUnAcces,
    ETAT_ADMIN_INITIAL,
  );
  const [etatCompte, changerEtat] = useActionState<EtatAdmin, FormData>(
    changerLEtatDUnCompte,
    ETAT_ADMIN_INITIAL,
  );

  const [demande, setDemande] = useState<"aucune" | "reinitialiser" | "etat">("aucune");

  const acces = reinit.acces;

  if (acces !== undefined) {
    return (
      <div className="min-w-[14rem]">
        <FicheImprimable
          prenom={acces.prenom}
          nom={acces.nom}
          role={professeur ? "Professeur" : "Élève"}
          classe={acces.classe}
          login={acces.login}
          motDePasse={acces.motDePasseTemporaire}
        />

        <div className="rounded-[var(--radius-champ)] border border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-3 print:hidden">
          <p className="m-0 text-[length:var(--text-aide)] font-semibold text-[color:var(--color-succes)]">
            Nouvel accès
          </p>
          <dl className="m-0 mt-2 space-y-0.5 font-mono text-[length:var(--text-aide)]">
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Code</dt>
              <dd className="m-0 font-semibold">{codeEtablissement}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Identifiant</dt>
              <dd className="m-0 font-semibold">{acces.login}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-[color:var(--color-encre-faible)]">Mot de passe</dt>
              <dd className="m-0 font-semibold">{acces.motDePasseTemporaire}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => window.print()}
            className="bouton bouton-secondaire mt-3 w-full"
          >
            Imprimer la fiche
          </button>
          <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Ce mot de passe ne sera plus affiché. Il n&apos;est conservé nulle
            part.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[12rem] space-y-2">
      {demande === "aucune" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDemande("reinitialiser")}
            className="rounded-[6px] border border-[color:var(--color-bordure)] px-2.5 py-1.5 text-[length:var(--text-aide)] hover:border-[color:var(--color-bordure-forte)]"
          >
            Réinitialiser l&apos;accès
          </button>
          <button
            type="button"
            onClick={() => setDemande("etat")}
            className="rounded-[6px] border border-[color:var(--color-bordure)] px-2.5 py-1.5 text-[length:var(--text-aide)] hover:border-[color:var(--color-bordure-forte)]"
          >
            {actif ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      ) : null}

      {demande === "reinitialiser" ? (
        <form action={reinitialiser} className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure-forte)] p-3">
          <input type="hidden" name="profil" value={profil} />
          <p className="m-0 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
            Donner un nouveau mot de passe à {prenom} {nom.toUpperCase()} ? Les
            sessions ouvertes seront fermées et l&apos;ancien mot de passe
            cessera de fonctionner.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Confirmer libelle="Réinitialiser" />
            <button
              type="button"
              onClick={() => setDemande("aucune")}
              className="rounded-[6px] px-2.5 py-1.5 text-[length:var(--text-aide)] underline underline-offset-2"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {demande === "etat" ? (
        <form action={changerEtat} className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure-forte)] p-3">
          <input type="hidden" name="profil" value={profil} />
          <input type="hidden" name="actif" value={actif ? "non" : "oui"} />
          <p className="m-0 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
            {actif
              ? `Désactiver le compte de ${prenom} ${nom.toUpperCase()} ? Il ne pourra plus se connecter. Rien n'est effacé.`
              : `Réactiver le compte de ${prenom} ${nom.toUpperCase()} ?`}
            {classe === null ? "" : ` Classe : ${classe}.`}
          </p>
          <label className="etiquette mt-3" htmlFor={`motif-${profil}`}>
            Motif (facultatif, gardé au journal)
          </label>
          <input
            id={`motif-${profil}`}
            name="motif"
            type="text"
            maxLength={200}
            className="champ"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Confirmer libelle={actif ? "Désactiver" : "Réactiver"} />
            <button
              type="button"
              onClick={() => setDemande("aucune")}
              className="rounded-[6px] px-2.5 py-1.5 text-[length:var(--text-aide)] underline underline-offset-2"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {reinit.etat === "erreur" || etatCompte.etat !== "vierge" ? (
        <p
          role="status"
          className={`m-0 text-[length:var(--text-aide)] ${
            reinit.etat === "erreur" || etatCompte.etat === "erreur"
              ? "text-[color:var(--color-erreur)]"
              : "text-[color:var(--color-succes)]"
          }`}
        >
          {reinit.etat === "erreur" ? reinit.message : etatCompte.message}
        </p>
      ) : null}
    </div>
  );
}

function Confirmer({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire">
      {pending ? "…" : libelle}
    </button>
  );
}

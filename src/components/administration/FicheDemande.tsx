"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { majDemande } from "@/app/administration/actions";
import { ETAT_ACTION_INITIAL, type EtatAction } from "@/app/administration/etats";
import type { DemandeCommerciale } from "@/lib/administration";
import { ETATS, libelleEtat } from "@/lib/demande-commerciale";

/**
 * Une demande commerciale, avec son suivi.
 *
 * Le contact est cliquable — c'est le geste le plus fréquent — et la note
 * interne reste à côté de l'état : changer l'un sans l'autre fait perdre le fil
 * au bout de trois semaines.
 */
export function FicheDemande({ demande }: { demande: DemandeCommerciale }) {
  const [etat, action] = useActionState<EtatAction, FormData>(majDemande, ETAT_ACTION_INITIAL);

  return (
    <article className="carte p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              {demande.establishment_name}
            </h2>
            <Pastille etat={demande.state} />
          </div>

          <p className="m-0 mt-1.5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            {typeEtablissement(demande.legal_kind)}
            {demande.commune === null ? "" : ` · ${demande.commune}`}
            {demande.approximate_size === null ? "" : ` · environ ${demande.approximate_size} élèves`}
          </p>
        </div>

        <div className="text-right">
          <p className="m-0 font-mono text-[length:var(--text-tableau)] font-semibold">
            {demande.reference}
          </p>
          <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            {dateLisible(demande.created_at)}
          </p>
        </div>
      </div>

      <dl className="m-0 mt-5 grid gap-x-8 gap-y-3 text-[length:var(--text-tableau)] sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Contact</dt>
          <dd className="m-0 text-[color:var(--color-encre-faible)]">
            {demande.contact_name}
            {demande.contact_role === null ? "" : ` — ${demande.contact_role}`}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Coordonnées</dt>
          <dd className="m-0">
            <a
              href={`mailto:${demande.contact_email}`}
              className="text-[color:var(--color-accent)]"
            >
              {demande.contact_email}
            </a>
            {demande.contact_phone === null ? null : (
              <>
                {" · "}
                <a href={`tel:${demande.contact_phone}`} className="text-[color:var(--color-accent)]">
                  {demande.contact_phone}
                </a>
              </>
            )}
          </dd>
        </div>
      </dl>

      {demande.message === null ? null : (
        <p className="m-0 mt-5 whitespace-pre-line rounded-[var(--radius-champ)] bg-[color:var(--color-surface-douce)] p-4 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
          {demande.message}
        </p>
      )}

      <form action={action} className="mt-6 border-t border-[color:var(--color-bordure)] pt-5">
        <input type="hidden" name="id" value={demande.id} />

        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="etiquette" htmlFor={`etat-${demande.id}`}>
              État
            </label>
            <select
              id={`etat-${demande.id}`}
              name="etat"
              defaultValue={demande.state}
              className="champ"
            >
              {ETATS.map((element) => (
                <option key={element.valeur} value={element.valeur}>
                  {element.libelle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiquette" htmlFor={`note-${demande.id}`}>
              Note de suivi
            </label>
            <input
              id={`note-${demande.id}`}
              name="note"
              type="text"
              defaultValue={demande.internal_note ?? ""}
              placeholder="Rappelé le 12, devis à envoyer"
              className="champ"
            />
          </div>

          <BoutonEnregistrer />
        </div>

        {etat.etat !== "vierge" && etat.message ? (
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
        ) : null}
      </form>
    </article>
  );
}

function BoutonEnregistrer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-secondaire">
      {pending ? "…" : "Enregistrer"}
    </button>
  );
}

function Pastille({ etat }: { etat: string }) {
  const tons: Record<string, string> = {
    nouvelle: "bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]",
    contactee: "bg-[color:var(--color-surface-douce)] text-[color:var(--color-encre-faible)]",
    devis_envoye: "bg-[color:var(--color-surface-douce)] text-[color:var(--color-encre)]",
    gagnee: "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]",
    perdue: "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[length:var(--text-aide)] font-semibold ${
        tons[etat] ?? tons.contactee
      }`}
    >
      {libelleEtat(etat)}
    </span>
  );
}

function typeEtablissement(valeur: string): string {
  if (valeur === "public") return "Établissement public";
  if (valeur === "prive") return "Établissement privé";
  return "Autre structure";
}

function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

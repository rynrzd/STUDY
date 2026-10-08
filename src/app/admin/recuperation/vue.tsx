import Link from "next/link";
import { CircleCheck, KeyRound, Mail } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, OngletsLiens, dateHeure } from "@/components/study/ui";
import { marquerTraitee } from "./actions";
import { TraiterDemande } from "./TraiterDemande";

export interface DemandeRecuperation {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly identifiant: string;
  readonly classe: string | null;
  readonly demandee_le: string;
  readonly reference: string | null;
  readonly compte: string | null;
}

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueRecuperation({ error, demandes, choisie }: { error: unknown | null; demandes: readonly DemandeRecuperation[]; choisie: DemandeRecuperation | null }) {
  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage sourcil="Administration" titre="Demandes de récupération de compte" sousTitre="Vérifiez l'identité avant de rétablir l'accès." />
      <OngletsLiens etiquette="File" onglets={[{ href: "/admin/recuperation", libelle: "En attente", compte: error === null ? demandes.length : null, actif: true }]} />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Ces demandes n&apos;ont pas pu être chargées. Le second facteur de votre session est-il validé ?
        </p>
      ) : demandes.length === 0 ? (
        <EtatVide icone={KeyRound} titre="Aucune demande en attente" texte="Les demandes faites depuis « Mot de passe oublié » apparaissent ici, et seulement pour les comptes de votre établissement." />
      ) : (
        <div className="liste-detail">
          <ul className="liste-r2" aria-label={`${demandes.length} demande${demandes.length > 1 ? "s" : ""} en attente`}>
            {demandes.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/recuperation?demande=${d.id}`}
                  aria-current={choisie?.id === d.id ? "true" : undefined}
                  className="ligne-r2"
                >
                  <span className="tuile" aria-hidden="true">
                    <Mail size={20} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[color:var(--color-encre)]">
                      {d.prenom} {d.nom}
                    </span>
                    <span className="meta block">Reçue le {dateHeure(d.demandee_le)}</span>
                  </span>
                  <Etiquette ton="attention">En attente</Etiquette>
                </Link>
              </li>
            ))}
          </ul>

          {choisie ? (
            <section className="panneau" aria-labelledby="detail-demande">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 id="detail-demande" className="titre-section">
                  Demande de récupération
                </h2>
                <Etiquette ton="attention">En attente</Etiquette>
              </div>
              <p className="meta m-0 mb-3">Reçue le {dateHeure(choisie.demandee_le)}</p>
              <h3 className="titre-bloc m-0 mb-2 font-bold">Informations fournies</h3>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.9375rem]">
                <dt className="meta">Personne</dt>
                <dd className="m-0 font-semibold">
                  {choisie.prenom} {choisie.nom}
                </dd>
                <dt className="meta">Identifiant</dt>
                <dd className="m-0 font-mono">{choisie.identifiant}</dd>
                <dt className="meta">Classe</dt>
                <dd className="m-0">{choisie.classe ?? "—"}</dd>
                <dt className="meta">Compte</dt>
                <dd className="m-0">{choisie.compte === "a_activer" ? "Jamais activé" : choisie.compte === "actif" ? "Actif" : (choisie.compte ?? "—")}</dd>
                <dt className="meta">Reçue le</dt>
                <dd className="m-0">{dateHeure(choisie.demandee_le)}</dd>
                <dt className="meta">Référence</dt>
                <dd className="m-0">{choisie.reference ? "Portée par la demande — à faire annoncer, sans la dire" : "Aucune (demande antérieure)"}</dd>
              </dl>
              <div className="mt-5 rounded-[12px] bg-[color:var(--color-rose-clair)] p-4 text-[0.875rem]">
                <h3 className="titre-bloc m-0 font-bold">Vérification, hors application</h3>
                <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                  {[
                    "La personne est présente, ou connue de l'équipe.",
                    "Carte de lycéen ou pièce d'identité montrée — rien n'est photographié ni déposé dans Study.",
                    "Elle annonce la référence affichée sur son écran.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <TraiterDemande demande={choisie.id} reference={choisie.reference} nom={`${choisie.prenom} ${choisie.nom}`} />
              <form action={marquerTraitee} className="mt-3">
                <input type="hidden" name="demande" value={choisie.id} />
                <button type="submit" className="bouton bouton-discret">
                  Classer sans suite
                </button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

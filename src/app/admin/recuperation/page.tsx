import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, Panneau, dateHeure } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { marquerTraitee } from "./actions";
import { TraiterDemande } from "./TraiterDemande";

export const metadata = { title: "Demandes d'accès" };
export const dynamic = "force-dynamic";

/**
 * D03 — Récupérations : la file à gauche, le détail à droite. Contrôle
 * d'identité hors application (aucune pièce stockée), référence annoncée par
 * la personne, puis lien temporaire (3 jours, usage unique) ; ou classement
 * sans suite. Aucun ancien mot de passe n'existe ni n'est affiché.
 */
export default async function PageRecuperation({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const { demande } = await searchParams;
  const { data, error } = await clientUtilisateur(ctx.jeton).rpc("recuperation_a_traiter");
  const demandes = (data ?? []) as { id: string; prenom: string; nom: string; identifiant: string; classe: string | null; demandee_le: string; reference: string | null; compte: string | null }[];
  const choisie = demandes.find((d) => d.id === demande) ?? demandes[0] ?? null;

  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage titre="Demandes de récupération de compte" sousTitre="Vérifiez l'identité avant de rétablir l'accès." />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Ces demandes n&apos;ont pas pu être chargées. Le second facteur de votre session est-il validé ?
        </p>
      ) : demandes.length === 0 ? (
        <EtatVide titre="Aucune demande en attente" texte="Les demandes faites depuis « Mot de passe oublié » apparaissent ici, et seulement pour les comptes de votre établissement." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <ul className="m-0 grid list-none content-start gap-2 p-0" aria-label={`${demandes.length} demande${demandes.length > 1 ? "s" : ""} en attente`}>
            {demandes.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/recuperation?demande=${d.id}`}
                  aria-current={choisie?.id === d.id ? "true" : undefined}
                  className={`flex items-start gap-3 rounded-[12px] border p-4 no-underline ${choisie?.id === d.id ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]"}`}
                >
                  <Mail size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
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
            <Panneau titre="Demande de récupération">
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
              <div className="mt-4 rounded-[12px] bg-[color:var(--color-surface-douce)] p-4 text-[0.875rem]">
                <p className="m-0 font-semibold">Vérification, hors application</p>
                <ul className="m-0 mt-1 grid gap-1 pl-5">
                  <li>La personne est présente, ou connue de l&apos;équipe.</li>
                  <li>Carte de lycéen ou pièce d&apos;identité montrée — rien n&apos;est photographié ni déposé dans Study.</li>
                  <li>Elle annonce la référence affichée sur son écran.</li>
                </ul>
              </div>
              <TraiterDemande demande={choisie.id} reference={choisie.reference} nom={`${choisie.prenom} ${choisie.nom}`} />
              <form action={marquerTraitee} className="mt-3">
                <input type="hidden" name="demande" value={choisie.id} />
                <button type="submit" className="bouton bouton-discret">
                  Classer sans suite
                </button>
              </form>
            </Panneau>
          ) : null}
        </div>
      )}
    </div>
  );
}

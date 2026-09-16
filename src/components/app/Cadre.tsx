import Link from "next/link";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { MARQUE } from "@/lib/identite-legale";
import { LienNav } from "./LienNav";

/**
 * Cadre commun des espaces connectés — cahier V2, §7, §8 et §14.
 *
 * Une seule barre, la même partout, dont seuls les liens changent selon le
 * rôle. Un élève et un professeur qui se parlent doivent reconnaître le même
 * produit ; et surtout, il n'y a qu'un endroit à corriger quand la navigation
 * évolue.
 *
 * La navigation est en haut sur toutes les tailles d'écran : la colonne
 * latérale d'un ENT coûte trop de largeur sur un portable de lycée, et devient
 * un tiroir sur téléphone — donc deux navigations à maintenir au lieu d'une.
 */

export interface LienEspace {
  readonly href: string;
  readonly libelle: string;
}

export function Cadre({
  liens,
  personne,
  contexte,
  children,
}: {
  liens: readonly LienEspace[];
  personne: { prenom: string; nom: string };
  /** Établissement, classe, ou ce qui situe la personne. */
  contexte?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="sans-debordement flex min-h-screen flex-col bg-[color:var(--color-fond)]">
      <header className="border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] print:hidden">
        <div className="contenu-app flex h-[60px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <Link
              href="/app"
              className="text-[1.125rem] font-extrabold tracking-[-0.035em] no-underline"
            >
              {MARQUE}
            </Link>
            {contexte ? (
              <span className="hidden truncate text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] sm:inline">
                {contexte}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] md:inline">
              {personne.prenom} {personne.nom}
            </span>
            <form action={seDeconnecter}>
              <button type="submit" className="bouton bouton-secondaire bouton-compact">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Navigation de l'espace" className="border-t border-[color:var(--color-bordure)]">
          <ul className="contenu-app m-0 flex list-none gap-1 overflow-x-auto p-0 py-1.5">
            {liens.map((lien) => (
              <li key={lien.href}>
                <LienNav href={lien.href}>{lien.libelle}</LienNav>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenu" className="contenu-app flex-1 py-8">
        {children}
      </main>
    </div>
  );
}

/**
 * Titre de page, identique dans tous les espaces.
 *
 * L'action principale est à droite du titre sur grand écran, et passe sous lui
 * sur téléphone — jamais dans un menu caché : c'est souvent le seul geste que
 * la personne est venue faire.
 */
export function TitreEspace({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          {titre}
        </h1>
        {sousTitre ? (
          <p className="m-0 mt-1.5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            {sousTitre}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * État vide : une explication et une action — jamais une zone blanche.
 *
 * Le cahier V2 l'impose pour chaque écran (§19). Un écran vide sans phrase
 * laisse croire à une panne ; avec une phrase, il enseigne le produit.
 */
export function Vide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bloc border border-dashed border-[color:var(--color-bordure-forte)] px-6 py-12 text-center">
      <p className="m-0 font-semibold">{titre}</p>
      <p className="mx-auto m-0 mt-2 max-w-[54ch] text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
        {texte}
      </p>
      {action ? <div className="mt-6 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Bandeau d'erreur : ce qui s'est passé, et de quoi réessayer. */
export function Erreur({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-5"
    >
      <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

import Link from "next/link";
import { Check, ChevronRight, CircleAlert, FileText, Lock, type LucideIcon } from "lucide-react";

/**
 * Composants d'affichage partagés — dossier Study V6, §3.4.
 *
 * Rendus côté serveur, sans état. Une couleur n'y porte jamais seule une
 * information : chaque état a un libellé. Icônes Lucide, 20 px, trait 1,75.
 */

export const ICONE = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

export function EnTetePage({
  sourcil,
  titre,
  sousTitre,
  actions,
  filAriane,
}: {
  sourcil?: string | null;
  titre: string;
  sousTitre?: React.ReactNode;
  actions?: React.ReactNode;
  filAriane?: readonly { href: string; libelle: string }[];
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {filAriane && filAriane.length > 0 ? <FilAriane etapes={filAriane} /> : null}
        {sourcil ? <span className="sourcil">{sourcil}</span> : null}
        <h1 className="titre-page">{titre}</h1>
        {sousTitre ? <p className="m-0 mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">{sousTitre}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function FilAriane({ etapes }: { etapes: readonly { href: string; libelle: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-3">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 meta">
        {etapes.map((etape, i) => (
          <li key={etape.href} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            <Link href={etape.href} className="text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-accent)]">
              {etape.libelle}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type Ton = "neutre" | "rose" | "succes" | "attention" | "erreur";

export function Etiquette({ ton = "neutre", children }: { ton?: Ton; children: React.ReactNode }) {
  return (
    <span className="etiquette-etat" data-ton={ton === "neutre" ? undefined : ton}>
      {children}
    </span>
  );
}

/** Vide initial : une explication et l'action qui correspond au rôle. */
export function EtatVide({
  icone: Icone = FileText,
  titre,
  texte,
  action,
}: {
  icone?: LucideIcon;
  titre: string;
  texte: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="panneau flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-full bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]">
        <Icone {...ICONE} />
      </span>
      <p className="titre-bloc m-0 font-semibold">{titre}</p>
      <p className="m-0 mt-2 max-w-[52ch] text-[color:var(--color-encre-faible)]">{texte}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Erreur serveur ou fournisseur : explication honnête et identifiant opaque. */
export function EtatErreur({
  titre = "Ce contenu n'a pas pu être chargé.",
  texte = "Rien n'a été perdu. Réessayez dans un instant.",
  requestId,
  action,
}: {
  titre?: string;
  texte?: React.ReactNode;
  requestId?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="panneau border-[color:var(--color-erreur-fond)] bg-[color:var(--color-erreur-fond)]">
      <p className="m-0 flex items-center gap-2 font-semibold text-[color:var(--color-erreur)]">
        <CircleAlert {...ICONE} />
        {titre}
      </p>
      <p className="m-0 mt-2 text-[color:var(--color-encre)]">{texte}</p>
      {requestId ? <p className="meta m-0 mt-2">Référence pour l&apos;assistance : {requestId.slice(0, 8)}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** E35 — accès indisponible : aucun titre, aucune trace du contenu demandé. */
export function AccesIndisponible({ retour = "/app" }: { retour?: string }) {
  return (
    <div className="mx-auto max-w-[520px] py-10">
      <div className="panneau flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-full bg-[color:var(--color-survol)] text-[color:var(--color-encre-faible)]">
          <Lock {...ICONE} />
        </span>
        <h1 className="titre-section">Ce contenu n&apos;est pas accessible</h1>
        <p className="m-0 mt-2 max-w-[44ch] text-[color:var(--color-encre-faible)]">
          Il n&apos;existe plus, ou il ne fait pas partie de vos classes. Si vous pensez qu&apos;il s&apos;agit d&apos;une
          erreur, adressez-vous à votre professeur ou à la vie scolaire.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={retour} className="bouton bouton-primaire">
            Mon espace
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Squelette de même géométrie que des lignes de contenu. */
export function SqueletteLignes({ lignes = 4, titre = true }: { lignes?: number; titre?: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite" className="panneau">
      <span className="sr-only">Chargement…</span>
      {titre ? <span className="squelette-ligne mb-6 h-5 w-48" /> : null}
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="ligne">
          <span className="squelette-ligne h-10 w-12" />
          <div className="flex-1 space-y-2">
            <span className="squelette-ligne w-2/3" />
            <span className="squelette-ligne w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

const MOIS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

export function DateBloc({ date }: { date: string | Date }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", timeZone: "Europe/Paris" }).format(d);
  const mois = Number(new Intl.DateTimeFormat("fr-FR", { month: "numeric", timeZone: "Europe/Paris" }).format(d)) - 1;
  return (
    <span className="date-bloc" aria-hidden="true">
      {jour}
      <small>{MOIS[mois]}</small>
    </span>
  );
}

export function dateLisible(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...options }).format(new Date(iso));
}

export function dateHeure(iso: string | null | undefined) {
  return dateLisible(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Référence de source : d'où vient un passage, et quelle version. */
export function SourceCitee({ titre, detail, href }: { titre: string; detail?: string | null; href?: string | null }) {
  const contenu = (
    <>
      <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{titre}</span>
      {detail ? <span className="text-[color:var(--color-encre-faible)]">· {detail}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="inline-flex max-w-full items-center gap-1.5 meta no-underline hover:text-[color:var(--color-accent)]">
      {contenu}
    </Link>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1.5 meta">{contenu}</span>
  );
}

/** Avis de visibilité : qui verra ce qui est saisi, avant la saisie. */
export function AvisVisibilite({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4">
      <Lock size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
      <div className="text-[0.8125rem] leading-[1.5]">{children}</div>
    </div>
  );
}

export function Panneau({
  titre,
  compte,
  action,
  children,
  className = "",
  as: Balise = "section",
  id,
}: {
  titre?: string;
  /** Compteur affiché à côté du titre (maquettes R2 : « Équipe (4) »). */
  compte?: number | null;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  id?: string;
}) {
  const idTitre = titre && id ? `${id}-titre` : undefined;
  return (
    <Balise className={`panneau ${className}`} id={id} aria-labelledby={idTitre}>
      {titre || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titre ? (
            <h2 id={idTitre} className="titre-section flex items-center gap-2">
              {titre}
              {compte != null ? <span className="nombre">{compte}</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </Balise>
  );
}

/* --- R2 : primitives des cinq maquettes (listes, onglets, étapes) -------- */

/** Tuile d'icône plate, 40 px : carré blush, pictogramme baie. */
export function TuileIcone({ icone: Icone, ton, grande = false }: { icone: LucideIcon; ton?: "neutre"; grande?: boolean }) {
  return (
    <span className={`tuile${grande ? " tuile-grande" : ""}`} data-ton={ton} aria-hidden="true">
      <Icone size={grande ? 22 : 20} strokeWidth={1.75} />
    </span>
  );
}

/** Liste de lignes dans une carte blanche. Les enfants sont des <li>. */
export function ListeLignes({ children, etiquette }: { children: React.ReactNode; etiquette?: string }) {
  return (
    <ul className="liste-r2" aria-label={etiquette}>
      {children}
    </ul>
  );
}

/**
 * Ligne de liste : tuile, titre, détail, et à droite une étiquette ou un
 * chevron. Avec href, toute la ligne est le lien (cible de 64 px).
 */
export function Ligne({
  href,
  icone,
  titre,
  detail,
  fin,
  courante = false,
}: {
  href?: string;
  icone?: LucideIcon;
  titre: React.ReactNode;
  detail?: React.ReactNode;
  fin?: React.ReactNode;
  courante?: boolean;
}) {
  const corps = (
    <>
      {icone ? <TuileIcone icone={icone} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{titre}</span>
        {detail ? <span className="meta block">{detail}</span> : null}
      </span>
      {fin ? <span className="flex shrink-0 items-center gap-2">{fin}</span> : null}
      {href ? <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="chevron" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="ligne-r2" aria-current={courante ? "true" : undefined}>
          {corps}
        </Link>
      ) : (
        <div className="ligne-r2">{corps}</div>
      )}
    </li>
  );
}

/** Onglets en liens, soulignés en baie, avec compteur facultatif. */
export function OngletsLiens({
  onglets,
  etiquette,
}: {
  onglets: readonly { href: string; libelle: string; compte?: number | null; actif: boolean }[];
  etiquette: string;
}) {
  return (
    <nav aria-label={etiquette} className="onglets-liens mb-5">
      {onglets.map((o) => (
        <Link key={o.href} href={o.href} aria-current={o.actif ? "page" : undefined}>
          {o.libelle}
          {o.compte != null ? <span className="nombre">{o.compte}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Indicateur d'étapes : l'état est écrit, pas seulement porté par la couleur. */
export function Etapes({
  etapes,
  courante,
  etiquette,
}: {
  etapes: readonly { titre: string; detail?: string }[];
  courante: number;
  etiquette: string;
}) {
  return (
    <ol className="m-0 grid list-none gap-3 p-0 sm:auto-cols-fr sm:grid-flow-col" aria-label={etiquette}>
      {etapes.map((e, i) => {
        const n = i + 1;
        const etat = n < courante ? "faite" : n === courante ? "en cours" : "à venir";
        return (
          <li key={e.titre} aria-current={n === courante ? "step" : undefined} className="flex items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.9375rem] font-extrabold ${n <= courante ? "bg-[color:var(--color-accent)] text-white" : "border border-[color:var(--color-bordure-forte)] bg-[color:var(--color-surface)] text-[color:var(--color-encre-faible)]"}`}
              aria-hidden="true"
            >
              {n < courante ? <Check size={18} strokeWidth={2.25} /> : n}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{e.titre}</span>
              <span className="meta block">
                {e.detail ? `${e.detail} · ` : null}
                <span className="font-semibold">{etat}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Encadré blush : ce qu'il faut savoir avant d'agir. */
export function Encadre({
  icone: Icone = CircleAlert,
  titre,
  children,
  ton,
}: {
  icone?: LucideIcon;
  titre?: string;
  children: React.ReactNode;
  ton?: "neutre";
}) {
  return (
    <div className="encadre" data-ton={ton}>
      <Icone size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
      <div className="min-w-0 text-[0.9375rem] leading-[1.55]">
        {titre ? <p className="m-0 font-bold">{titre}</p> : null}
        <div className={titre ? "mt-1 text-[color:var(--color-encre-faible)]" : ""}>{children}</div>
      </div>
    </div>
  );
}

/** Carte de chiffre : tuile, libellé, valeur réelle (ou tiret si inconnue). */
export function CarteChiffre({
  icone,
  libelle,
  valeur,
  detail,
  href,
}: {
  icone: LucideIcon;
  libelle: string;
  valeur: React.ReactNode;
  detail?: string;
  href?: string;
}) {
  const corps = (
    <>
      <TuileIcone icone={icone} />
      <span className="font-bold">{libelle}</span>
      <span className="text-[1.75rem] font-extrabold leading-none tracking-[-0.02em]">{valeur}</span>
      {detail ? <span className="meta">{detail}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="carte-chiffre">
      {corps}
    </Link>
  ) : (
    <div className="carte-chiffre">{corps}</div>
  );
}

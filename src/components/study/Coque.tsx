import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Compass,
  FolderKanban,
  GraduationCap,
  House,
  KeyRound,
  LayoutDashboard,
  Library,
  LifeBuoy,
  LogOut,
  MessageCircle,
  NotebookPen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { changerClasse } from "@/app/app/contexte-actions";
import { MotSymbole } from "@/components/site/MotSymbole";
import { initiales, type ContexteApp } from "@/lib/v6/contexte";
import { createHash } from "node:crypto";
import { BandeauReseau } from "./BandeauReseau";
import { GardienBrouillons } from "./connexion/NettoyageLocal";
import { ServiceHorsLigne } from "./HorsLigne";
import { LienNavigation } from "./LienNavigation";
import { MenuPlus } from "./MenuPlus";

/**
 * AppShell R2 — cahier « refonte complète, sans 3D », §03.
 *
 * Trois espaces, trois navigations, une seule coque :
 * - élève : Accueil, Cours, Réviser, Classe, Agenda (mobile : … Classe, Plus) ;
 * - professeur : Accueil, Classes, Cours, Studio, Agenda ;
 * - administration : Vue d'ensemble, Personnes, Classes, Demandes,
 *   Modération, Années scolaires.
 *
 * L'espace affiché se déduit du chemin, et n'est proposé que si le rôle est
 * vérifié en base (`ctx.roles`). Un compte à plusieurs capacités change
 * d'espace par des liens explicites : cela ne modifie jamais son rôle, et
 * chaque gabarit de route refait son contrôle serveur. Aucune entrée d'un
 * autre rôle n'est affichée grisée.
 */

export interface Destination {
  readonly href: string;
  readonly libelle: string;
  readonly court?: string;
  readonly icone: LucideIcon;
  readonly exact?: boolean;
  readonly aussi?: readonly string[];
  readonly compteur?: number;
}

type Espace = "eleve" | "professeur" | "admin";

function espaceDe(ctx: ContexteApp): Espace {
  const c = ctx.chemin ?? "";
  if (ctx.roles.admin && c.startsWith("/admin")) return "admin";
  if (ctx.roles.professeur && (c.startsWith("/professeur") || c.startsWith("/studio") || c.startsWith("/app/prof"))) return "professeur";
  if (ctx.roles.eleve) return "eleve";
  if (ctx.roles.professeur) return "professeur";
  return "admin";
}

function navigation(ctx: ContexteApp, espace: Espace): { principales: Destination[]; secondaires: Destination[] } {
  const messagerie: Destination = { href: "/app/messagerie", libelle: "Messagerie", icone: MessageCircle, compteur: ctx.nonLus.messages, aussi: ["/app/demandes"] };
  const reglages: Destination = { href: "/app/reglages", libelle: "Réglages", icone: Settings, aussi: ["/parametres"] };
  const aide: Destination = { href: "/aide", libelle: "Aide", icone: LifeBuoy };

  if (espace === "eleve") {
    return {
      principales: [
        { href: "/app", libelle: "Accueil", icone: House, exact: true, aussi: ["/app/bienvenue", "/app/notifications"] },
        { href: "/app/cours", libelle: "Cours", icone: BookOpen, aussi: ["/app/seances", "/app/devoirs", "/app/rattrapage", "/app/recherche"] },
        { href: "/app/reviser", libelle: "Réviser", icone: Sparkles, aussi: ["/app/fiches", "/app/cartes", "/app/entrainements", "/app/erreurs", "/app/aide"] },
        { href: "/app/classe", libelle: "Classe", icone: Users, aussi: ["/app/classes", "/app/messagerie", "/app/demandes", "/app/entraide"] },
        { href: "/app/agenda", libelle: "Agenda", icone: CalendarDays },
      ],
      secondaires: [
        { href: "/app/projets", libelle: "Projets", icone: FolderKanban },
        { href: "/app/orientation", libelle: "Orientation", icone: Compass },
        { href: "/app/ateliers", libelle: "Ateliers", icone: NotebookPen },
        messagerie,
        aide,
        reglages,
      ],
    };
  }
  if (espace === "professeur") {
    return {
      principales: [
        { href: "/professeur", libelle: "Accueil", icone: House, exact: true },
        { href: "/professeur/classes", libelle: "Classes", icone: Users, aussi: ["/app/classe", "/app/classes"] },
        { href: "/studio", libelle: "Cours", icone: BookOpen, aussi: ["/professeur/devoirs"] },
        { href: "/professeur/studio", libelle: "Studio", icone: GraduationCap, aussi: ["/studio/exercices", "/app/prof"] },
        { href: "/app/agenda", libelle: "Agenda", icone: CalendarDays },
      ],
      secondaires: [
        { href: "/studio/exercices", libelle: "Banque d’exercices", court: "Exercices", icone: ClipboardList },
        { href: "/app/prof/ateliers", libelle: "Ateliers", icone: Library },
        { href: "/professeur/devoirs", libelle: "Devoirs et copies", court: "Copies", icone: ClipboardList },
        messagerie,
        aide,
        reglages,
      ],
    };
  }
  return {
    principales: [
      { href: "/admin", libelle: "Vue d’ensemble", court: "Vue", icone: LayoutDashboard, exact: true },
      { href: "/admin/utilisateurs", libelle: "Personnes", icone: Users, aussi: ["/admin/professeurs", "/admin/import"] },
      { href: "/admin/classes", libelle: "Classes", icone: BookOpen },
      { href: "/admin/recuperation", libelle: "Demandes", icone: KeyRound },
      { href: "/admin/moderation", libelle: "Modération", icone: ShieldCheck },
      { href: "/admin/annees", libelle: "Années scolaires", court: "Années", icone: CalendarDays },
    ],
    secondaires: [{ href: "/admin/import", libelle: "Importer des élèves", court: "Import", icone: Upload }, aide, reglages],
  };
}

/** Espaces auxquels le compte a accès, d'après les rôles relus en base. */
function espacesDisponibles(ctx: ContexteApp): { espace: Espace; href: string; libelle: string }[] {
  const liste: { espace: Espace; href: string; libelle: string }[] = [];
  if (ctx.roles.eleve) liste.push({ espace: "eleve", href: "/app", libelle: "Espace élève" });
  if (ctx.roles.professeur) liste.push({ espace: "professeur", href: "/professeur", libelle: "Espace professeur" });
  if (ctx.roles.admin) liste.push({ espace: "admin", href: "/admin", libelle: "Administration" });
  return liste;
}

function SelecteurClasse({ ctx }: { ctx: ContexteApp }) {
  if (ctx.contextes.length < 2) return null;
  return (
    <form action={changerClasse} className="mt-3 grid gap-1.5">
      <input type="hidden" name="retour" value={ctx.chemin} />
      <label className="sr-only" htmlFor="selecteur-classe">
        Classe affichée
      </label>
      <select id="selecteur-classe" name="classe" defaultValue={ctx.classeActive?.classe} className="champ min-h-[40px] w-full py-1 text-[0.875rem]">
        {ctx.contextes.map((c) => (
          <option key={c.classe} value={c.classe}>
            {c.libelle} · {c.role === "professeur" ? "enseignant" : c.role === "delegue" ? "délégué" : "élève"}
          </option>
        ))}
      </select>
      <button type="submit" className="bouton bouton-secondaire bouton-compact w-full">
        Afficher cette classe
      </button>
    </form>
  );
}

function Liens({ liens }: { liens: readonly Destination[] }) {
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0">
      {liens.map((d) => (
        <li key={d.href}>
          <LienNavigation href={d.href} exact={d.exact} aussi={d.aussi} className="lien-barre">
            <d.icone size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="barre-detail truncate">{d.libelle}</span>
            <span className="barre-rail" aria-hidden="true">{d.court ?? d.libelle}</span>
            {d.compteur ? (
              <span className="compteur barre-detail" aria-label={`${d.compteur} non lus`}>
                {d.compteur > 99 ? "99+" : d.compteur}
              </span>
            ) : null}
          </LienNavigation>
        </li>
      ))}
    </ul>
  );
}

export function Coque({ ctx, children }: { ctx: ContexteApp; children: React.ReactNode }) {
  const espace = espaceDe(ctx);
  const { principales, secondaires } = navigation(ctx, espace);
  const espaces = espacesDisponibles(ctx);
  const { personne } = ctx;
  const sigle = initiales(personne.prenom, personne.nom);
  const contexte = espace === "admin" ? "Administration" : ctx.classeActive ? `${ctx.classeActive.libelle} · ${ctx.classeActive.annee}` : null;
  // Téléphone : quatre destinations et « Plus » (cinq au plus, jamais sept).
  const mobile = principales.slice(0, 4);
  const plus = [...principales.slice(4), ...secondaires];

  return (
    <div className="app-coque">
      <aside className="app-barre" aria-label="Navigation principale">
        <Link href={espaces[0]?.href ?? "/app"} className="mb-1 inline-flex min-h-[44px] items-center px-3 text-[color:var(--color-encre)]">
          <MotSymbole titre="Study, accueil" className="block h-auto w-[72px] min-[1100px]:w-[88px]" />
        </Link>
        <div className="barre-detail mt-4 px-3">
          <p className="m-0 truncate text-[0.8125rem] font-bold text-[color:var(--color-encre)]">{personne.organisation ?? "Study"}</p>
          {contexte ? <p className="meta m-0 mt-0.5 truncate">{contexte}</p> : null}
          {espace !== "admin" ? <SelecteurClasse ctx={ctx} /> : null}
        </div>

        {espaces.length > 1 ? (
          <nav aria-label="Changer d'espace" className="barre-detail mt-4 px-1">
            <ul className="m-0 grid list-none gap-1 rounded-[12px] bg-[color:var(--color-fond)] p-1">
              {espaces.map((e) => (
                <li key={e.espace}>
                  <Link
                    href={e.href}
                    aria-current={e.espace === espace ? "true" : undefined}
                    className={`flex min-h-[36px] items-center rounded-[9px] px-3 text-[0.8125rem] font-semibold no-underline ${e.espace === espace ? "bg-[color:var(--color-surface)] text-[color:var(--color-encre)] shadow-[0_1px_2px_rgba(41,40,46,0.08)]" : "text-[color:var(--color-encre-faible)]"}`}
                  >
                    {e.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <nav className="mt-5" aria-label={espace === "admin" ? "Administration" : espace === "professeur" ? "Espace professeur" : "Espace élève"}>
          <Liens liens={principales} />
          <p className="barre-detail m-0 mb-2 mt-6 px-3 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-encre-faible)]">Aussi</p>
          <hr className="barre-rail my-3 border-0 border-t border-[color:var(--color-bordure)]" />
          <Liens liens={secondaires} />
        </nav>

        <div className="mt-auto pt-6">
          <details className="menu-deroulant">
            <summary className="flex min-h-[48px] items-center gap-2.5 rounded-[10px] px-2 hover:bg-[color:var(--color-survol)]">
              <span className="avatar" aria-hidden="true">
                {sigle}
              </span>
              <span className="barre-detail min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-bold">
                  {personne.prenom} {personne.nom}
                </span>
                <span className="meta block truncate">{espaces.find((e) => e.espace === espace)?.libelle ?? "Mon compte"}</span>
              </span>
              <span className="sr-only">Menu du compte</span>
            </summary>
            <div className="menu-deroulant-panneau bottom-[56px] left-0">
              <Link href="/app/reglages" className="lien-barre">
                <Settings size={18} strokeWidth={1.75} aria-hidden="true" /> Réglages
              </Link>
              <form method="post" action="/deconnexion">
                <button type="submit" className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left">
                  <LogOut size={18} strokeWidth={1.75} aria-hidden="true" /> Se déconnecter
                </button>
              </form>
            </div>
          </details>
        </div>
      </aside>

      <div className="app-espace">
        <header className="app-entete">
          <Link href={espaces[0]?.href ?? "/app"} className="app-seulement-mobile mr-auto inline-flex min-h-[44px] items-center text-[color:var(--color-encre)]">
            <MotSymbole titre="Study, accueil" className="block h-auto w-[76px]" />
          </Link>
          {espace !== "admin" ? (
            <form action="/app/recherche" method="get" role="search" className="app-seulement-bureau mr-auto flex h-11 max-w-[520px] flex-1 items-center gap-3 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-fond)] px-3 focus-within:border-[color:var(--color-accent)]">
              <label htmlFor="recherche-globale" className="sr-only">
                Rechercher dans tes cours, fiches et échanges
              </label>
              <Search size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-encre-faible)]" />
              <input
                id="recherche-globale"
                name="q"
                type="search"
                placeholder="Rechercher un cours, un chapitre…"
                className="w-full border-0 bg-transparent py-2 text-[0.9375rem] outline-none placeholder:text-[color:var(--color-encre-faible)] focus-visible:outline-none"
                maxLength={500}
                autoComplete="off"
              />
            </form>
          ) : (
            <p className="app-seulement-bureau m-0 mr-auto font-bold">{personne.organisation ?? "Administration"}</p>
          )}
          {espace !== "admin" ? (
            <Link href="/app/recherche" className="bouton-icone app-seulement-mobile" aria-label="Rechercher">
              <Search size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : null}
          <Link href="/app/messagerie" className="bouton-icone" aria-label={`Messagerie${ctx.nonLus.messages ? `, ${ctx.nonLus.messages} non lus` : ""}`}>
            <MessageCircle size={22} strokeWidth={1.75} aria-hidden="true" />
            {ctx.nonLus.messages ? <span className="pastille-point" /> : null}
          </Link>
          <Link
            href="/app/notifications"
            className="bouton-icone"
            aria-label={`Notifications${ctx.nonLus.notifications ? `, ${ctx.nonLus.notifications} non lues` : ""}`}
          >
            <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
            {ctx.nonLus.notifications ? <span className="pastille-point" /> : null}
          </Link>
          <Link href="/app/reglages" className="app-seulement-mobile" aria-label="Mon compte et réglages">
            <span className="avatar" aria-hidden="true">
              {sigle}
            </span>
          </Link>
        </header>
        <BandeauReseau copies={ctx.copiesLocales} />
        <ServiceHorsLigne autorise={ctx.copiesLocales} />
        <main id="contenu" className="app-principal" tabIndex={-1}>
          <GardienBrouillons proprietaire={createHash("sha256").update(`study-brouillons:${personne.profileId}`).digest("base64url").slice(0, 22)}>{children}</GardienBrouillons>
        </main>
      </div>

      <nav className="app-nav-mobile" aria-label="Destinations">
        {mobile.map((d) => (
          <LienNavigation key={d.href} href={d.href} exact={d.exact} aussi={d.aussi}>
            <d.icone size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>{d.court ?? d.libelle}</span>
          </LienNavigation>
        ))}
        <MenuPlus
          liens={plus.map((d) => ({ href: d.href, libelle: d.libelle, aussi: d.aussi ?? [], exact: d.exact ?? false }))}
          espaces={espaces.length > 1 ? espaces.map((e) => ({ href: e.href, libelle: e.libelle, actif: e.espace === espace })) : []}
        />
      </nav>
    </div>
  );
}

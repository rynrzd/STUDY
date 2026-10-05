import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  GraduationCap,
  House,
  Inbox,
  LayoutDashboard,
  Library,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { changerClasse } from "@/app/app/contexte-actions";
import { initiales, type ContexteApp } from "@/lib/v6/contexte";
import { BandeauReseau } from "./BandeauReseau";
import { LienNavigation } from "./LienNavigation";

/**
 * AppShell — dossier Study V6, §2.1 et §3.3.
 *
 * Ordinateur : barre latérale avec les sept raccourcis (Aujourd'hui, Cours,
 * Réviser, Messagerie, Ma classe, Mes projets, Agenda), puis les espaces
 * « Enseigner » et « Administration » **seulement** pour les rôles vérifiés
 * en base. Téléphone : cinq destinations en bas ; recherche, messages et
 * notifications dans l'en-tête. La messagerie s'ouvre de partout.
 *
 * Il n'existe aucun sélecteur de rôle : on ne change que de classe, parmi
 * les affectations vérifiées.
 */

interface Destination {
  readonly href: string;
  readonly libelle: string;
  readonly icone: LucideIcon;
  readonly exact?: boolean;
  readonly aussi?: readonly string[];
  readonly compteur?: number;
}

function destinations(ctx: ContexteApp): { principales: Destination[]; mobile: Destination[]; enseigner: Destination[]; administrer: Destination[] } {
  const { roles } = ctx;
  const eleve = roles.eleve;
  const prof = roles.professeur;

  const principales: Destination[] = [];
  if (eleve || prof) {
    // Un enseignant sans rôle élève arrive sur son tableau de bord, et ses
    // cours sont ses séances : la même destination, l'objet de son rôle.
    principales.push(
      eleve
        ? { href: "/app", libelle: "Aujourd'hui", icone: House, exact: true }
        : { href: "/professeur", libelle: "Aujourd'hui", icone: House, exact: true },
    );
    principales.push(
      eleve
        ? { href: "/app/cours", libelle: "Cours", icone: BookOpen, aussi: ["/app/seances", "/app/devoirs", "/app/rattrapage"] }
        : { href: "/studio", libelle: "Cours", icone: BookOpen },
    );
    if (eleve) {
      principales.push({
        href: "/app/reviser",
        libelle: "Réviser",
        icone: Sparkles,
        aussi: ["/app/fiches", "/app/cartes", "/app/entrainements", "/app/erreurs", "/app/aide"],
      });
    }
    principales.push({ href: "/app/messagerie", libelle: "Messagerie", icone: MessageCircle, compteur: ctx.nonLus.messages, aussi: ["/app/demandes"] });
    principales.push({ href: "/app/classe", libelle: "Ma classe", icone: Users, aussi: ["/app/classes"] });
    principales.push({ href: "/app/projets", libelle: "Mes projets", icone: FolderKanban, aussi: ["/app/orientation"] });
    principales.push({ href: "/app/agenda", libelle: "Agenda", icone: CalendarDays });
  }

  const enseigner: Destination[] = prof
    ? [
        ...(eleve
          ? [
              { href: "/professeur", libelle: "Tableau de bord", icone: LayoutDashboard, exact: true },
              { href: "/studio", libelle: "Mes séances", icone: GraduationCap },
            ]
          : []),
        { href: "/professeur/studio", libelle: "Importer un cours", icone: Upload },
        { href: "/professeur/devoirs", libelle: "Devoirs et copies", icone: ClipboardList },
        { href: "/professeur/classes", libelle: "Mes élèves", icone: Users },
        { href: "/app/prof/ateliers", libelle: "Ateliers", icone: Library },
      ]
    : [];

  const administrer: Destination[] = roles.admin
    ? [
        { href: "/admin", libelle: "Établissement", icone: ShieldCheck, exact: true },
        { href: "/admin/classes", libelle: "Classes", icone: Users },
        { href: "/admin/utilisateurs", libelle: "Comptes", icone: Inbox },
        { href: "/admin/import", libelle: "Import", icone: Upload },
        { href: "/admin/moderation", libelle: "Modération", icone: ShieldCheck },
      ]
    : [];

  // Cinq destinations au plus sur téléphone, jamais sept boutons empilés.
  const mobile: Destination[] =
    principales.length > 0
      ? eleve
        ? [principales[0]!, principales[1]!, principales[2]!, principales.find((d) => d.href === "/app/classe")!, principales.find((d) => d.href === "/app/projets")!]
        : [
            principales[0]!,
            principales[1]!,
            { href: "/professeur/devoirs", libelle: "Copies", icone: ClipboardList },
            principales.find((d) => d.href === "/app/classe")!,
            principales.find((d) => d.href === "/app/agenda")!,
          ]
      : administrer.slice(0, 5);

  return { principales, mobile, enseigner, administrer };
}

function Section({ titre, liens }: { titre: string; liens: readonly Destination[] }) {
  if (liens.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="m-0 mb-2 px-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">{titre}</p>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {liens.map((d) => (
          <li key={d.href}>
            <LienNavigation href={d.href} exact={d.exact} aussi={d.aussi} className="lien-barre">
              <d.icone size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{d.libelle}</span>
            </LienNavigation>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelecteurClasse({ ctx }: { ctx: ContexteApp }) {
  if (ctx.contextes.length < 2) return null;
  return (
    <form action={changerClasse} className="mt-2 flex items-center gap-1.5">
      <input type="hidden" name="retour" value={ctx.chemin} />
      <label className="sr-only" htmlFor="selecteur-classe">
        Classe affichée
      </label>
      <select id="selecteur-classe" name="classe" defaultValue={ctx.classeActive?.classe} className="champ min-h-[36px] py-1 text-[0.8125rem]">
        {ctx.contextes.map((c) => (
          <option key={c.classe} value={c.classe}>
            {c.libelle} · {c.role === "professeur" ? "enseignant" : c.role === "delegue" ? "délégué" : "élève"}
          </option>
        ))}
      </select>
      <button type="submit" className="bouton bouton-secondaire bouton-compact">
        Changer
      </button>
    </form>
  );
}

export function Coque({ ctx, children }: { ctx: ContexteApp; children: React.ReactNode }) {
  const { principales, mobile, enseigner, administrer } = destinations(ctx);
  const { personne } = ctx;
  const sigle = initiales(personne.prenom, personne.nom);
  const contexte = ctx.classeActive
    ? `${ctx.classeActive.libelle} · ${ctx.classeActive.annee}`
    : ctx.roles.admin
      ? "Administration"
      : null;

  return (
    <div className="app-coque">
      <aside className="app-barre" aria-label="Navigation principale">
        <Link href="/app" className="marque-study px-3 text-[2rem] leading-none">
          study<span>.</span>
        </Link>
        <div className="mt-6 px-3">
          <p className="m-0 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">
            {personne.organisation ?? "Study"}
          </p>
          {contexte ? <p className="meta m-0 mt-1">{contexte}</p> : null}
          <SelecteurClasse ctx={ctx} />
        </div>

        <nav className="mt-5" aria-label="Destinations">
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {principales.map((d) => (
              <li key={d.href}>
                <LienNavigation href={d.href} exact={d.exact} aussi={d.aussi} className="lien-barre">
                  <d.icone size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">{d.libelle}</span>
                  {d.compteur ? (
                    <span className="compteur" aria-label={`${d.compteur} non lus`}>
                      {d.compteur > 99 ? "99+" : d.compteur}
                    </span>
                  ) : null}
                </LienNavigation>
              </li>
            ))}
          </ul>
          <Section titre="Enseigner" liens={enseigner} />
          <Section titre="Administration" liens={administrer} />
        </nav>

        <div className="mt-auto pt-6">
          <details className="menu-deroulant">
            <summary className="flex min-h-[48px] items-center gap-2.5 rounded-[10px] px-2 hover:bg-[color:var(--color-survol)]">
              <span className="avatar" aria-hidden="true">
                {sigle}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold">
                  {personne.prenom} {personne.nom}
                </span>
                <span className="meta block truncate">{ctx.classeActive?.libelle ?? (ctx.roles.professeur ? "Professeur" : "Mon compte")}</span>
              </span>
            </summary>
            <div className="menu-deroulant-panneau bottom-[56px] left-0">
              <Link href="/app/reglages" className="lien-barre">
                <Settings size={18} strokeWidth={1.75} aria-hidden="true" /> Réglages
              </Link>
              <form action={seDeconnecter}>
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
          <Link href="/app" className="marque-study app-seulement-mobile mr-auto text-[1.625rem] leading-none">
            study<span>.</span>
          </Link>
          <form action="/app/recherche" method="get" role="search" className="app-seulement-bureau mr-auto flex max-w-[560px] flex-1 items-center gap-3">
            <label htmlFor="recherche-globale" className="sr-only">
              Rechercher dans vos cours, fiches et échanges
            </label>
            <Search size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-encre-faible)]" />
            <input
              id="recherche-globale"
              name="q"
              type="search"
              placeholder="Un cours, une question, une idée…"
              className="w-full border-0 bg-transparent py-2 text-[0.875rem] outline-none placeholder:text-[color:var(--color-encre-faible)] focus-visible:outline-none"
              maxLength={500}
              autoComplete="off"
            />
          </form>
          <Link href="/app/recherche" className="bouton-icone app-seulement-mobile" aria-label="Rechercher">
            <Search size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
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
        <BandeauReseau />
        <main id="contenu" className="app-principal" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="app-nav-mobile" aria-label="Destinations">
        {mobile.map((d) => (
          <LienNavigation key={d.href} href={d.href} exact={d.exact} aussi={d.aussi}>
            <d.icone size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>{d.libelle.replace("Mes projets", "Projets")}</span>
          </LienNavigation>
        ))}
      </nav>
    </div>
  );
}

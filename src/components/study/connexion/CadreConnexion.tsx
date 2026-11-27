import Link from "next/link";
import { BookOpen, CalendarCheck, MessagesSquare, School, ArrowLeft, Check, UserRound, Users, ChevronRight, NotebookPen } from "lucide-react";
import m from "./connexion-mobile.module.css";
import scolaire from "./connexion-scolaire.module.css";
import rose from "./auth-maquette-mobile.module.css";
import { MotSymbole } from "@/components/site/MotSymbole";
import { ConteneurEffets } from "@/components/study/ConteneurEffets";

/**
 * AuthShell R2 — cahier §06 et lecture des maquettes (connexion).
 *
 * Page gris clair, petit logo en haut. Ordinateur (≥ 1024 px) : deux colonnes
 * 40/60 — à gauche un panneau blush, titre et trois lignes Cours / Travail /
 * Échanges en composition typographique plate ; à droite le formulaire blanc,
 * 440 px au plus, bordure discrète, 32 px de marge intérieure.
 * Téléphone : logo, titre, formulaire et aides ; aucun panneau illustratif,
 * contenu depuis le haut pour que le clavier laisse le champ actif visible.
 */
export function CadreConnexion({
  titre,
  sousTitre,
  children,
  etapeMobile,
  publicCible = "eleve",
  ambianceScolaire = false,
  maquetteMobile,
}: {
  etapeMobile?: 1 | 2;
  publicCible?: "eleve" | "professeur";
  /** Uniquement pour /connexion : amélioration visuelle sans modifier les autres parcours. */
  ambianceScolaire?: boolean;
  /** Maquette rose et bordeaux validée sur téléphone. Ne touche pas au bureau. */
  maquetteMobile?: "connexion" | "inscription";
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  /** Accepté pour compatibilité ; le panneau R2 a un texte fixe. */
  visuel?: string;
}) {
  const professeur = publicCible === "professeur";
  const points = professeur ? [
    { icone: Users, titre: "Mes classes", texte: "Crée une classe en indiquant simplement son nom et ta matière." },
    { icone: BookOpen, titre: "Mes cours", texte: "Prépare une séance ou importe tes documents, à ton rythme." },
    { icone: MessagesSquare, titre: "Mes élèves", texte: "Invite-les quand tu es prêt et partage tes cours." },
  ] : [
    { icone: BookOpen, titre: "Cours", texte: "Les séances et documents de tes professeurs." },
    { icone: CalendarCheck, titre: "Travail", texte: "Ce qui est à faire, et pour quand." },
    { icone: MessagesSquare, titre: "Échanges", texte: "Le salon de ta classe, avec ton professeur." },
  ];
  return (
    <ConteneurEffets>
      <div className={`sans-debordement min-h-dvh bg-[color:var(--color-fond)] ${etapeMobile ? m.root : ""} ${ambianceScolaire ? scolaire.scolaire : ""} ${maquetteMobile ? rose.mobileScene : ""}`} data-etape={etapeMobile}>
        <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-5 sm:px-8 lg:h-[72px]">
          <Link href="/" aria-label="AvecStudy, retour au site" className="inline-flex min-h-[44px] items-center text-[color:var(--color-encre)]">
            <MotSymbole titre="Study" className={`${maquetteMobile ? rose.brandDesktop : ""} block h-auto w-[80px] lg:w-[92px]`} />
            {maquetteMobile ? <span aria-hidden="true" className={rose.brandMobile}>study<span>.</span></span> : null}
            {professeur && !maquetteMobile ? <span aria-hidden="true" className="ml-3 border-l border-[color:var(--color-bordure-forte)] pl-3 text-xs font-semibold tracking-wide text-[color:var(--color-encre-faible)]">
              AvecStudy
            </span> : null}
          </Link>
          {etapeMobile ? <Link href="/" className={m.back}><ArrowLeft size={16} aria-hidden="true" /> Retour au site</Link> : null}
        </header>
        {maquetteMobile ? <section className={rose.hero} aria-label={maquetteMobile === "connexion" ? "Bienvenue sur AvecStudy" : "Créer un compte AvecStudy"}>
          <div className={rose.heroText}>
            {maquetteMobile === "connexion" ? <>
              <span className={rose.eyebrow}>AvecStudy</span>
              <h1 className={rose.heroTitle}>On se retrouve ?</h1>
              <p className={rose.heroSubtitle}>Tout reprend ici.</p>
            </> : <>
              <h1 className={rose.heroTitle}>Bienvenue chez toi.</h1>
              <p className={rose.heroSubtitle}>Crée ton espace professeur.</p>
            </>}
          </div>
        </section> : null}
        <div className={`mx-auto grid w-full max-w-[1200px] gap-10 px-5 pb-[max(40px,env(safe-area-inset-bottom))] sm:px-8 lg:grid-cols-[2fr_3fr] lg:items-center lg:gap-16 lg:py-10 ${maquetteMobile ? rose.layout : ""}`}>
          <aside className={`relative hidden bg-[color:var(--color-rose-clair)] p-12 lg:block ${ambianceScolaire ? "overflow-hidden rounded-[26px] border border-white/80 shadow-[0_16px_45px_-26px_rgba(91,48,66,0.3)]" : "rounded-[var(--radius-grand)]"}`} aria-label="AvecStudy en bref">
            {ambianceScolaire ? <span aria-hidden="true" className="absolute right-6 top-5 grid size-14 -rotate-12 place-items-center rounded-[18px] bg-white/55 text-[color:var(--color-accent)] shadow-sm"><NotebookPen size={29} strokeWidth={1.6} /></span> : null}
            <p className={`relative m-0 text-[2.75rem] font-extrabold leading-[1.08] tracking-[-0.045em] ${ambianceScolaire ? "max-w-[290px]" : ""}`}>{professeur ? "Tes idées méritent une belle classe." : "Ta classe commence ici."}</p>
            <ul className="relative m-0 mt-10 grid list-none gap-6 p-0">
              {points.map((l) => (
                <li key={l.titre} className="flex items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center bg-[color:var(--color-surface)] text-[color:var(--color-accent)] ${ambianceScolaire ? "rounded-[14px] border border-white/90 shadow-[0_4px_12px_-7px_rgba(91,48,66,0.35)]" : "rounded-[var(--rayon-m)]"}`}>
                    <l.icone size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[1.125rem] font-extrabold">{l.titre}</span>
                    <span className="block text-[1rem] text-[color:var(--color-encre-faible)]">{l.texte}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <main id="contenu" className="w-full">
            <div className={`mx-auto w-full max-w-[440px] lg:border lg:border-[color:var(--color-bordure)] lg:bg-[color:var(--color-surface)] lg:p-8 ${ambianceScolaire ? "lg:rounded-[24px] lg:border-[#eee1e6] lg:shadow-[0_18px_50px_-28px_rgba(91,48,66,0.24)]" : "lg:rounded-[var(--radius-carte)]"} ${maquetteMobile ? rose.card : ""}`}>
              {etapeMobile ? <div className={m.mobile}>
                <ol className={m.progress} aria-label="Étapes de connexion">
                  <li aria-current={etapeMobile === 1 ? "step" : undefined}><span className={m.active}>{etapeMobile === 2 ? <Check size={16} aria-hidden="true" /> : "1"}</span>Établissement</li>
                  <li aria-current={etapeMobile === 2 ? "step" : undefined}><span className={etapeMobile === 2 ? m.active : ""}>2</span>Connexion</li>
                </ol>
                {etapeMobile === 1 ? <div className={m.school}><School size={32} strokeWidth={1.5} aria-hidden="true" /></div> : null}
              </div> : null}
              <h1 className={`m-0 mt-4 text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.035em] sm:text-[2rem] lg:mt-0 ${maquetteMobile ? rose.desktopTitle : ""}`}>
                <span className={etapeMobile ? m.desktop : undefined}>{titre}</span>
                {etapeMobile ? <span className={m.mobile}>{etapeMobile === 1 ? <>Retrouve <em>ta classe.</em></> : <>Heureux de <em>te revoir.</em></>}</span> : null}
              </h1>
              {etapeMobile ? <p className={m.intro}>{etapeMobile === 1 ? "Commence par le code remis par ton établissement." : "Connecte-toi avec les accès de ton établissement."}</p> : null}
              {sousTitre ? <p className={`m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)] ${etapeMobile ? m.desktop : ""} ${maquetteMobile ? rose.desktopTitle : ""}`}>{sousTitre}</p> : null}
              <div className={`mt-7 ${maquetteMobile ? rose.content : ""}`}>{children}</div>
              {etapeMobile ? <div className={m.mobileFooter}>{etapeMobile === 2 ? <><Link href="/acces-oublie">Accès oublié ?</Link><p>Besoin d’aide ? Contacte ton établissement.</p></> : <p>Les cours. La classe. Le lien.</p>}</div> : null}
            </div>
          </main>
        </div>
      </div>
    </ConteneurEffets>
  );
}

/** Le contexte établissement au-dessus du formulaire, avec « Changer ». */
export function BandeauEtablissement({ nom, changer }: { nom: string; changer: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-[var(--rayon-m)] border border-[color:var(--color-bordure)] bg-[color:var(--color-rose-clair)] px-4 py-3">
      <div className="min-w-0">
        <p className="m-0 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">Établissement</p>
        <p className="m-0 font-semibold [overflow-wrap:anywhere]" data-testid="etablissement-nom">
          {nom}
        </p>
      </div>
      {changer}
    </div>
  );
}

/** Liens secondaires sous les formulaires d'accès. */
export function LiensAcces() {
  return (
    <ul className={`${m.accessLinks} m-0 mt-8 grid list-none gap-3 border-t border-[color:var(--color-bordure)] p-0 pt-6 text-[0.9375rem]`}>
      <li>
        <UserRound className={m.accessIcon} size={22} aria-hidden="true" />
        Première connexion ?{" "}
        <Link href="/activer" className="font-semibold text-[color:var(--color-accent)]">
          Activer mon accès<ChevronRight className={m.accessArrow} size={18} aria-hidden="true" />
        </Link>
      </li>
      <li>
        <Users className={m.accessIcon} size={22} aria-hidden="true" />
        Un code de classe ?{" "}
        <Link href="/rejoindre" className="font-semibold text-[color:var(--color-accent)]">
          Rejoindre ma classe<ChevronRight className={m.accessArrow} size={18} aria-hidden="true" />
        </Link>
      </li>
    </ul>
  );
}

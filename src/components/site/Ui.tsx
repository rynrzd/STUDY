import Link from "next/link";
import { BookOpen, Building2, HelpCircle, Mail, FileText, ShieldCheck, Handshake, Accessibility, ChevronRight } from "lucide-react";
import s from "./public-pages.module.css";

/**
 * Primitives des pages publiques — R2 (cahier §03 et §05).
 *
 * Conteneur 1 200 px, marges 20/24/32 px, sections de 56 à 96 px. Titres
 * Manrope extra-gras, texte charbon et secondaire, accent baie. Aucune
 * apparition au défilement : tout est visible au premier rendu.
 */

export function Section({
  children,
  fond = "clair",
  id,
  className = "",
}: {
  children: React.ReactNode;
  fond?: "clair" | "blanc" | "doux" | "sombre";
  id?: string;
  className?: string;
}) {
  const fonds = {
    clair: "",
    blanc: "bg-[color:var(--color-surface)]",
    doux: "bg-[color:var(--color-surface-douce)]",
    // Le bandeau de conclusion est baie (R2) ; « sombre » est conservé comme nom.
    sombre: "bg-[color:var(--color-accent)] text-[color:var(--color-surface)]",
  } as const;
  return (
    <section id={id} className={`${s.section} ${fonds[fond]} ${className}`}>
      <div className="contenu">{children}</div>
    </section>
  );
}

export function EnteteSection({
  surtitre,
  titre,
  chapeau,
  centre = false,
}: {
  surtitre?: string;
  titre: string;
  chapeau?: string;
  centre?: boolean;
}) {
  return (
    <div className={`${s.sectionTitle} ${centre ? "mx-auto text-center" : ""}`}>
      {surtitre ? <p className={s.eyebrow}>{surtitre}</p> : null}
      <h2>{titre}</h2>
      {chapeau ? <p>{chapeau}</p> : null}
    </div>
  );
}

/** Hero court des pages publiques : un seul H1, pas de second hero. */
export function TitrePage({
  surtitre,
  titre,
  chapeau,
  actions,
}: {
  surtitre?: string;
  titre: string;
  chapeau?: string;
  actions?: React.ReactNode;
}) {
  const Icone = /établissement/i.test(surtitre ?? "") ? Building2 : /offre/i.test(surtitre ?? "") ? Handshake : /aide/i.test(surtitre ?? "") ? HelpCircle : /contact/i.test(surtitre ?? "") ? Mail : /sécurité/i.test(surtitre ?? titre) ? ShieldCheck : /accessibilité/i.test(titre) ? Accessibility : /légal|confidentialité|conditions|mentions/i.test((surtitre ?? "") + titre) ? FileText : BookOpen;
  return (
    <header className={s.hero}>
      <div className="contenu">
        <nav aria-label="Fil d’Ariane" className={s.breadcrumb}><Link href="/">Accueil</Link><ChevronRight size={12} aria-hidden="true" /><span>{surtitre ?? titre}</span></nav>
        <div className={s.heroGrid}>
          <div>
            {surtitre ? <p className={s.eyebrow}>{surtitre}</p> : null}
            <h1 className={s.title}>{titre}</h1>
            {chapeau ? <p className={s.lead}>{chapeau}</p> : null}
            {actions ? <div className={s.actions}>{actions}</div> : null}
          </div>
          <span className={s.heroBadge} aria-hidden="true"><Icone size={46} strokeWidth={1.4} /></span>
        </div>
      </div>
    </header>
  );
}

export function Carte({
  titre,
  children,
  className = "",
  survol = false,
  niveau = 3,
}: {
  titre?: string;
  children: React.ReactNode;
  className?: string;
  survol?: boolean;
  niveau?: 2 | 3;
}) {
  const Titre = niveau === 2 ? "h2" : "h3";
  return (
    <article className={`${s.card} ${survol ? "carte-souleve" : ""} ${className}`}>
      {titre ? <Titre className="m-0 font-extrabold text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">{titre}</Titre> : null}
      <div className={`${titre ? "mt-3" : ""} text-[color:var(--color-encre-faible)] [&>p]:m-0 [&>p+p]:mt-3`}>{children}</div>
    </article>
  );
}

/** Texte éditorial : 760 px au plus (pages légales et explicatives). */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.prose}>
      {children}
    </div>
  );
}

/** Conclusion des pages publiques : bandeau baie, deux actions réelles. */
export function AppelFinal({
  titre = "Étudions votre déploiement",
  chapeau = "Une démonstration de trente minutes sur votre organisation réelle : vos niveaux, vos matières, vos groupes. Nous établissons ensuite un devis.",
}: {
  titre?: string;
  chapeau?: string;
}) {
  return (
    <Section>
      <div className={s.cta}>
        <div><h2>{titre}</h2><p>{chapeau}</p></div>
        <div className={s.ctaActions}>
          <Link href="/contact" className="bouton bouton-clair bouton-grand">Demander une démonstration</Link>
          <Link href="/offre" className="bouton bouton-grand border-white/70 text-white hover:bg-white/10">Voir l’offre</Link>
        </div>
      </div>
    </Section>
  );
}

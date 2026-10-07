import Link from "next/link";

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
    <section id={id} className={`scroll-mt-20 py-14 md:py-24 ${fonds[fond]} ${className}`}>
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
    <div className={centre ? "mx-auto max-w-[62ch] text-center" : "max-w-[46ch]"}>
      {surtitre ? <p className="surtitre m-0">{surtitre}</p> : null}
      <h2
        className={`${surtitre ? "mt-3" : ""} m-0 font-extrabold tracking-[-0.035em] text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]`}
      >
        {titre}
      </h2>
      {chapeau ? (
        <p className={`m-0 mt-4 text-[1.0625rem] leading-[1.7] text-[color:var(--color-encre-faible)] md:text-[1.125rem] ${centre ? "" : "max-w-[58ch]"}`}>{chapeau}</p>
      ) : null}
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
  return (
    <header className="bg-[color:var(--color-surface)] py-12 md:py-20">
      <div className="contenu">
        {surtitre ? <p className="surtitre m-0">{surtitre}</p> : null}
        <h1
          className={`${surtitre ? "mt-3" : ""} m-0 max-w-[20ch] font-extrabold tracking-[-0.045em] text-[length:var(--text-h1-etroit)] leading-[var(--text-h1-etroit--line-height)] min-[390px]:text-[length:var(--text-h1-mobile)] min-[390px]:leading-[var(--text-h1-mobile--line-height)] md:text-[3.5rem] md:leading-[3.875rem]`}
        >
          {titre}
        </h1>
        {chapeau ? <p className="m-0 mt-5 max-w-[62ch] text-[1.125rem] leading-[1.7] text-[color:var(--color-encre-faible)] md:text-[1.25rem]">{chapeau}</p> : null}
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
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
    <article className={`carte ${survol ? "carte-souleve" : ""} p-6 md:p-7 ${className}`}>
      {titre ? <Titre className="m-0 font-extrabold text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">{titre}</Titre> : null}
      <div className={`${titre ? "mt-3" : ""} text-[color:var(--color-encre-faible)] [&>p]:m-0 [&>p+p]:mt-3`}>{children}</div>
    </article>
  );
}

/** Texte éditorial : 760 px au plus (pages légales et explicatives). */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[760px] space-y-5 text-[1.0625rem] leading-[1.75] [&_a]:font-semibold [&_a]:text-[color:var(--color-accent)] [&_h2]:pt-6 [&_h2]:font-extrabold [&_h2]:tracking-[-0.02em] [&_h2]:text-[length:var(--text-h2)] [&_h2]:leading-[var(--text-h2--line-height)] [&_h2]:scroll-mt-24 [&_h3]:font-extrabold [&_h3]:text-[length:var(--text-h3)] [&_h3]:leading-[var(--text-h3--line-height)] [&_li]:text-[color:var(--color-encre-faible)] [&_p]:text-[color:var(--color-encre-faible)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
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
    <Section fond="sombre">
      <div className="flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-[46ch]">
          <h2 className="m-0 font-extrabold tracking-[-0.035em] text-white text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            {titre}
          </h2>
          <p className="m-0 mt-4 text-[1.0625rem] leading-[1.7] text-white/90">{chapeau}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className="bouton bouton-clair bouton-grand">
            Demander une démonstration
          </Link>
          <Link href="/offre" className="bouton bouton-grand border-white/70 text-white hover:bg-white/10">
            Voir l&apos;offre
          </Link>
        </div>
      </div>
    </Section>
  );
}

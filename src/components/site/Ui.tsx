import Link from "next/link";
import { Reveler } from "@/components/site/Reveler";

/**
 * Briques communes aux pages publiques.
 *
 * Une seule définition par motif : les pages composent, elles ne redéfinissent
 * pas leurs marges ni leurs tailles. C'est ce qui garde la grille rigoureuse
 * d'une page à l'autre.
 */

/** Section de page : respiration verticale constante, fond optionnel. */
export function Section({
  children,
  fond = "clair",
  id,
  className = "",
}: {
  children: React.ReactNode;
  fond?: "clair" | "doux" | "sombre";
  id?: string;
  className?: string;
}) {
  const fonds = {
    clair: "",
    doux: "bg-[color:var(--color-surface-douce)]",
    sombre: "bg-[color:var(--color-encre)] text-[color:var(--color-surface)]",
  } as const;

  return (
    <section id={id} className={`py-20 md:py-28 ${fonds[fond]} ${className}`}>
      <div className="contenu">{children}</div>
    </section>
  );
}

/** En-tête de section : surtitre, titre, chapeau. */
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
    <Reveler className={centre ? "mx-auto max-w-[62ch] text-center" : "max-w-[46ch]"}>
      {surtitre ? <p className="surtitre m-0">{surtitre}</p> : null}
      <h2
        className={`${surtitre ? "mt-4" : ""} text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]`}
      >
        {titre}
      </h2>
      {chapeau ? (
        <p
          className={`mt-5 text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)] ${centre ? "" : "max-w-[58ch]"}`}
        >
          {chapeau}
        </p>
      ) : null}
    </Reveler>
  );
}

/** Titre des pages publiques secondaires. */
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
    <header className="border-b border-[color:var(--color-bordure)] py-16 md:py-24">
      <div className="contenu">
        {surtitre ? <p className="surtitre m-0">{surtitre}</p> : null}
        <h1
          className={`${surtitre ? "mt-4" : ""} max-w-[18ch] text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[3.25rem] md:leading-[3.5rem]`}
        >
          {titre}
        </h1>
        {chapeau ? (
          <p className="mt-6 max-w-[62ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
            {chapeau}
          </p>
        ) : null}
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Carte de contenu. */
export function Carte({
  titre,
  children,
  className = "",
  survol = false,
}: {
  titre?: string;
  children: React.ReactNode;
  className?: string;
  survol?: boolean;
}) {
  return (
    <article className={`carte ${survol ? "carte-survol" : ""} p-6 md:p-7 ${className}`}>
      {titre ? (
        <h3 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
          {titre}
        </h3>
      ) : null}
      <div
        className={`${titre ? "mt-3" : ""} text-[color:var(--color-encre-faible)] [&>p]:m-0 [&>p+p]:mt-3`}
      >
        {children}
      </div>
    </article>
  );
}

/** Texte long : largeur de lecture limitée, rythme régulier. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[var(--spacing-lecture)] space-y-6 [&_a]:text-[color:var(--color-accent)] [&_h2]:pt-6 [&_h2]:text-[length:var(--text-h2)] [&_h2]:leading-[var(--text-h2--line-height)] [&_h3]:text-[length:var(--text-h3)] [&_h3]:leading-[var(--text-h3--line-height)] [&_li]:text-[color:var(--color-encre-faible)] [&_p]:text-[color:var(--color-encre-faible)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
      {children}
    </div>
  );
}

/** Appel à l'action de fin de page, identique partout. */
export function AppelFinal({
  titre = "Étudions votre déploiement",
  chapeau = "Une démonstration de trente minutes sur votre organisation réelle : vos niveaux, vos matières, vos groupes. Nous établissons ensuite un devis.",
}: {
  titre?: string;
  chapeau?: string;
}) {
  return (
    <Section fond="sombre">
      <Reveler className="mx-auto max-w-[62ch] text-center">
        <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
          {titre}
        </h2>
        <p className="mt-5 text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-bordure)]">
          {chapeau}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/etablissements" className="bouton bouton-primaire">
            Demander une démonstration
            <span aria-hidden="true" className="fleche">→</span>
          </Link>
          <Link
            href="/offre"
            className="bouton border-[color:var(--color-encre-faible)] text-[color:var(--color-surface)] hover:bg-white/10"
          >
            Voir l&apos;offre
          </Link>
        </div>
      </Reveler>
    </Section>
  );
}

import Link from "next/link";

/**
 * En-tête, pied de page et blocs communs au site public (ch. 02 et ch. 04).
 *
 * Le pied de page donne accès aux informations contractuelles et à
 * l'assistance. Il ne contient ni faux avis, ni logo de lycée client, ni
 * mention de certification.
 */

export const LARGEUR = "mx-auto w-full max-w-[1200px] px-4 md:px-6";

export function EntetePublic() {
  return (
    <header className="border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className={`${LARGEUR} flex h-16 items-center justify-between gap-4`}>
        <Link
          href="/"
          className="mot-symbole text-2xl no-underline text-[color:var(--color-encre)]"
        >
          study.
        </Link>

        <nav aria-label="Navigation principale" className="hidden md:block">
          <ul className="flex list-none items-center gap-6 p-0 m-0">
            <li><Lien href="/fonctionnalites">Fonctionnalités</Lien></li>
            <li><Lien href="/etablissements">Pour les établissements</Lien></li>
            <li><Lien href="/offre">Offre</Lien></li>
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {/* Sur mobile, la connexion reste visible sans ouvrir de menu (ch. 04). */}
          <Link
            href="/connexion"
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-champ)] px-3 no-underline text-[color:var(--color-encre)] hover:bg-[color:var(--color-survol)]"
          >
            Se connecter
          </Link>
          <Link
            href="/demo"
            className="hidden sm:inline-flex min-h-[44px] items-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-4 text-[color:var(--color-surface)] no-underline"
          >
            Demander une démonstration
          </Link>
        </div>
      </div>

      {/* Repli mobile : les sections principales restent atteignables. */}
      <nav aria-label="Sections du site" className="md:hidden border-t border-[color:var(--color-bordure)]">
        <ul className={`${LARGEUR} flex list-none items-center gap-4 overflow-x-auto py-2 m-0`}>
          <li><Lien href="/fonctionnalites">Fonctionnalités</Lien></li>
          <li><Lien href="/etablissements">Établissements</Lien></li>
          <li><Lien href="/offre">Offre</Lien></li>
          <li><Lien href="/securite">Sécurité</Lien></li>
        </ul>
      </nav>
    </header>
  );
}

function Lien({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-encre)]"
    >
      {children}
    </Link>
  );
}

export function PiedDePage() {
  const colonnes = [
    {
      titre: "Le produit",
      liens: [
        ["/fonctionnalites", "Fonctionnalités"],
        ["/etablissements", "Pour les établissements"],
        ["/offre", "Offre"],
        ["/demo", "Démonstration"],
      ],
    },
    {
      titre: "Assistance",
      liens: [
        ["/aide", "Aide"],
        ["/contact", "Contact"],
        ["/securite", "Sécurité"],
        ["/accessibilite", "Accessibilité"],
      ],
    },
    {
      titre: "Informations contractuelles",
      liens: [
        ["/mentions-legales", "Mentions légales"],
        ["/confidentialite", "Confidentialité"],
        ["/conditions", "Conditions"],
      ],
    },
  ] as const;

  return (
    <footer className="mt-16 border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] py-12">
      <div className={LARGEUR}>
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <p className="mot-symbole text-xl m-0">study.</p>
            <p className="mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
              Le cours, les devoirs et l&apos;entraide. Dans la continuité de la classe.
            </p>
          </div>

          {colonnes.map((colonne) => (
            <nav key={colonne.titre} aria-label={colonne.titre}>
              <h2 className="font-[family-name:var(--font-texte)] text-[length:var(--text-tableau)] font-semibold uppercase tracking-wide text-[color:var(--color-encre-faible)]">
                {colonne.titre}
              </h2>
              <ul className="mt-3 list-none space-y-2 p-0 m-0">
                {colonne.liens.map(([href, libelle]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[length:var(--text-tableau)] text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]"
                    >
                      {libelle}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-[color:var(--color-bordure)] pt-6 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          study. est en cours de réalisation. Le nom, l&apos;identité de
          l&apos;éditeur, l&apos;hébergeur et le tarif ne sont pas arrêtés : ils
          doivent être validés avant toute commercialisation. Aucune page de ce
          site ne constitue une offre contractuelle.
        </p>
      </div>
    </footer>
  );
}

/**
 * Bandeau d'indisponibilité.
 *
 * Le ch. 19 est explicite : une fonctionnalité non livrée est absente ou
 * clairement indisponible, jamais simulée comme réussie. Plutôt que de masquer
 * un écran non terminé, on l'affiche avec ce bandeau qui dit exactement ce qui
 * manque et ce qui empêche de le livrer.
 */
export function BandeauIndisponible({
  quoi,
  bloquePar,
}: {
  quoi: string;
  bloquePar: string;
}) {
  return (
    <aside
      role="note"
      className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-rose-selection)] p-5"
    >
      <p className="m-0 font-semibold">Écran non opérationnel</p>
      <p className="mt-2 m-0">{quoi}</p>
      <p className="mt-2 m-0 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
        Ce qui manque : {bloquePar}
      </p>
    </aside>
  );
}

/** Titre de page, commun à toutes les pages publiques secondaires. */
export function TitrePage({
  surtitre,
  titre,
  chapeau,
}: {
  surtitre?: string;
  titre: string;
  chapeau?: string;
}) {
  return (
    <div className="py-12 md:py-16">
      {surtitre ? (
        <p className="mb-3 text-[color:var(--color-encre-faible)]">{surtitre}</p>
      ) : null}
      <h1 className="max-w-[20ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)] md:text-[length:var(--text-h1-public)] md:leading-[var(--text-h1-public--line-height)]">
        {titre}
      </h1>
      {chapeau ? (
        <p className="mt-6 max-w-[62ch] text-[color:var(--color-encre-faible)]">{chapeau}</p>
      ) : null}
    </div>
  );
}

/** Carte de contenu sobre : bordure 1 px, rayon 12 px, pas d'ombre portée. */
export function Carte({
  titre,
  children,
}: {
  titre?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
      {titre ? (
        <h3 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          {titre}
        </h3>
      ) : null}
      <div className={titre ? "mt-3" : undefined}>{children}</div>
    </article>
  );
}

/** Section de texte long, limitée à une largeur de lecture confortable. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[var(--spacing-lecture)] space-y-6 pb-8 [&_h2]:text-[length:var(--text-h2-app)] [&_h2]:leading-[var(--text-h2-app--line-height)] [&_h2]:pt-4 [&_p]:text-[color:var(--color-encre-faible)] [&_li]:text-[color:var(--color-encre-faible)] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
      {children}
    </div>
  );
}

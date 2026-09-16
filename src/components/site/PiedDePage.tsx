import Link from "next/link";
import { IDENTITE, MARQUE, mention } from "@/lib/identite-legale";

/**
 * Pied de page du site public.
 *
 * Le cahier de finition impose d'y faire figurer la raison sociale, la forme
 * juridique, le SIREN/SIRET, l'adresse, le directeur de publication, le
 * contact, l'hébergeur et les liens légaux. Toutes ces valeurs viennent de
 * `identite-legale.ts` : rien n'est recopié ici, et rien n'est inventé.
 *
 * Quand une mention officielle manque encore, elle s'affiche « En cours de
 * publication » plutôt qu'un tiret : le lecteur voit qu'il manque une
 * information au lieu de croire qu'elle est sans objet.
 *
 * Aucun logo d'établissement, aucun avis, aucune certification : rien qui
 * laisse croire à une référence que nous n'avons pas.
 */

const COLONNES = [
  {
    titre: "Produit",
    liens: [
      ["/produit", "Le produit"],
      ["/etablissements", "Pour les établissements"],
      ["/securite", "Sécurité et données"],
      ["/offre", "Offre et devis"],
    ],
  },
  {
    titre: "Assistance",
    liens: [
      ["/aide", "Aide"],
      ["/contact", "Contact"],
      ["/accessibilite", "Accessibilité"],
      ["/connexion", "Connexion"],
    ],
  },
  {
    titre: "Informations légales",
    liens: [
      ["/mentions-legales", "Mentions légales"],
      ["/confidentialite", "Confidentialité"],
      ["/conditions", "Conditions"],
    ],
  },
] as const;

export function PiedDePage() {
  const annee = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className="contenu py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="m-0 text-[1.3125rem] font-extrabold tracking-[-0.03em]">{MARQUE}</p>
            <p className="mt-3 max-w-[34ch] text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
              Le travail de la classe, au même endroit. Un espace scolaire
              contrôlé par l&apos;établissement.
            </p>
            <Link href="/etablissements" className="lien-fleche mt-5 inline-flex">
              Demander une démo
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
          </div>

          {COLONNES.map((colonne) => (
            <nav key={colonne.titre} aria-label={colonne.titre}>
              <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
                {colonne.titre}
              </h2>
              <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
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

        <div className="mt-12 border-t border-[color:var(--color-bordure)] pt-8">
          <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Éditeur
          </h2>

          <dl className="mt-4 grid gap-x-10 gap-y-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)] sm:grid-cols-2 lg:grid-cols-3">
            <Mention terme="Éditeur">
              {IDENTITE.editeur} — {IDENTITE.formeJuridique}
            </Mention>
            <Mention terme="SIREN">{mention(IDENTITE.siren)}</Mention>
            <Mention terme="SIRET">{mention(IDENTITE.siret)}</Mention>
            <Mention terme="Adresse">{mention(IDENTITE.adresse)}</Mention>
            <Mention terme="Directeur de la publication">
              {IDENTITE.directeurPublication}
            </Mention>
            <Mention terme="Contact">
              {IDENTITE.contactEmail === null ? (
                <>
                  En cours de publication —{" "}
                  <Link href="/contact" className="text-[color:var(--color-accent)]">
                    formulaire de contact
                  </Link>
                </>
              ) : (
                <a href={`mailto:${IDENTITE.contactEmail}`} className="text-[color:var(--color-accent)]">
                  {IDENTITE.contactEmail}
                </a>
              )}
            </Mention>
            <Mention terme="Hébergeur">
              {IDENTITE.hebergeur.nom}
              {IDENTITE.hebergeur.raisonSociale === null
                ? ""
                : ` — ${IDENTITE.hebergeur.raisonSociale}`}
              {IDENTITE.hebergeur.adresse === null
                ? ""
                : `, ${IDENTITE.hebergeur.adresse}`}
            </Mention>
          </dl>

          <p className="mt-8 m-0 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            © {annee} {IDENTITE.editeur}. {MARQUE} est vendu aux établissements
            sur devis. Les pages de ce site décrivent le service ; elles ne
            valent pas offre contractuelle.
          </p>
        </div>
      </div>
    </footer>
  );
}

function Mention({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-[color:var(--color-encre)]">{terme}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

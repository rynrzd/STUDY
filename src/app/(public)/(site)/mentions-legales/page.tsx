import type { Metadata } from "next";
import { TitrePage, Prose, BandeauIndisponible } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergeur et informations de publication.",
};

/**
 * Mentions légales — ch. 26.
 *
 * Volontairement non remplies. Le cahier des charges est explicite : ne pas
 * reprendre automatiquement l'identité, la TVA ou les mentions d'un autre
 * projet. Inventer un éditeur ou recopier ceux d'un projet voisin produirait un
 * document faux sur la seule page où l'exactitude est une obligation.
 */

const A_COMPLETER = [
  ["Éditeur", "Dénomination sociale réelle, forme juridique, capital le cas échéant, adresse du siège, numéro RCS ou d'immatriculation, numéro de TVA intracommunautaire si applicable."],
  ["Directeur de la publication", "Nom et qualité de la personne responsable de la publication."],
  ["Contact", "Adresse électronique et numéro de téléphone permettant de joindre l'éditeur."],
  ["Hébergeur", "Dénomination, adresse et téléphone de l'hébergeur effectif du site et des données — à renseigner une fois l'hébergeur choisi."],
  ["Propriété intellectuelle", "Titularité des contenus du site, et statut des contenus déposés par les établissements et leurs utilisateurs."],
] as const;

export default function MentionsLegales() {
  return (
    <>
      <TitrePage
        surtitre="Informations contractuelles"
        titre="Mentions légales."
      />

      <div className="pb-12">
        <BandeauIndisponible
          quoi="Cette page n'est pas renseignée."
          bloquePar="l'identité contractuelle de l'éditeur et le choix de l'hébergeur ne sont pas arrêtés. Ils seront inscrits ici tels quels, sans reprendre ceux d'un autre projet."
        />
      </div>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <Prose>
          <h2>Ce que cette page contiendra</h2>
          <p>
            Les éléments ci-dessous sont exigés d&apos;un service en ligne. Ils
            seront publiés avant toute mise à disposition à un établissement
            réel.
          </p>
        </Prose>

        <dl className="mt-8 max-w-[var(--spacing-lecture)] space-y-6">
          {A_COMPLETER.map(([titre, description]) => (
            <div key={titre} className="border-b border-[color:var(--color-bordure)] pb-6">
              <dt className="font-semibold">{titre}</dt>
              <dd className="mt-2 ml-0 text-[color:var(--color-encre-faible)]">{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

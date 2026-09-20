import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Prose, Section, TitrePage } from "@/components/site/Ui";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/accessibilite",
  titre: "Accessibilité",
  description:
    "Objectif d'accessibilité, état réel et moyens de nous signaler un obstacle.",
});

/**
 * Accessibilité — ch. 19.
 *
 * WCAG 2.2 niveau AA est l'objectif technique visé. Un audit doit précéder
 * toute affirmation de conformité : cette page dit donc « visé », jamais
 * « conforme », et elle ne porte aucun taux de conformité inventé.
 */

const APPLIQUE = [
  ["Navigation au clavier", "Chaque élément interactif est atteignable au clavier, dans un ordre logique. Les onglets de la page d'accueil se pilotent aux flèches, comme le prévoit le motif ARIA."],
  ["Focus visible", "L'élément qui a le focus est signalé par un contour net, jamais supprimé."],
  ["Lien d'évitement", "Un lien « Aller au contenu principal » est le premier élément focusable de chaque page."],
  ["Champs et erreurs associés", "Chaque champ porte une étiquette liée, et les textes d'aide sont rattachés au champ qu'ils expliquent."],
  ["Structure de titres", "Un seul titre de niveau 1 par page, puis une hiérarchie continue."],
  ["Tableaux balisés", "En-têtes de colonnes et de lignes déclarés, légende fournie, défilement horizontal contenu dans le tableau plutôt que dans la page."],
  ["Cibles tactiles", "Champs, boutons et liens d'action font au moins 44 px de haut."],
  ["Mouvement réduit", "Aucune animation permanente, aucun carrousel automatique. Les transitions sont coupées si le système signale une préférence de mouvement réduit."],
  ["La couleur n'est jamais seule", "Une couleur de fond n'est jamais le seul signal d'une erreur ou d'un état : un libellé l'accompagne toujours."],
] as const;

const NON_VERIFIE = [
  "Aucun audit d'accessibilité n'a été réalisé.",
  "Les contrastes sont choisis d'après les jetons de couleur, mais n'ont pas encore été mesurés page par page.",
  "Le parcours complet n'a pas été essayé avec un lecteur d'écran.",
  "Le rendu à 200 % de zoom et sur un écran de 320 px n'a pas été vérifié sur toutes les pages.",
  "L'alternative de saisie aux zones de dessin n'est pas implémentée, la fonction de dessin n'existant pas encore.",
] as const;

export default function Accessibilite() {
  return (
    <>
      <TitrePage
        surtitre="Informations contractuelles"
        titre="Accessibilité."
        chapeau={`L'objectif technique visé est le niveau AA des règles WCAG 2.2. Tant qu'un audit n'a pas eu lieu, ${MARQUE} ne se déclare pas conforme : annoncer une conformité non vérifiée n'aiderait aucun élève.`}
      />

      <Section>
        <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
          Ce qui est appliqué dès maintenant
        </h2>
        <dl className="m-0 mt-10 grid gap-5 p-0 md:grid-cols-2">
          {APPLIQUE.map(([titre, description]) => (
            <div key={titre} className="carte p-6 md:p-7">
              <dt className="font-semibold">{titre}</dt>
              <dd className="m-0 mt-2 text-[color:var(--color-encre-faible)]">{description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section fond="doux">
        <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
          Non-conformités connues
        </h2>
        <p className="mt-5 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Une déclaration d&apos;accessibilité doit nommer ce qui n&apos;a pas
          été vérifié. Voici la liste, tenue à jour.
        </p>
        <ul className="m-0 mt-8 max-w-[62ch] list-none space-y-3 p-0">
          {NON_VERIFIE.map((element) => (
            <li key={element} className="flex gap-3 text-[color:var(--color-encre-faible)]">
              <span aria-hidden="true" className="mt-[13px] h-px w-3 shrink-0 bg-[color:var(--color-bordure-forte)]" />
              {element}
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <Prose>
          <h2>Signaler un obstacle</h2>
          <p>
            Si une page vous empêche de faire ce que vous avez à faire,
            dites-le-nous : c&apos;est un défaut, pas une préférence. La page{" "}
            <Link href="/contact">contact</Link> indique comment nous écrire.
            Décrivez la page, votre équipement et ce que vous n&apos;arrivez pas
            à faire.
          </p>
          <p>
            Aucun parcours de classe n&apos;exige un téléphone, et aucun ne
            suppose un ordinateur par élève : un support imprimable et une remise
            sur papier restent prévus pour les élèves sans équipement à la
            maison.
          </p>
        </Prose>
      </Section>
    </>
  );
}

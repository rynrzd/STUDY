import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Prose } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Accessibilité",
  description: "Objectif d'accessibilité, état réel et moyens de nous signaler un obstacle.",
};

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
  ["La couleur n'est jamais seule", "Le rose clair est un fond, jamais le seul signal d'une erreur. Un état est toujours accompagné d'un libellé."],
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
        chapeau="L'objectif technique visé est le niveau AA des règles WCAG 2.2. Tant qu'un audit n'a pas eu lieu, study. ne se déclare pas conforme — annoncer une conformité non vérifiée n'aiderait aucun élève."
      />

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Ce qui est appliqué dès maintenant
        </h2>
        <dl className="mt-8 grid max-w-[var(--spacing-app)] gap-6 md:grid-cols-2">
          {APPLIQUE.map(([titre, description]) => (
            <div
              key={titre}
              className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6"
            >
              <dt className="font-semibold">{titre}</dt>
              <dd className="mt-2 ml-0 text-[color:var(--color-encre-faible)]">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Ce qui n&apos;est pas encore vérifié
        </h2>
        <ul className="mt-6 max-w-[62ch] list-none space-y-3 p-0">
          {NON_VERIFIE.map((element) => (
            <li key={element} className="flex gap-3 text-[color:var(--color-encre-faible)]">
              <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-[color:var(--color-erreur)]" />
              {element}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <Prose>
          <h2>Signaler un obstacle</h2>
          <p>
            Si une page vous empêche de faire ce que vous avez à faire,
            dites-le-nous : c&apos;est un défaut, pas une préférence. Le canal de
            signalement sera indiqué sur la page{" "}
            <Link href="/contact" className="text-[color:var(--color-accent)]">contact</Link>{" "}
            dès que l&apos;identité de l&apos;éditeur sera arrêtée.
          </p>
          <p>
            Aucun parcours de classe n&apos;exige un téléphone, et aucun ne
            suppose un ordinateur par élève : un support imprimable et une remise
            sur papier restent prévus pour les élèves sans équipement à la
            maison.
          </p>
        </Prose>
      </section>
    </>
  );
}

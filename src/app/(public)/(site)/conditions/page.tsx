import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Section, TitrePage } from "@/components/site/Ui";
import { DOMAINE, IDENTITE, MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = {
  title: "Conditions",
  description: "Conditions d'utilisation du service et cadre contractuel avec les établissements.",
  alternates: { canonical: "/conditions" },
};

/**
 * Conditions d'utilisation.
 *
 * Elles décrivent l'usage du service. Elles ne remplacent pas le contrat signé
 * avec l'établissement, qui prévaut : c'est écrit noir sur blanc plutôt que
 * laissé à l'interprétation, parce que c'est ce contrat qui fixe les durées,
 * l'assistance et la restitution des données.
 */

const CONTRAT = [
  ["Parties et objet", "Qui contracte avec qui : l'éditeur, l'entité acheteuse (qui n'est pas toujours l'établissement bénéficiaire) et l'établissement où le service est utilisé."],
  ["Durée et renouvellement", "Durée de la licence, dates de service, modalités de renouvellement. Le renouvellement est proposé, jamais tacite."],
  ["Effectif et dépassement", "L'effectif est fixé au devis. Un dépassement ouvre une discussion contractuelle, sans prélèvement automatique ni blocage de la rentrée."],
  ["Disponibilité", "Niveau de service visé et modalités de mesure, convenus au contrat."],
  ["Sauvegarde et restitution", "Fréquence des sauvegardes, objectifs de reprise, et conditions d'export des données en fin de contrat — y compris la période de lecture seule après expiration."],
  ["Sous-traitance et protection des données", "Instructions, confidentialité, sécurité, sous-traitants ultérieurs, assistance, incidents, restitution ou suppression, audits."],
  ["Usage acceptable", "Ce que l'établissement s'engage à ne pas faire, et ce qui se passe en cas de manquement. Aucune sanction ne vise un élève : le contrat lie l'établissement."],
  ["Résiliation", "Motifs, préavis, et sort des données. Une résiliation ne déclenche jamais une suppression immédiate des travaux."],
] as const;

export default function PageConditions() {
  return (
    <>
      <TitrePage
        surtitre="Informations légales"
        titre="Conditions d'utilisation."
        chapeau={`Elles régissent l'usage de ${DOMAINE.replace("https://", "")} et du service ${MARQUE}. Le contrat signé avec l'établissement prévaut sur cette page pour tout ce qu'il traite.`}
      />

      <Section>
        <Prose>
          <h2>1. Objet</h2>
          <p>
            {MARQUE} est un service en ligne édité par {IDENTITE.editeur},{" "}
            {IDENTITE.formeJuridique}. Il permet à un établissement scolaire
            d&apos;organiser les séances, les devoirs, les copies, les
            corrections et l&apos;entraide de ses classes. Il est fourni à
            l&apos;établissement dans le cadre d&apos;une licence annuelle
            établie sur devis.
          </p>

          <h2>2. Deux principes qui ne changent pas</h2>
          <ul>
            <li>
              <strong>L&apos;établissement contracte, pas les personnes.</strong>{" "}
              Aucun élève ni enseignant n&apos;accepte de conditions à titre
              individuel pour accéder à son cours, et aucun ne paie.
            </li>
            <li>
              <strong>Un impayé ne touche pas les élèves.</strong> Un retard de
              règlement donne lieu à une relance administrative auprès des
              contacts habilités — jamais à un message aux élèves, ni à une
              suppression automatique des cours.
            </li>
          </ul>

          <h2>3. Comptes et accès</h2>
          <p>
            Les comptes sont créés, affectés et révoqués par
            l&apos;établissement. Un compte est personnel : il ne se prête pas et
            ne se partage pas. Les identifiants remis à la rentrée comportent un
            mot de passe temporaire, à changer à la première connexion.
          </p>
          <p>
            Chaque compte n&apos;accède qu&apos;à son périmètre : un enseignant
            aux classes où il est affecté, un élève à ses propres classes, un
            administrateur aux comptes de son établissement. L&apos;éditeur
            n&apos;accède aux contenus d&apos;un établissement que sur
            autorisation écrite, tracée et limitée dans le temps.
          </p>

          <h2>4. Usage acceptable</h2>
          <p>
            Le service sert au travail scolaire. Sont notamment interdits : la
            publication de contenus illicites, le harcèlement, la tentative
            d&apos;accès à des données d&apos;un autre compte ou d&apos;un autre
            établissement, l&apos;extraction automatisée massive de contenus, et
            toute action visant à contourner les contrôles d&apos;accès.
          </p>
          <p>
            Un manquement est traité avec l&apos;établissement. Les mesures de
            modération internes relèvent de l&apos;établissement, qui désigne ses
            modérateurs.
          </p>

          <h2>5. Contenus</h2>
          <p>
            Les contenus pédagogiques déposés restent la propriété de leur auteur
            ou de l&apos;établissement, selon ce que prévoit le contrat.{" "}
            {MARQUE} n&apos;acquiert aucun droit d&apos;exploitation sur ces
            contenus, ne les réutilise pour aucun autre usage et ne les cède à
            aucun tiers. Voir les{" "}
            <Link href="/mentions-legales">mentions légales</Link>.
          </p>

          <h2>6. Disponibilité et maintenance</h2>
          <p>
            Le service peut être interrompu pour maintenance. Les interventions
            planifiées sont annoncées à l&apos;établissement. Les objectifs de
            disponibilité et de reprise, lorsqu&apos;ils sont convenus, figurent
            au contrat de l&apos;établissement.
          </p>

          <h2>7. Données personnelles</h2>
          <p>
            Le traitement des données, les durées de conservation, les
            sous-traitants et l&apos;exercice des droits sont décrits sur la page{" "}
            <Link href="/confidentialite">confidentialité</Link>. Pour les
            données scolaires, l&apos;établissement est responsable de
            traitement et {MARQUE} agit comme sous-traitant.
          </p>

          <h2>8. Évolution des conditions</h2>
          <p>
            Ces conditions peuvent évoluer. Toute modification substantielle est
            portée à la connaissance des établissements sous contrat avant son
            entrée en vigueur.
          </p>

          <h2>9. Droit applicable</h2>
          <p>
            Ces conditions sont soumises au droit français. En cas de différend,
            les parties recherchent d&apos;abord une solution amiable.
          </p>

          <h2>Ce que le contrat de l&apos;établissement précise en plus</h2>
          <p>
            Les points ci-dessous ne sont pas fixés sur cette page : ils sont
            négociés et écrits dans le contrat signé avec chaque établissement,
            parce qu&apos;ils dépendent de son organisation.
          </p>
        </Prose>

        <dl className="m-0 mt-10 max-w-[var(--spacing-lecture)] space-y-6 p-0">
          {CONTRAT.map(([titre, description]) => (
            <div key={titre} className="border-b border-[color:var(--color-bordure)] pb-6">
              <dt className="font-semibold">{titre}</dt>
              <dd className="m-0 mt-2 text-[color:var(--color-encre-faible)]">{description}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

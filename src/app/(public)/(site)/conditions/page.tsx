import type { Metadata } from "next";
import { TitrePage, Prose, BandeauIndisponible } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Conditions",
  description: "Conditions d'utilisation et cadre contractuel du service.",
};

const A_ECRIRE = [
  ["Parties et objet", "Qui contracte avec qui : l'éditeur, l'entité acheteuse (qui n'est pas toujours l'établissement bénéficiaire) et l'établissement où le service est utilisé."],
  ["Durée et renouvellement", "Durée de la licence, dates de service, modalités de renouvellement. Le renouvellement est proposé, jamais tacite."],
  ["Effectif et dépassement", "L'effectif est fixé au devis. Un dépassement ouvre une discussion contractuelle, sans prélèvement automatique ni blocage de la rentrée."],
  ["Disponibilité", "Niveau de service visé et modalités de mesure. Aucun engagement de disponibilité ne sera écrit avant d'avoir été mesuré sur un pilote réel."],
  ["Sauvegarde et restitution", "Fréquence des sauvegardes, objectifs de reprise, et conditions d'export des données en fin de contrat — y compris la période de lecture seule après expiration."],
  ["Sous-traitance et protection des données", "Instructions, confidentialité, sécurité, sous-traitants ultérieurs, assistance, incidents, restitution ou suppression, audits."],
  ["Usage acceptable", "Ce que l'établissement s'engage à ne pas faire, et ce qui se passe en cas de manquement. Aucune sanction ne vise un élève : le contrat lie l'établissement."],
  ["Résiliation", "Motifs, préavis, et sort des données. Une résiliation ne déclenche jamais une suppression immédiate des travaux."],
] as const;

export default function Conditions() {
  return (
    <>
      <TitrePage
        surtitre="Informations contractuelles"
        titre="Conditions."
      />

      <div className="pb-12">
        <BandeauIndisponible
          quoi="Aucune condition contractuelle n'est publiée."
          bloquePar="l'identité de l'éditeur, l'hébergeur, les durées de conservation et les conditions d'assistance ne sont pas arrêtés. Publier un texte provisoire serait pire que de ne rien publier : il serait opposable."
        />
      </div>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <Prose>
          <h2>Deux principes déjà fixés</h2>
          <p>
            Quelle que soit la rédaction finale, deux points ne changeront pas,
            parce qu&apos;ils tiennent au produit lui-même.
          </p>
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

          <h2>Ce que le contrat couvrira</h2>
        </Prose>

        <dl className="mt-8 max-w-[var(--spacing-lecture)] space-y-6">
          {A_ECRIRE.map(([titre, description]) => (
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

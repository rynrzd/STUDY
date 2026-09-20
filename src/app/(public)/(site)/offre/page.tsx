import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Reveler } from "@/components/site/Reveler";
import { AppelFinal, Carte, Section, TitrePage } from "@/components/site/Ui";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/offre",
  titre: "Offre",
  description:
    "Une licence annuelle par établissement, comptes enseignants inclus. Aucun abonnement élève ou professeur, aucun paiement en ligne.",
});

/**
 * /offre.
 *
 * Le tarif n'est pas publié : il est établi sur devis. Pas de faux tarif barré,
 * pas de remise fictive, pas de compte à rebours. L'hypothèse de prix interne
 * n'a rien à faire sur une page publique tant qu'elle n'a pas été confrontée à
 * de vrais acheteurs.
 */

const INCLUS = [
  "Un espace privé pour l'établissement, cloisonné des autres lycées",
  "Comptes enseignants inclus, sans limite de nombre",
  "Comptes élèves pour l'effectif convenu au devis",
  "Import de rentrée depuis un fichier .xlsx ou .csv",
  "Séances, devoirs, copies, corrections, entraide et révisions",
  "Espace d'administration et journal des actions sensibles",
  "Assistance pour l'équipe de l'établissement",
] as const;

const NON_INCLUS = [
  "Aucun abonnement élève ou professeur — le lycée finance l'accès",
  "Aucune publicité, aucune revente de données, aucun profilage",
  "Aucune fonctionnalité d'intelligence artificielle",
  "Aucune intégration officielle ENT, EduConnect ou GAR en première livraison",
] as const;

const CIRCUITS = [
  {
    acheteur: "Lycée public",
    circuit:
      "Devis, commande validée, facture déposée dans le circuit de facturation publique, virement",
    activation: "Sur commande validée et date contractuelle",
  },
  {
    acheteur: "Établissement privé",
    circuit: "Devis accepté, facture réglée par virement",
    activation: "Au paiement, ou sur crédit autorisé",
  },
  {
    acheteur: "Élève, enseignant",
    circuit: "Aucun paiement personnel",
    activation: "Compte créé par l'établissement",
  },
] as const;

export default function PageOffre() {
  return (
    <>
      <TitrePage
        surtitre="Offre"
        titre="Une licence annuelle pour l'établissement."
        chapeau="Un seul contrat, souscrit par le lycée. Les élèves et les enseignants ne paient jamais, n'ont pas de carte à saisir et n'ont aucune option à acheter."
      />

      <Section>
        <Reveler>
          <div className="carte p-8 md:p-10">
            <p className="surtitre m-0">Tarif</p>
            <p className="mt-4 m-0 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-bold md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
              Sur devis, selon l&apos;effectif
            </p>
            <p className="mt-5 max-w-[62ch] text-[color:var(--color-encre-faible)]">
              Le tarif dépend du nombre d&apos;élèves couverts et de la durée du
              contrat. Il est établi après un échange sur votre organisation, et
              tient dans un devis nominatif — pas dans une grille affichée qui
              ne correspondrait à personne.
            </p>
            <Link href="/etablissements" className="bouton bouton-primaire mt-8">
              Demander un devis
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
          </div>
        </Reveler>
      </Section>

      <Section fond="doux">
        <div className="grid gap-5 md:grid-cols-2">
          <Reveler>
            <Carte titre="Compris dans la licence" className="h-full">
              <ul className="m-0 list-none space-y-2.5 p-0">
                {INCLUS.map((element) => (
                  <li key={element} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-[9px] block size-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
                    />
                    {element}
                  </li>
                ))}
              </ul>
            </Carte>
          </Reveler>

          <Reveler delai={90}>
            <Carte titre="Ce qu'il n'y a pas" className="h-full">
              <ul className="m-0 list-none space-y-2.5 p-0">
                {NON_INCLUS.map((element) => (
                  <li key={element} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-[13px] block h-px w-3 shrink-0 bg-[color:var(--color-bordure-forte)]"
                    />
                    {element}
                  </li>
                ))}
              </ul>
            </Carte>
          </Reveler>
        </div>
      </Section>

      <Section>
        <Reveler>
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Comment se passe le règlement
          </h2>
        </Reveler>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">
              Circuit de règlement selon le type d&apos;acheteur
            </caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Acheteur</th>
                <th scope="col" className="p-3 font-semibold">Circuit</th>
                <th scope="col" className="p-3 font-semibold">Activation</th>
              </tr>
            </thead>
            <tbody>
              {CIRCUITS.map((ligne) => (
                <tr key={ligne.acheteur} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{ligne.acheteur}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.circuit}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.activation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 max-w-[var(--spacing-lecture)] space-y-4 text-[color:var(--color-encre-faible)]">
          <p>
            Tout passe par un devis nominatif, puis par une facture réglée par
            virement. Il n&apos;y a <strong>aucun paiement par carte</strong>,
            aucun prélèvement automatique et aucun compte à ouvrir chez un
            prestataire de paiement : {MARQUE} n&apos;en utilise aucun.
          </p>
          <p>
            L&apos;effectif facturé est fixé au devis. Ajouter un élève en cours
            d&apos;année ne déclenche aucun prélèvement supplémentaire : un
            dépassement ouvre une discussion contractuelle, jamais un blocage de
            la rentrée.
          </p>
          <p>
            Le renouvellement est proposé, jamais tacite. Un rappel est adressé
            aux contacts habilités deux mois puis un mois avant l&apos;échéance.
            Un retard de paiement donne lieu à une relance administrative — pas à
            un message aux élèves, ni à une suppression automatique des cours.
          </p>
          <p>
            Un pilote peut être limité à deux classes, avec une durée, un
            périmètre et des conditions écrits.
          </p>
        </div>
      </Section>

      <AppelFinal
        titre="Demander un devis"
        chapeau="Dites-nous combien de classes et quelle échéance. Nous établissons un devis nominatif, sans relance automatique."
      />
    </>
  );
}

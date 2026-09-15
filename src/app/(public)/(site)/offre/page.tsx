import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Carte } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Offre",
  description:
    "Une licence annuelle par établissement, comptes enseignants inclus. " +
    "Aucun abonnement élève ou professeur.",
};

/**
 * /offre — ch. 05.
 *
 * Le prix commercial n'est pas validé. Tant qu'il ne l'est pas, la page affiche
 * « Sur devis selon l'effectif » — et surtout pas un faux tarif barré, ni une
 * remise fictive, ni un compte à rebours. Le ch. 06 chiffre une hypothèse à
 * tester (3 € par élève et par an, minimum 1 200 €) : c'est une hypothèse
 * interne, elle n'a rien à faire sur une page publique.
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

export default function Offre() {
  return (
    <>
      <TitrePage
        surtitre="Offre"
        titre="Une licence annuelle pour l'établissement."
        chapeau="Un seul contrat, souscrit par le lycée. Les élèves et les enseignants ne paient jamais, n'ont pas de carte à saisir et n'ont aucune option à acheter."
      />

      <section className="pb-12">
        <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-8">
          <p className="m-0 text-[color:var(--color-encre-faible)]">Tarif</p>
          <p className="mt-2 m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)] titre-app">
            Sur devis, selon l&apos;effectif
          </p>
          <p className="mt-4 max-w-[62ch] text-[color:var(--color-encre-faible)]">
            Le tarif dépend du nombre d&apos;élèves couverts et de la durée du
            contrat. Il n&apos;est pas arrêté : il sera publié quand il aura été
            validé avec des acheteurs réels et rapporté au coût réel de
            stockage, d&apos;assistance et d&apos;exploitation.
          </p>
          <Link
            href="/etablissements"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-6 text-[color:var(--color-surface)] no-underline"
          >
            Demander un devis
          </Link>
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <Carte titre="Compris dans la licence">
            <ul className="list-none space-y-2 p-0 m-0 text-[color:var(--color-encre-faible)]">
              {INCLUS.map((element) => (
                <li key={element}>{element}</li>
              ))}
            </ul>
          </Carte>
          <Carte titre="Ce qu'il n'y a pas">
            <ul className="list-none space-y-2 p-0 m-0 text-[color:var(--color-encre-faible)]">
              {NON_INCLUS.map((element) => (
                <li key={element}>{element}</li>
              ))}
            </ul>
          </Carte>
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Comment se passe le règlement
        </h2>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">
              Circuit de règlement selon le type d&apos;acheteur
            </caption>
            <thead>
              <tr className="bg-[color:var(--color-rose-selection)] text-left">
                <th scope="col" className="p-3 font-semibold">Acheteur</th>
                <th scope="col" className="p-3 font-semibold">Circuit</th>
                <th scope="col" className="p-3 font-semibold">Activation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[color:var(--color-bordure)]">
                <th scope="row" className="p-3 text-left font-normal">Lycée public</th>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Devis, commande validée, facture déposée dans le circuit de facturation publique, virement</td>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Sur commande validée et date contractuelle</td>
              </tr>
              <tr className="border-b border-[color:var(--color-bordure)]">
                <th scope="row" className="p-3 text-left font-normal">Établissement privé</th>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Devis accepté, facture réglée par virement</td>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Au paiement, ou sur crédit autorisé</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 text-left font-normal">Élève, enseignant</th>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Aucun paiement personnel</td>
                <td className="p-3 text-[color:var(--color-encre-faible)]">Compte créé par l&apos;établissement</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 max-w-[62ch] space-y-4 text-[color:var(--color-encre-faible)]">
          <p>
            Tout passe par un devis nominatif, puis par une facture réglée par
            virement. Il n&apos;y a <strong>aucun paiement par carte</strong>,
            aucun prélèvement automatique et aucun compte à ouvrir chez un
            prestataire de paiement : study. n&apos;en utilise aucun.
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
      </section>
    </>
  );
}

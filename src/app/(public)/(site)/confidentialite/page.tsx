import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Prose, BandeauIndisponible } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Quelles données study. traite, lesquelles il ne collecte pas, et combien de temps.",
};

/**
 * Confidentialité — ch. 26.
 *
 * Deux registres distincts, et il faut les tenir séparés :
 *  - ce qui est déjà décidé dans le produit (minimisation, absence de collecte) :
 *    c'est vrai aujourd'hui et ça peut être écrit ;
 *  - ce qui dépend du contrat avec chaque établissement (durées, responsable de
 *    traitement, sous-traitants) : ce sont des propositions à faire valider, pas
 *    des engagements pris unilatéralement.
 */

const COLLECTE = [
  "Identité scolaire : prénom, nom, et un identifiant d'origine fourni par l'établissement",
  "Classe et groupes, avec les dates d'inscription",
  "Contenus pédagogiques : cours, devoirs, copies, corrections, messages d'entraide",
  "Données de compte et traces techniques utiles au fonctionnement et à la sécurité",
  "Pour les adultes uniquement : adresse électronique professionnelle",
] as const;

const NON_COLLECTE = [
  "Date de naissance",
  "Adresse familiale",
  "Numéro de sécurité sociale",
  "Données de santé, et motif d'absence",
  "Adresse électronique des élèves",
  "Données de localisation",
] as const;

const DUREES = [
  ["Fichier d'import et données de préparation", "Suppression sous 7 jours après la fin du traitement"],
  ["Lot de fiches d'accès", "24 heures au maximum ; les secrets sont invalidés séparément"],
  ["Messages d'entraide", "Année scolaire + 3 mois, sauf dossier signalé justifié"],
  ["Cours, copies et corrections", "Année scolaire + 12 mois pour restitution, puis purge selon la décision validée"],
  ["Journaux techniques", "30 jours ; événements de sécurité 6 mois"],
  ["Demande de devis sans suite", "12 mois, puis suppression ou anonymisation"],
  ["Documents comptables", "Durée légale applicable, à confirmer avec le conseil comptable"],
] as const;

export default function Confidentialite() {
  return (
    <>
      <TitrePage
        surtitre="Informations contractuelles"
        titre="Confidentialité."
        chapeau="Ce que study. traite, ce qu'il ne collecte pas, et pendant combien de temps. Écrit pour être compris par un élève autant que par une direction."
      />

      <div className="pb-12">
        <BandeauIndisponible
          quoi="Cette notice est incomplète."
          bloquePar="le responsable de traitement, les sous-traitants effectifs, l'hébergeur et le contact pour l'exercice des droits ne sont pas déterminés. Ils seront identifiés avec chaque établissement avant tout pilote réel."
        />
      </div>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Ce qui est traité
            </h2>
            <ul className="mt-4 list-none space-y-2 p-0 text-[color:var(--color-encre-faible)]">
              {COLLECTE.map((element) => (
                <li key={element}>{element}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Ce qui n&apos;est jamais demandé
            </h2>
            <ul className="mt-4 list-none space-y-2 p-0 text-[color:var(--color-encre-faible)]">
              {NON_COLLECTE.map((element) => (
                <li key={element}>{element}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <Prose>
          <h2>Ce qui ne se produit pas</h2>
          <ul>
            <li>Aucune publicité, ciblée ou non.</li>
            <li>Aucune revente ni mise à disposition de données à un tiers commercial.</li>
            <li>Aucun profil public, aucun classement entre élèves.</li>
            <li>Aucun entraînement d&apos;intelligence artificielle sur les travaux des élèves — study. ne comporte aucune fonctionnalité d&apos;IA.</li>
            <li>Aucun enregistrement vidéo des sessions, aucune capture des champs de mot de passe.</li>
          </ul>
        </Prose>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Durées de conservation proposées
        </h2>
        <p className="mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Ce sont des choix de conception, à faire valider dans le contrat de
          chaque établissement. Ce ne sont pas des obligations légales
          universelles, et ils ne s&apos;appliquent pas avant d&apos;avoir été
          acceptés.
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">Durées de conservation proposées par type de donnée</caption>
            <thead>
              <tr className="bg-[color:var(--color-rose-selection)] text-left">
                <th scope="col" className="p-3 font-semibold">Donnée</th>
                <th scope="col" className="p-3 font-semibold">Durée proposée</th>
              </tr>
            </thead>
            <tbody>
              {DUREES.map(([donnee, duree]) => (
                <tr key={donnee} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{donnee}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <Prose>
          <h2>Exercer vos droits</h2>
          <p>
            Dans un service scolaire, c&apos;est en général
            l&apos;établissement qui détermine les finalités du traitement :
            c&apos;est donc à lui que les demandes s&apos;adressent en premier,
            et il dispose d&apos;un délégué à la protection des données. Le
            circuit exact sera précisé pour chaque établissement dans le contrat,
            avec le contact à joindre.
          </p>
          <p>
            Un clic de consentement d&apos;un élève mineur ne saurait à lui seul
            fonder le service : la base légale est établie avec
            l&apos;établissement, pas demandée à l&apos;élève.
          </p>

          <h2>Sécurité</h2>
          <p>
            Les mécanismes de protection des accès, et leur état réel
            d&apos;avancement, sont décrits sur la page{" "}
            <Link href="/securite" className="text-[color:var(--color-accent)]">sécurité</Link>.
          </p>
        </Prose>
      </section>
    </>
  );
}

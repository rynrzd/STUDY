import type { Metadata } from "next";
import Link from "next/link";
import { Prose, Section, TitrePage } from "@/components/site/Ui";
import { CONSERVATION, IDENTITE, MARQUE, mention } from "@/lib/identite-legale";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Quelles données AvecStudy traite, lesquelles il ne collecte pas, combien de temps " +
    "il les conserve et comment exercer vos droits.",
  alternates: { canonical: "/confidentialite" },
};

/**
 * Confidentialité.
 *
 * Deux registres, tenus séparés :
 *  - ce qui est décidé dans le produit (minimisation, absence de collecte) :
 *    vrai aujourd'hui, donc affirmé ;
 *  - ce qui dépend du contrat de chaque établissement (finalités, base légale,
 *    durées appliquées) : présenté comme ce qu'il est, un cadre à convenir.
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

const DUREES_SCOLAIRES = [
  ["Fichier d'import et données de préparation", "Suppression sous 7 jours après la fin du traitement"],
  ["Lot de fiches d'accès", "24 heures au maximum ; les secrets sont invalidés séparément"],
  ["Messages d'entraide", "Année scolaire + 3 mois, sauf dossier signalé justifié"],
  ["Cours, copies et corrections", "Durée du contrat de l'établissement, puis suppression ou restitution"],
  ["Documents comptables", "Durée légale applicable"],
] as const;

export default function PageConfidentialite() {
  return (
    <>
      <TitrePage
        surtitre="Informations légales"
        titre="Confidentialité."
        chapeau={`Ce que ${MARQUE} traite, ce qu'il ne collecte pas, et pendant combien de temps. Écrit pour être compris par un élève autant que par une direction.`}
      />

      <Section>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="carte p-6 md:p-7">
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Ce qui est traité
            </h2>
            <ul className="m-0 mt-4 list-none space-y-2.5 p-0 text-[color:var(--color-encre-faible)]">
              {COLLECTE.map((element) => (
                <li key={element} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[9px] block size-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
                  />
                  {element}
                </li>
              ))}
            </ul>
          </div>

          <div className="carte p-6 md:p-7">
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Ce qui n&apos;est jamais demandé
            </h2>
            <ul className="m-0 mt-4 list-none space-y-2.5 p-0 text-[color:var(--color-encre-faible)]">
              {NON_COLLECTE.map((element) => (
                <li key={element} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[13px] block h-px w-3 shrink-0 bg-[color:var(--color-bordure-forte)]"
                  />
                  {element}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section fond="doux">
        <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
          Durées de conservation
        </h2>
        <p className="mt-5 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Les durées annoncées publiquement, et celles appliquées aux données
          scolaires, qui suivent le contrat de l&apos;établissement.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">Durées de conservation annoncées</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Donnée</th>
                <th scope="col" className="p-3 font-semibold">Durée</th>
                <th scope="col" className="p-3 font-semibold">Précision</th>
              </tr>
            </thead>
            <tbody>
              {CONSERVATION.map((ligne) => (
                <tr key={ligne.donnees} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{ligne.donnees}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.duree}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.precision}</td>
                </tr>
              ))}
              {DUREES_SCOLAIRES.map(([donnee, duree]) => (
                <tr key={donnee} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{donnee}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{duree}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">Selon le contrat de l&apos;établissement</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
          Sous-traitants
        </h2>
        <p className="mt-5 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Ces prestataires interviennent pour notre compte, dans le cadre d&apos;un
          contrat de sous-traitance.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">Sous-traitants et données confiées</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Sous-traitant</th>
                <th scope="col" className="p-3 font-semibold">Rôle</th>
                <th scope="col" className="p-3 font-semibold">Données confiées</th>
              </tr>
            </thead>
            <tbody>
              {IDENTITE.sousTraitants.map((sousTraitant) => (
                <tr key={sousTraitant.nom} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{sousTraitant.nom}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{sousTraitant.role}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{sousTraitant.donnees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section fond="doux">
        <Prose>
          <h2>Ce qui ne se produit pas</h2>
          <ul>
            <li>Aucune publicité, ciblée ou non.</li>
            <li>Aucune revente ni mise à disposition de données à un tiers commercial.</li>
            <li>Aucun profil public, aucun classement entre élèves.</li>
            <li>
              Aucun entraînement d&apos;intelligence artificielle sur les travaux
              des élèves — {MARQUE} ne comporte aucune fonctionnalité d&apos;IA.
            </li>
            <li>Aucun enregistrement vidéo des sessions, aucune capture des champs de mot de passe.</li>
            <li>Aucun cookie publicitaire ni traceur de mesure d&apos;audience tiers.</li>
          </ul>

          <h2>Qui est responsable de quoi</h2>
          <p>
            Dans un service scolaire, c&apos;est l&apos;établissement qui
            détermine les finalités du traitement des données de ses élèves :
            il en est le responsable de traitement, et {MARQUE} agit comme
            sous-traitant pour son compte. Pour les demandes commerciales
            déposées sur ce site, en revanche, l&apos;éditeur est responsable de
            traitement.
          </p>
          <p>
            Un clic de consentement d&apos;un élève mineur ne saurait à lui seul
            fonder le service : la base légale est établie avec
            l&apos;établissement, pas demandée à l&apos;élève.
          </p>

          <h2>Exercer vos droits</h2>
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification,
            d&apos;effacement, de limitation et d&apos;opposition. Si vous êtes
            élève, parent ou enseignant, adressez-vous d&apos;abord à votre
            établissement et à son délégué à la protection des données :
            c&apos;est lui qui décide des traitements scolaires.
          </p>
          <p>
            Pour les données que vous nous avez transmises directement — une
            demande de démonstration, par exemple — écrivez à l&apos;éditeur :{" "}
            {IDENTITE.contactEmail === null ? (
              <>
                l&apos;adresse de contact est en cours de publication (voir les{" "}
                <Link href="/mentions-legales">mentions légales</Link>) ; le{" "}
                <Link href="/etablissements">formulaire de demande</Link>{" "}
                enregistre votre message et vous rend une référence de suivi.
              </>
            ) : (
              <a href={`mailto:${IDENTITE.contactEmail}`}>{IDENTITE.contactEmail}</a>
            )}
          </p>
          <p>
            Vous pouvez également introduire une réclamation auprès de la CNIL.
          </p>

          <h2>Hébergement</h2>
          <p>
            L&apos;application est hébergée par {IDENTITE.hebergeur.nom}
            {IDENTITE.hebergeur.adresse === null
              ? ""
              : ` (${IDENTITE.hebergeur.adresse})`}
            . Les données, l&apos;authentification et les fichiers sont confiés à
            Supabase. Les coordonnées légales complètes figurent dans les{" "}
            <Link href="/mentions-legales">mentions légales</Link> — SIRET de
            l&apos;éditeur : {mention(IDENTITE.siret)}.
          </p>

          <h2>Sécurité</h2>
          <p>
            Les mécanismes de protection des accès et leurs limites sont décrits
            sur la page <Link href="/securite">sécurité</Link>.
          </p>
        </Prose>
      </Section>
    </>
  );
}

import { RaccourcisPublics } from "@/components/site/RaccourcisPublics";
import type { Metadata } from "next";
import Link from "next/link";
import { pagePublique } from "@/lib/metadonnees";
import { FormulaireDemande } from "@/components/site/FormulaireDemande";
import { EnteteSection, Section, TitrePage } from "@/components/site/Ui";
import { jetonOuverture } from "@/lib/demande-commerciale";
import { IDENTITE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/contact",
  titre: "Contact et démonstration",
  description: "À qui s'adresser selon votre situation, et demande de démonstration pour votre établissement.",
});

/**
 * P18 — Contact et démonstration, R2 (cahier §05).
 *
 * Le bon interlocuteur selon la situation (un élève s'adresse à son lycée),
 * les coordonnées réelles de l'éditeur, puis le formulaire existant — le même
 * service que /etablissements, avec sa protection contre les abus et un
 * accusé réel. Aucune donnée de formulaire n'est envoyée à un outil de mesure.
 */
export const dynamic = "force-dynamic";

const CAS = [
  ["Vous êtes élève", "Adressez-vous à votre établissement : seul votre lycée gère votre compte, après avoir vérifié votre identité. Un accès oublié se demande depuis la page de connexion."],
  ["Vous êtes enseignant", "Pour un accès ou une affectation, passez par l'administrateur de votre établissement : il peut corriger sans passer par nous."],
  ["Vous administrez le service", "Le canal d'assistance dédié est ouvert à la signature du contrat, avec ses délais et ses interlocuteurs."],
  ["Vous voulez équiper votre lycée", "Le formulaire ci-dessous nous donne ce qu'il faut pour vous répondre, et vous rend une référence de suivi."],
] as const;

export default function PageContact() {
  const secret = process.env.SESSION_ENCRYPTION_KEY ?? "";
  const ouverture = secret === "" ? "" : jetonOuverture(secret);

  return (
    <>
      <TitrePage
        surtitre="Contact"
        titre="Parlons de votre établissement."
        chapeau="Une démonstration, un projet pour votre lycée ou une question sur vos accès ? Retrouvez ici le bon interlocuteur."
        actions={
          <a href="#demande" className="bouton bouton-primaire bouton-grand">
            Demander une démonstration
          </a>
        }
      />

      <Section>
        <div className="mb-10"><RaccourcisPublics /></div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {CAS.map(([titre, texte]) => (
            <article key={titre} className="carte p-6 md:p-7">
              <h2 className="m-0 text-[1.25rem] font-extrabold">{titre}</h2>
              <p className="m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)]">{texte}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6 md:p-7">
          <h2 className="m-0 text-[1.125rem] font-extrabold">Coordonnées de l&apos;éditeur</h2>
          <p className="m-0 mt-2 text-[1rem]">
            {IDENTITE.editeur}, {IDENTITE.formeJuridique}. Directeur de la publication : {IDENTITE.directeurPublication}.
          </p>
          {IDENTITE.contactEmail === null ? (
            <p className="m-0 mt-2 text-[1rem]">
              L&apos;adresse de contact publique figure dans les{" "}
              <Link href="/mentions-legales" className="font-semibold text-[color:var(--color-accent)]">
                mentions légales
              </Link>
              .
            </p>
          ) : (
            <p className="m-0 mt-2 text-[1rem]">
              <a href={`mailto:${IDENTITE.contactEmail}`} className="font-semibold text-[color:var(--color-accent)]">
                {IDENTITE.contactEmail}
              </a>
              {IDENTITE.contactTelephone === null ? null : <> — {IDENTITE.contactTelephone}</>}
            </p>
          )}
        </div>
      </Section>

      <Section id="demande" fond="blanc">
        <div className="max-w-[760px]">
          <EnteteSection titre="Demander une démonstration" chapeau="Dites-nous comment votre lycée est organisé et ce que vous cherchez à régler. Aucun fichier d'élèves n'est demandé à cette étape." />
          <div className="mt-8">
            <FormulaireDemande ouverture={ouverture} />
          </div>
        </div>
      </Section>
    </>
  );
}

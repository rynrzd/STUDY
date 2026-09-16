import type { Metadata } from "next";
import Link from "next/link";
import { Reveler } from "@/components/site/Reveler";
import { Carte, Section, TitrePage } from "@/components/site/Ui";
import { IDENTITE, MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = {
  title: "Contact",
  description: "À qui s'adresser selon votre situation.",
  alternates: { canonical: "/contact" },
};

const CAS = [
  {
    titre: "Vous êtes élève",
    texte:
      "Adressez-vous à votre établissement. Nous ne pouvons ni retrouver votre identifiant, ni réinitialiser votre mot de passe : seul votre lycée gère votre compte, après avoir vérifié votre identité sur place.",
  },
  {
    titre: "Vous êtes enseignant",
    texte:
      "Pour un problème d'accès ou d'affectation, passez par l'administrateur de votre établissement. Il peut réinitialiser un accès et corriger une affectation sans passer par nous.",
  },
  {
    titre: "Vous administrez le service dans un lycée",
    texte:
      "Le canal d'assistance dédié est ouvert à la signature du contrat. Les délais et les interlocuteurs y sont écrits, pas laissés à l'appréciation.",
  },
  {
    titre: "Vous voulez équiper votre établissement",
    texte:
      "Passez par le formulaire de demande : il nous donne d'emblée ce qu'il faut pour vous répondre utilement, et il vous rend une référence de suivi.",
  },
] as const;

export default function PageContact() {
  return (
    <>
      <TitrePage
        surtitre="Contact"
        titre="À qui s'adresser."
        chapeau={`${MARQUE} est fourni à des établissements. Selon qui vous êtes, l'interlocuteur n'est pas le même — et ce n'est pas toujours nous.`}
        actions={
          <Link href="/etablissements" className="bouton bouton-primaire">
            Écrire depuis le formulaire
            <span aria-hidden="true" className="fleche">→</span>
          </Link>
        }
      />

      <Section>
        <div className="grid gap-5 md:grid-cols-2">
          {CAS.map((cas, index) => (
            <Reveler key={cas.titre} delai={(index % 2) * 70}>
              <Carte titre={cas.titre} className="h-full">
                <p>{cas.texte}</p>
              </Carte>
            </Reveler>
          ))}
        </div>

        <Reveler delai={120}>
          <div className="carte mt-10 p-7 md:p-8">
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Coordonnées de l&apos;éditeur
            </h2>
            <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">
              {IDENTITE.editeur}, {IDENTITE.formeJuridique}. Directeur de la
              publication : {IDENTITE.directeurPublication}.
            </p>

            {IDENTITE.contactEmail === null ? (
              <p className="mt-4 m-0 text-[color:var(--color-encre-faible)]">
                L&apos;adresse de contact publique figure dans les{" "}
                <Link href="/mentions-legales" className="text-[color:var(--color-accent)]">
                  mentions légales
                </Link>
                . En attendant sa publication, le formulaire de demande est le
                canal écrit : il enregistre votre message et vous rend une
                référence de suivi.
              </p>
            ) : (
              <p className="mt-4 m-0">
                <a
                  href={`mailto:${IDENTITE.contactEmail}`}
                  className="text-[color:var(--color-accent)]"
                >
                  {IDENTITE.contactEmail}
                </a>
                {IDENTITE.contactTelephone === null ? null : (
                  <> — {IDENTITE.contactTelephone}</>
                )}
              </p>
            )}
          </div>
        </Reveler>
      </Section>
    </>
  );
}

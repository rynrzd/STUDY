import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Carte, BandeauIndisponible } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Contact",
  description: "À qui s'adresser selon votre situation.",
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
      "Pour un problème d'accès ou d'affectation, passez par l'administrateur study. de votre établissement. Il peut réinitialiser un accès et corriger une affectation sans passer par nous.",
  },
  {
    titre: "Vous administrez study. dans un lycée",
    texte:
      "Le canal d'assistance dédié est ouvert à la signature du contrat. Les délais et les interlocuteurs y sont écrits, pas laissés à l'appréciation.",
  },
  {
    titre: "Vous voulez équiper votre établissement",
    texte:
      "Passez par la demande de devis : elle nous donne d'emblée ce qu'il faut pour vous répondre utilement.",
  },
] as const;

export default function Contact() {
  return (
    <>
      <TitrePage
        surtitre="Contact"
        titre="À qui s'adresser."
        chapeau="study. est fourni à des établissements. Selon qui vous êtes, l'interlocuteur n'est pas le même — et ce n'est pas toujours nous."
      />

      <div className="pb-12">
        <BandeauIndisponible
          quoi="Aucune adresse de contact n'est publiée pour l'instant."
          bloquePar="l'identité contractuelle de l'éditeur n'est pas arrêtée. Afficher une adresse provisoire, ou celle d'un autre projet, créerait une confusion sur qui est responsable."
        />
      </div>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {CAS.map((cas) => (
            <Carte key={cas.titre} titre={cas.titre}>
              <p className="m-0 text-[color:var(--color-encre-faible)]">{cas.texte}</p>
            </Carte>
          ))}
        </div>

        <p className="mt-8">
          <Link href="/etablissements" className="text-[color:var(--color-accent)]">
            Demander un devis
          </Link>
        </p>
      </section>
    </>
  );
}

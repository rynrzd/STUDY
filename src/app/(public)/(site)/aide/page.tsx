import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Prose, Section, TitrePage } from "@/components/site/Ui";

export const metadata: Metadata = pagePublique({
  chemin: "/aide",
  titre: "Aide",
  description:
    "Les questions les plus fréquentes, et à qui s'adresser.",
});

const QUESTIONS = [
  {
    q: "J'ai perdu mon identifiant ou mon mot de passe.",
    r: "Adressez-vous à l'administrateur de votre établissement. Il réinitialise votre accès après avoir vérifié votre identité sur place. L'ancien secret devient alors inutilisable. Personne, y compris votre administrateur, ne peut lire votre mot de passe personnel : il n'est affiché nulle part.",
  },
  {
    q: "Mon professeur a publié un cours mais je ne le vois pas.",
    r: "Une séance est publiée à une classe précise. Si vous ne la voyez pas, soit elle a été publiée à une autre classe, soit elle est encore en brouillon, soit votre inscription à cette classe n'est pas enregistrée. Signalez-le à votre professeur : c'est lui qui voit la cible de sa publication.",
  },
  {
    q: "À quoi sert la case « fait » ?",
    r: "Elle vous sert à vous. Cocher un devoir comme fait ne prévient personne, ne compte dans aucune statistique et ne change rien pour votre professeur. C'est un repère personnel, que vous pouvez décocher à tout moment.",
  },
  {
    q: "Je n'ai pas d'ordinateur à la maison.",
    r: "Le support de cours s'imprime : demandez à votre professeur de vous le donner sur papier. Tout ce qui est publié à votre classe est consultable depuis un téléphone, et la mise en page s'y adapte.",
  },
  {
    q: "Qui peut lire les questions que je pose dans l'entraide ?",
    r: "Les élèves de votre classe, et le professeur de ce cours. Votre prénom et l'initiale de votre nom s'affichent à côté de votre question. Ce n'est ni un espace secret, ni un espace lu en permanence par les adultes — et c'est écrit dans l'espace lui-même.",
  },
  {
    q: "Que deviennent mes données à la fin de l'année ?",
    r: "Les durées de conservation et les droits d'export sont écrits dans le contrat de votre établissement. Votre lycée peut vous les communiquer.",
  },
] as const;

export default function Aide() {
  return (
    <>
      <TitrePage
        surtitre="Aide"
        titre="Questions fréquentes."
        chapeau="Ces réponses valent pour les élèves et les enseignants. Pour une question sur votre compte, votre établissement est le bon interlocuteur : c'est lui qui gère les accès."
      />

      <Section>
        <dl className="m-0 max-w-[var(--spacing-lecture)] space-y-8 p-0">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="border-b border-[color:var(--color-bordure)] pb-8">
              <dt className="text-[length:var(--text-h3)] font-bold leading-[var(--text-h3--line-height)]">
                {item.q}
              </dt>
              <dd className="m-0 mt-3 text-[color:var(--color-encre-faible)]">{item.r}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12">
          <Prose>
            <h2>Vous n&apos;avez pas trouvé votre réponse</h2>
            <p>
              La page <Link href="/contact">contact</Link> indique à qui
              s&apos;adresser selon votre situation. Pour une question sur un
              compte, votre établissement répond plus vite que nous : c&apos;est
              lui qui gère les accès.
            </p>
          </Prose>
        </div>
      </Section>
    </>
  );
}

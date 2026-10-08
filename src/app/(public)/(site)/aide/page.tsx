import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Faq } from "@/components/site/Onglets";
import { Section, TitrePage } from "@/components/site/Ui";

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

/**
 * P12 — Aide (maquette R2 n° 2, « Comment pouvons-nous vous aider ? ») : les
 * questions fréquentes en accordéon (details natif, lisible sans script) et,
 * à côté, à qui s’adresser. Textes alignés sur ce que le produit fait
 * réellement.
 */
export default function Aide() {
  return (
    <>
      <TitrePage
        surtitre="Aide"
        titre="Comment pouvons-nous vous aider ?"
        chapeau="Ces réponses valent pour les élèves et les enseignants. Pour une question sur votre compte, votre établissement est le bon interlocuteur : c’est lui qui gère les accès."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start">
          <div className="rounded-[var(--radius-grand)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-6 py-2">
            <h2 className="m-0 pt-4 pb-2 text-[1.125rem] font-bold">Questions fréquentes</h2>
            <Faq questions={QUESTIONS.map((x) => ({ question: x.q, reponse: x.r }))} />
          </div>
          <aside className="flex flex-col items-center rounded-[var(--radius-grand)] bg-[color:var(--color-rose-clair)] p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-accent)]" aria-hidden="true">
              <Mail size={24} strokeWidth={1.75} />
            </span>
            <h2 className="m-0 mt-4 text-[1.125rem] font-bold">Contacter votre établissement</h2>
            <p className="m-0 mt-2 text-[0.9375rem] text-[color:var(--color-encre-faible)]">
              Pour un compte, une classe ou un accès : l’équipe de votre lycée (vie scolaire, professeur principal, administration) répond plus vite que nous.
            </p>
            <Link href="/contact" className="bouton bouton-secondaire mt-5">
              Autres situations
            </Link>
          </aside>
        </div>
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Prose } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Aide",
  description: "Les questions les plus fréquentes, et à qui s'adresser.",
};

const QUESTIONS = [
  {
    q: "J'ai perdu mon identifiant ou mon mot de passe.",
    r: "Adressez-vous à l'administrateur study. de votre établissement. Il réinitialise votre accès après avoir vérifié votre identité sur place. L'ancien secret devient alors inutilisable. Personne, y compris votre administrateur, ne peut lire votre mot de passe personnel : il n'est affiché nulle part.",
  },
  {
    q: "Mon professeur a publié un cours mais je ne le vois pas.",
    r: "Une séance est publiée à une classe précise. Si vous ne la voyez pas, soit elle a été publiée à une autre classe, soit elle est encore en brouillon, soit votre inscription à cette classe n'est pas enregistrée. Signalez-le à votre professeur : c'est lui qui voit la cible de sa publication.",
  },
  {
    q: "Quelle est la différence entre « enregistré » et « remis » ?",
    r: "« Enregistré » veut dire que votre brouillon est sauvegardé — il reste privé, votre professeur n'en voit pas le contenu. « Remis » veut dire que votre copie a été envoyée : elle porte alors une date du serveur et une version. Les deux sont toujours distingués à l'écran. Tant que vous n'avez pas remis, votre professeur ne reçoit rien.",
  },
  {
    q: "Je n'ai pas d'ordinateur à la maison.",
    r: "Le support de cours est imprimable, et la remise sur papier est prévue : votre professeur coche la remise physique. L'absence de photo de votre cahier ne compte pas comme un devoir non rendu quand le mode papier a été choisi.",
  },
  {
    q: "Puis-je travailler à plusieurs sur un devoir ?",
    r: "Si votre enseignant a autorisé l'entraide sur ce devoir, vous pouvez créer ou rejoindre un groupe de 2 à 6 élèves, avec un brouillon partagé. Ce brouillon est séparé de votre copie : recopier un passage dans votre réponse reste une décision volontaire, et ne remet jamais le devoir au nom des autres.",
  },
  {
    q: "Qui peut lire les messages d'entraide ?",
    r: "Les membres du groupe. Un message signalé peut être examiné par un modérateur désigné par l'établissement. Ce n'est ni un espace secret, ni un espace lu en permanence par les adultes — et c'est écrit dans l'espace lui-même.",
  },
  {
    q: "Un professeur peut-il voir mon brouillon pendant que j'écris ?",
    r: "Seulement si le suivi en direct a été activé sur la séance, et dans ce cas l'écran vous l'indique clairement. En dehors de ce cas, votre professeur voit où vous en êtes (commencé, remis), pas ce que vous avez écrit.",
  },
  {
    q: "Que deviennent mes copies à la fin de l'année ?",
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

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <dl className="max-w-[var(--spacing-lecture)] space-y-8">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="border-b border-[color:var(--color-bordure)] pb-8">
              <dt className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)] titre-app">
                {item.q}
              </dt>
              <dd className="mt-3 ml-0 text-[color:var(--color-encre-faible)]">{item.r}</dd>
            </div>
          ))}
        </dl>

        <Prose>
          <h2>Vous n&apos;avez pas trouvé votre réponse</h2>
          <p>
            Les guides détaillés — administrateur, professeur, élève — seront
            publiés avec la première livraison complète. En attendant, la page{" "}
            <Link href="/contact" className="text-[color:var(--color-accent)]">contact</Link>{" "}
            indique à qui s&apos;adresser selon votre situation.
          </p>
        </Prose>
      </section>
    </>
  );
}

import Link from "next/link";
import { LARGEUR } from "@/components/public/Chrome";
import { Situations } from "@/components/landing/Situations";
import { Apparition } from "@/components/landing/Apparition";
import { Faq } from "@/components/landing/Faq";
import { SequencePublication, SequenceImport } from "@/components/landing/Sequences";
import { Apercu, ApercuEleve, ApercuProfesseur, ApercuEntraide } from "@/components/landing/Apercus";

/**
 * Landing publique — cahier des charges v2.0, ch. 04, chorégraphie ch. 34.
 *
 * Les libellés donnés comme exacts sont repris mot pour mot. Ce qui est
 * explicitement interdit reste absent : pas de prix dans le hero, pas de
 * « certifié RGPD », pas de faux témoignage, pas de carrousel automatique,
 * pas de promesse chiffrée sur les notes.
 *
 * Deux changements imposés par la v2.0 par rapport à la première version :
 * le hero devient asymétrique avec un grand aperçu à droite, et la section
 * enseignants n'est plus une grille de quatre cartes textuelles.
 */

function Hero() {
  return (
    <section className={`${LARGEUR} py-16 md:py-24`}>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <h1 className="text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)] md:text-[length:var(--text-h1-public)] md:leading-[var(--text-h1-public--line-height)]">
            <span className="hero-ligne">La classe.</span>
            <span className="hero-ligne" style={{ "--delai": "100ms" } as React.CSSProperties}>
              <span className="surlignage" style={{ "--delai": "450ms" } as React.CSSProperties}>
                Tout simplement.
              </span>
            </span>
          </h1>

          <p
            className="hero-ligne mt-6 max-w-[46ch] text-[color:var(--color-encre-faible)]"
            style={{ "--delai": "250ms" } as React.CSSProperties}
          >
            Les cours, les devoirs et l&apos;entraide, au même endroit.
          </p>

          <div
            className="hero-ligne mt-8 flex flex-wrap items-center gap-3"
            style={{ "--delai": "350ms" } as React.CSSProperties}
          >
            <Link href="/demo" className="bouton bouton-noir">
              Découvrir study.
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
            <Link href="/etablissements" className="bouton bouton-clair">
              Équiper mon lycée
            </Link>
          </div>

          <div
            className="hero-ligne mt-12 max-w-[32ch] border-t border-[color:var(--color-bordure)] pt-5 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
            style={{ "--delai": "450ms" } as React.CSSProperties}
          >
            Des lycées plus unis pour des élèves plus sereins.
          </div>
        </div>

        <div
          className="hero-ligne"
          style={{ "--delai": "450ms" } as React.CSSProperties}
        >
          <Apercu legende="la journée d'un élève de Seconde 1">
            <ApercuEleve />
          </Apercu>
        </div>
      </div>
    </section>
  );
}

function Enseignants() {
  return (
    <section className={`${LARGEUR} border-t border-[color:var(--color-bordure)] py-16 md:py-24`}>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Apparition>
          <p className="m-0 text-[length:var(--text-aide)] uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">
            Pour les professeurs
          </p>
          <h2 className="mt-4 max-w-[14ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)]">
            Votre séance est prête. Votre classe aussi.
          </h2>
          <p className="mt-6 max-w-[46ch] text-[color:var(--color-encre-faible)]">
            Partagez le cours du jour. Retrouvez les copies et accompagnez chaque
            élève.
          </p>

          <div className="mt-8">
            <SequencePublication />
          </div>

          <p className="mt-6">
            <Link href="/fonctionnalites" className="text-[color:var(--color-accent)]">
              Voir le côté professeur →
            </Link>
          </p>
        </Apparition>

        <Apparition delai={120}>
          <Apercu legende="deux classes, deux progressions indépendantes">
            <ApercuProfesseur />
          </Apercu>
        </Apparition>
      </div>
    </section>
  );
}

function Eleves() {
  return (
    <section className="mt-8 bg-[color:var(--color-rose-selection)] py-16 md:py-24">
      <div className={LARGEUR}>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Apparition>
            <div className="rounded-[var(--radius-carte)] bg-[color:var(--color-surface)]">
              <ApercuEntraide />
            </div>
            <p className="mt-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
              Aperçu de l&apos;interface en construction — un groupe d&apos;entraide
              autorisé par l&apos;enseignant. Maquette, pas une capture.
            </p>
          </Apparition>

          <Apparition delai={120}>
            <p className="m-0 text-[length:var(--text-aide)] uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">
              Pour les élèves
            </p>
            <h2 className="mt-4 max-w-[12ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)]">
              On avance mieux ensemble.
            </h2>
            <p className="mt-6 max-w-[44ch]">
              Un devoir à rendre, une question à poser, un chapitre à revoir.
              Tout reste à portée de main.
            </p>
            <p className="mt-6 max-w-[44ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
              La copie personnelle et le brouillon partagé restent deux choses
              distinctes : travailler à plusieurs ne remet jamais un devoir au
              nom des autres.
            </p>
          </Apparition>
        </div>
      </div>
    </section>
  );
}

function Administration() {
  return (
    <section className={`${LARGEUR} py-16 md:py-24`}>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Apparition>
          <p className="m-0 text-[length:var(--text-aide)] uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">
            Pour l&apos;établissement
          </p>
          <h2 className="mt-4 max-w-[15ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)]">
            La rentrée commence avec votre liste de classe.
          </h2>
          <p className="mt-6 max-w-[46ch] text-[color:var(--color-encre-faible)]">
            Importez votre fichier Excel. Vérifiez les classes et préparez les
            accès.
          </p>
          <p className="mt-6 max-w-[46ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Aucun mot de passe n&apos;est demandé dans le fichier, et rien
            n&apos;est créé avant votre confirmation.
          </p>
        </Apparition>

        <Apparition delai={120}>
          <SequenceImport />
        </Apparition>
      </div>
    </section>
  );
}

function Confiance() {
  const points = [
    {
      t: "L'accès va par classe",
      d: "Une séance publiée en Seconde 1 ne s'affiche pas en Seconde 2. Deux classes du même niveau restent indépendantes, même avec le même enseignant.",
    },
    {
      t: "Aucune publicité",
      d: "Pas de publicité, pas de revente de données, pas de profilage, aucun entraînement d'intelligence artificielle. L'établissement finance l'accès.",
    },
    {
      t: "Les comptes sont gérés par le lycée",
      d: "L'établissement crée, suspend et supprime les comptes. Il n'y a pas d'inscription publique d'élève.",
    },
  ];

  return (
    <section className={`${LARGEUR} border-t border-[color:var(--color-bordure)] py-16`}>
      <Apparition>
        <h2 className="max-w-[20ch] text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Ce que nous faisons des données
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {points.map((point) => (
            <div key={point.t}>
              <h3 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                {point.t}
              </h3>
              <p className="mt-3 text-[color:var(--color-encre-faible)]">{point.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8">
          <Link href="/securite" className="text-[color:var(--color-accent)]">
            Comment les accès sont contrôlés →
          </Link>
        </p>
      </Apparition>
    </section>
  );
}

const QUESTIONS = [
  {
    q: "Faut-il un ordinateur par élève ?",
    r: "Non. Le service fonctionne aussi avec le seul poste du professeur : projection propre, support imprimable et travail sur papier. Aucun parcours de classe n'exige un téléphone.",
  },
  {
    q: "Qui finance la plateforme ?",
    r: "L'établissement, par une licence annuelle. Ni les élèves ni les professeurs ne paient quoi que ce soit, et il n'y a aucune option payante à l'intérieur du produit.",
  },
  {
    q: "Comment installer study. dans mon lycée ?",
    r: "Rien à installer sur les postes : study. fonctionne dans le navigateur. La mise en place consiste à importer vos classes depuis un fichier Excel, affecter les enseignants et remettre les accès, classe par classe.",
  },
  {
    q: "Y a-t-il de l'intelligence artificielle ?",
    r: "Non. Pas de chatbot, pas de génération de cours, pas de correction automatique, pas de transcription, pas d'analyse de l'écriture. Les corrections sont écrites par les enseignants.",
  },
  {
    q: "Que devient le travail à la fin de l'année ?",
    r: "Les durées de conservation et les droits d'export sont écrits au contrat, avant la rentrée. Une année terminée peut être archivée en lecture seule sans effacer les copies.",
  },
] as const;

function FaqSection() {
  return (
    <section className={`${LARGEUR} py-16`}>
      <Apparition>
        <p className="m-0 text-[length:var(--text-aide)] uppercase tracking-[0.12em] text-[color:var(--color-encre-faible)]">
          FAQ
        </p>
        <div className="mt-6">
          <Faq questions={QUESTIONS} />
        </div>
      </Apparition>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="bg-[color:var(--color-encre)] py-16 md:py-20">
      <div className={LARGEUR}>
        <Apparition>
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <h2 className="max-w-[16ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)] text-[color:var(--color-surface)]">
              Et si on commençait par votre lycée ?
            </h2>
            <div>
              <Link href="/etablissements" className="bouton bouton-rose">
                Demander une démonstration
                <span aria-hidden="true" className="fleche">→</span>
              </Link>
              <p className="mt-3 m-0 max-w-[34ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-bordure)]">
                Une demande de devis n&apos;est pas une commande : aucun compte
                n&apos;est créé et aucun élève n&apos;est enregistré.
              </p>
            </div>
          </div>
        </Apparition>
      </div>
    </section>
  );
}

export default function Accueil() {
  return (
    <main id="contenu">
      <Hero />
      <div className={LARGEUR}>
        <Situations />
      </div>
      <Enseignants />
      <Eleves />
      <Administration />
      <Confiance />
      <FaqSection />
      <CtaFinal />
    </main>
  );
}

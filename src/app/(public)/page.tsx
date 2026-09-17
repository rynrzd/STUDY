import type { Metadata } from "next";
import Link from "next/link";
import {
  ApercuEleve,
  ApercuEntraide,
  ApercuExcel,
  ApercuMaison,
  ApercuOrdinateur,
  ApercuPapier,
  ApercuProfesseur,
} from "@/components/site/Apercus";
import { AvantApres } from "@/components/site/AvantApres";
import { Faq, Onglets } from "@/components/site/Onglets";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = {
  title: "La classe, tout simplement",
  description:
    "Le cours, les devoirs et l'entraide au même endroit. Une plateforme pédagogique pour les lycées, financée par l'établissement.",
};

/**
 * Landing — cahier « Refonte fidèle », L01 à L09.
 *
 * L'ordre des sections est celui de la référence, et il raconte quelque chose :
 * on montre d'abord l'espace d'un élève, puis les trois situations où il sert,
 * puis le côté professeur, puis ce que le Studio change, puis l'entraide, puis
 * la rentrée. Les questions viennent après — quand la personne sait de quoi on
 * parle.
 *
 * Tout est rendu côté serveur. Les seuls composants clients sont les onglets,
 * la FAQ, l'avant/après et le menu : ni éditeur, ni lecteur PDF, ni moteur
 * d'export ne part dans le paquet public (P01).
 */
export default function PageAccueil() {
  return (
    <>
      {/* -- L02 — Hero ---------------------------------------------------- */}
      <section className="relative z-10 pt-14 pb-0 sm:pt-20">
        <div className="contenu-site grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
          <div>
            <h1 className="m-0 text-[length:var(--text-h1-etroit)] leading-[var(--text-h1-etroit--line-height)] tracking-[-0.03em] min-[390px]:text-[length:var(--text-h1-mobile)] min-[390px]:leading-[var(--text-h1-mobile--line-height)] lg:text-[length:var(--text-h1)] lg:leading-[var(--text-h1--line-height)]">
              La classe.
              <br />
              <span className="surligne surligne-anime">Tout simplement.</span>
            </h1>

            <p className="m-0 mt-6 max-w-[38ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
              Le cours, les devoirs et l&apos;entraide, au même endroit.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link href="#fonctionnement" className="bouton bouton-primaire">
                Découvrir {MARQUE}
                <span aria-hidden="true" className="fleche">→</span>
              </Link>
              <Link
                href="/etablissements"
                className="text-[length:var(--text-corps)] text-[color:var(--color-encre)]"
              >
                Équiper mon lycée
              </Link>
            </div>
          </div>

          {/* L'aperçu descend sur la bande rose : c'est la composition de la
              référence, et elle donne au produit la place qu'il mérite. */}
          <div className="lg:-mb-24">
            <ApercuEleve />
          </div>
        </div>
      </section>

      <div className="bande bande-rose mt-12 sm:mt-16">
        <div className="contenu-site py-9 lg:pb-28">
          <span
            aria-hidden="true"
            className="block h-px w-6 bg-[color:var(--color-accent)]"
          />
          <p className="m-0 mt-3 max-w-[36ch] text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
            Des lycées plus unis,
            <br />
            pour des élèves plus sereins.
          </p>
        </div>
      </div>

      {/* -- L03 — Trois situations ---------------------------------------- */}
      <section id="fonctionnement" className="apparition scroll-mt-24 py-12 sm:py-20">
        <div className="contenu-site">
          <h2 className="m-0 text-[length:var(--text-h2-mobile)] sm:text-center leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
            En cours. À la maison. Toujours la même classe.
          </h2>

          <div className="mt-8">
            <Onglets
              onglets={[
                {
                  cle: "ordinateur",
                  libelle: "Sur ordinateur",
                  texte:
                    "La séance du jour et ses exercices sont accessibles en classe, sur le poste de l'élève comme sur celui du professeur.",
                  apercu: <ApercuOrdinateur />,
                },
                {
                  cle: "papier",
                  libelle: "Sur papier",
                  texte:
                    "Le professeur projette, l'élève écrit sur son cahier. Les documents restent disponibles après le cours : rien ne dépend d'un ordinateur par élève.",
                  apercu: <ApercuPapier />,
                },
                {
                  cle: "maison",
                  libelle: "À la maison",
                  texte:
                    "Le soir, le cours, le devoir et la correction se retrouvent au même endroit — sans chercher dans un cahier de textes ou une pile de photocopies.",
                  apercu: <ApercuMaison />,
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* -- L04 — Côté professeur ----------------------------------------- */}
      <section className="apparition py-12 sm:py-20">
        <div className="contenu-site grid min-w-0 items-center gap-8 sm:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">
              Pour les professeurs
            </p>
            <h2 className="m-0 mt-4 text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
              Votre séance est prête.
              <br />
              Votre classe aussi.
            </h2>
            <p className="m-0 mt-5 max-w-[42ch] text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
              Partagez le cours du jour. Retrouvez les copies et accompagnez
              chaque élève.
            </p>
            <p className="m-0 mt-6">
              <Link href="/produit" className="lien-fleche">
                Voir le côté professeur
                <span aria-hidden="true" className="fleche">→</span>
              </Link>
            </p>
          </div>

          <ApercuProfesseur />
        </div>
      </section>

      {/* -- L05 — Studio --------------------------------------------------- */}
      <section id="studio" className="apparition scroll-mt-24 border-y border-[color:var(--color-bordure)] py-12 sm:py-20">
        <div className="contenu-site grid min-w-0 items-start gap-8 sm:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">
              Le Studio
            </p>
            <h2 className="m-0 mt-4 text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
              Votre cours.
              <br />
              En mieux présenté.
            </h2>
            <p className="m-0 mt-5 max-w-[42ch] text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
              Importez votre PDF ou Word, choisissez la présentation et vérifiez
              avant de publier.
            </p>
            <p className="m-0 mt-6">
              <Link href="/produit#studio" className="lien-fleche">
                Découvrir le Studio
                <span aria-hidden="true" className="fleche">→</span>
              </Link>
            </p>
          </div>

          <AvantApres />
        </div>
      </section>

      {/* -- L06 — Entraide ------------------------------------------------- */}
      <div className="bande bande-rose">
        <section className="contenu-site grid min-w-0 items-center gap-8 py-12 sm:gap-12 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ApercuEntraide />

          <div>
            <h2 className="m-0 text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
              On avance mieux ensemble.
            </h2>
            <p className="m-0 mt-5 max-w-[42ch] text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
              Un devoir à rendre, une question à poser, un chapitre à revoir.
              Tout reste à portée de main.
            </p>
          </div>
        </section>
      </div>

      {/* -- L07 — Rentrée -------------------------------------------------- */}
      <section className="apparition py-12 sm:py-20">
        <div className="contenu-site grid min-w-0 items-center gap-8 sm:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h2 className="m-0 text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
              La rentrée commence avec votre liste de classe.
            </h2>
            <p className="m-0 mt-5 max-w-[42ch] text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
              Importez votre fichier Excel. Vérifiez les classes et préparez les
              accès.
            </p>
          </div>

          <ApercuExcel />
        </div>
      </section>

      {/* -- L08 — Questions ------------------------------------------------ */}
      <section className="apparition py-12 sm:py-20">
        <div className="contenu-site max-w-[760px]">
          <p className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">
            FAQ
          </p>
          <div className="mt-6">
            <Faq
              questions={[
                {
                  question: "Faut-il un ordinateur par élève ?",
                  reponse:
                    "Non. La projection en classe et le travail sur papier sont prévus dès le départ : le cours se consulte ensuite sur n'importe quel appareil, y compris un téléphone.",
                },
                {
                  question: "Qui finance la plateforme ?",
                  reponse:
                    "L'établissement, sur devis. Il n'y a aucun achat par les familles, aucun abonnement élève et aucune publicité.",
                },
                {
                  question: `Comment installer ${MARQUE} dans mon lycée ?`,
                  reponse:
                    "Un échange sur vos besoins, la configuration de votre espace, puis l'import de vos classes à partir de votre fichier de rentrée.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* -- L09 — Appel final ---------------------------------------------- */}
      <div className="bande bande-noire">
        <section className="contenu-site flex flex-wrap items-center justify-between gap-7 py-12 sm:gap-8 sm:py-16">
          <h2 className="m-0 max-w-[16ch] text-[length:var(--text-h2-mobile)] leading-[var(--text-h2-mobile--line-height)] tracking-[-0.02em] text-white sm:text-[length:var(--text-h2-large)] sm:leading-[var(--text-h2-large--line-height)]">
            Et si on commençait par votre lycée ?
          </h2>

          <div>
            <Link href="/etablissements" className="bouton bouton-rose">
              Demander une démonstration
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
            <p className="m-0 mt-3 text-[length:var(--text-aide)] text-white/70">
              Un membre de notre équipe vous recontacte rapidement.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

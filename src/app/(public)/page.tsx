import Link from "next/link";
import type { Metadata } from "next";
import { ApercuProduit } from "@/components/site/ApercuProduit";
import { Parcours } from "@/components/site/Parcours";
import { Reveler } from "@/components/site/Reveler";
import { AppelFinal, Carte, EnteteSection, Section } from "@/components/site/Ui";
import { MARQUE } from "@/lib/identite-legale";

/**
 * Page d'accueil — structure imposée par la section 4 du cahier de finition.
 *
 * Dans l'ordre : navigation (gabarit), héros, preuve produit, usage pendant le
 * cours, trois parcours, rôles, sécurité, offre, appel final, pied de page
 * légal (gabarit).
 *
 * Ce qui est volontairement absent : compteurs d'élèves, logos de lycées,
 * témoignages, badges de certification. Nous n'avons aucun de ces éléments, et
 * un établissement vérifie ce genre d'affirmation.
 */

export const metadata: Metadata = {
  // `absolute` : sans cela, le gabarit du gabarit racine ajouterait une
  // seconde fois la marque au titre de l'accueil.
  title: { absolute: `${MARQUE} — Le travail de la classe, au même endroit` },
  description:
    "Cours, séances, devoirs et entraide, organisés par classe et contrôlés par l'établissement. Licence annuelle sur devis.",
};

const ROLES = [
  {
    titre: "Élève",
    resume: "Ce qu'il a à faire, et où le retrouver.",
    points: [
      "Les séances de ses classes, dans l'ordre du programme",
      "Les devoirs à rendre, avec leur échéance",
      "Ses copies déposées et les corrections reçues",
      "L'entraide de sa classe, modérée par l'établissement",
    ],
  },
  {
    titre: "Enseignant",
    resume: "Ses classes, et rien d'autre.",
    points: [
      "Publier une séance dans les classes où il est affecté",
      "Donner un devoir, suivre les remises, annoter et noter",
      "Réutiliser ses contenus d'une classe à l'autre",
      "Voir qui a demandé de l'aide sur un point précis",
    ],
  },
  {
    titre: "Administrateur d'établissement",
    resume: "Les comptes et le périmètre de chacun.",
    points: [
      "Importer les classes, les élèves et les enseignants",
      "Distribuer des identifiants et des mots de passe temporaires",
      "Affecter les enseignants aux classes et aux groupes",
      "Suspendre un compte et consulter le journal des actions sensibles",
    ],
  },
] as const;

const SECURITE = [
  {
    titre: "Isolation par établissement et par classe",
    texte:
      "Chaque requête est filtrée côté serveur par établissement, et vérifiée une seconde fois par la base elle-même. Deux classes de même niveau restent indépendantes.",
  },
  {
    titre: "Comptes gérés par le lycée",
    texte:
      "L'établissement crée, affecte et suspend les comptes. Un enseignant ne publie que dans les classes auxquelles il est affecté.",
  },
  {
    titre: "Journalisation des actions sensibles",
    texte:
      "Création et suspension de comptes, changements d'affectation, accès d'assistance : chaque action sensible laisse une trace consultable.",
  },
  {
    titre: "Hébergement et sous-traitants identifiés",
    texte:
      "L'application est hébergée par Vercel ; les données, l'authentification et les fichiers sont chez Supabase. Les deux sont nommés dans la page de confidentialité.",
  },
] as const;

export default function PageAccueil() {
  return (
    <main id="contenu">
      {/* ---------------------------------------------------- 2. Héros --- */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="contenu">
          <Reveler className="max-w-[20ch]">
            <h1 className="text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[length:var(--text-h1)] md:leading-[var(--text-h1--line-height)]">
              Le travail de la classe, au même endroit.
            </h1>
          </Reveler>

          <Reveler delai={80}>
            <p className="mt-7 max-w-[54ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
              Cours, séances, devoirs et entraide, organisés par classe et
              contrôlés par l&apos;établissement.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/etablissements" className="bouton bouton-primaire">
                Demander une démonstration
                <span aria-hidden="true" className="fleche">→</span>
              </Link>
              <Link href="#fonctionnement" className="bouton bouton-secondaire">
                Voir le fonctionnement
              </Link>
            </div>
          </Reveler>
        </div>
      </section>

      {/* -------------------------------------------- 3. Preuve produit --- */}
      <section className="pb-20 md:pb-28">
        <div className="contenu">
          <Reveler>
            <ApercuProduit />
          </Reveler>
        </div>
      </section>

      {/* --------------------------------- 4. Usage pendant le cours ----- */}
      <Section fond="doux" id="fonctionnement">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <EnteteSection
            surtitre="Pendant le cours"
            titre="Le cours se fait en classe. AvecStudy le garde."
            chapeau="Le professeur ouvre la séance depuis son poste. Les élèves travaillent sur papier ou sur ordinateur, comme d'habitude. Après le cours, chacun retrouve au même endroit ce qui a été fait et ce qui reste à faire."
          />

          <Reveler className="space-y-6" delai={100}>
            <Etape
              numero="Avant"
              texte="L'enseignant prépare la séance dans sa classe : cours, exercices, documents. Il choisit quand elle devient visible."
            />
            <Etape
              numero="Pendant"
              texte="La séance est ouverte au tableau. Rien ne change dans la façon de faire cours — aucun élève n'a besoin d'un écran pour suivre."
            />
            <Etape
              numero="Après"
              texte="Les élèves retrouvent la séance et le travail à rendre. L'enseignant voit les remises arriver et rend ses corrections."
            />
          </Reveler>
        </div>
      </Section>

      {/* --------------------------------------- 5. Trois parcours ------- */}
      <Section>
        <EnteteSection
          surtitre="Parcours"
          titre="Trois usages, du premier jour à la fin de l'année."
        />
        <Parcours />
      </Section>

      {/* ------------------------------------------------- 6. Rôles ------ */}
      <Section fond="doux">
        <EnteteSection
          surtitre="Rôles"
          titre="Chacun voit ce qui le concerne."
          chapeau="Trois rôles, des périmètres distincts. Ce qui est listé ci-dessous est ce que le produit fait aujourd'hui."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {ROLES.map((role, index) => (
            <Reveler key={role.titre} as="article" delai={index * 90}>
              <div className="carte h-full p-6 md:p-7">
                <h3 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                  {role.titre}
                </h3>
                <p className="mt-2 m-0 text-[color:var(--color-encre-faible)]">{role.resume}</p>
                <ul className="m-0 mt-5 list-none space-y-2.5 p-0">
                  {role.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-2.5 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]"
                    >
                      <span aria-hidden="true" className="mt-[7px] block size-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveler>
          ))}
        </div>
      </Section>

      {/* ------------------------------------ 7. Sécurité et données ----- */}
      <Section>
        <EnteteSection
          surtitre="Sécurité et données"
          titre="Les données scolaires appartiennent à l'établissement."
          chapeau="Le service est conçu pour un lycée : le périmètre de chaque compte est défini par l'établissement et vérifié à chaque accès."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {SECURITE.map((point, index) => (
            <Reveler key={point.titre} delai={index * 70}>
              <Carte titre={point.titre} className="h-full">
                <p>{point.texte}</p>
              </Carte>
            </Reveler>
          ))}
        </div>

        <Reveler delai={120}>
          <Link href="/securite" className="lien-fleche mt-10 inline-flex">
            Le détail des mesures et des sous-traitants
            <span aria-hidden="true" className="fleche">→</span>
          </Link>
        </Reveler>
      </Section>

      {/* ------------------------------------------------- 8. Offre ------ */}
      <Section fond="doux">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <EnteteSection
            surtitre="Offre"
            titre="Licence annuelle, établie sur devis."
            chapeau="AvecStudy se vend à l'établissement, pas à l'élève. Le tarif dépend du nombre d'élèves et de la durée d'engagement : il est établi après un échange, pas affiché à l'avance."
          />

          <Reveler delai={100}>
            <div className="carte p-7 md:p-8">
              <ul className="m-0 list-none space-y-4 p-0">
                <PointOffre>Licence annuelle pour l&apos;établissement</PointOffre>
                <PointOffre>Devis nominatif après un échange sur votre organisation</PointOffre>
                <PointOffre>Aucun paiement en ligne, aucun prélèvement automatique</PointOffre>
                <PointOffre>Aucun achat par les familles, aucune publicité</PointOffre>
              </ul>

              <div className="mt-8 flex flex-wrap gap-3 border-t border-[color:var(--color-bordure)] pt-7">
                <Link href="/etablissements" className="bouton bouton-primaire">
                  Demander un devis
                  <span aria-hidden="true" className="fleche">→</span>
                </Link>
                <Link href="/offre" className="bouton bouton-secondaire">
                  Ce que comprend la licence
                </Link>
              </div>
            </div>
          </Reveler>
        </div>
      </Section>

      {/* -------------------------------------------- 9. Appel final ----- */}
      <AppelFinal />
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Etape({ numero, texte }: { numero: string; texte: string }) {
  return (
    <div className="border-l-2 border-[color:var(--color-accent)] pl-5">
      <p className="surtitre m-0">{numero}</p>
      <p className="mt-2 m-0 text-[color:var(--color-encre-faible)]">{texte}</p>
    </div>
  );
}

function PointOffre({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent-doux)] text-[0.75rem] font-bold text-[color:var(--color-accent)]"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

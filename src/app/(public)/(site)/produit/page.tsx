import type { Metadata } from "next";
import Link from "next/link";
import { pagePublique } from "@/lib/metadonnees";
import { ExempleCours, ExempleEchange, ExemplePublication } from "@/components/site/Exemples";
import { AppelFinal, EnteteSection, Section, TitrePage } from "@/components/site/Ui";

export const metadata: Metadata = pagePublique({
  chemin: "/produit",
  titre: "La plateforme",
  description: "Les cours, le travail et les échanges de la classe : ce que fait Study aujourd'hui, et ce qu'il ne fait pas.",
});

/**
 * P15 — Produit, R2 (cahier §05).
 *
 * Hero court, navigation par thèmes (Cours / Travail / Échanges /
 * Établissement), une section par usage avec un exemple lisible, puis ce que
 * Study ne fait pas et ce qui demande une configuration. Seules les fonctions
 * réellement installées sont décrites.
 */

const THEMES = [
  { id: "cours", libelle: "Cours" },
  { id: "travail", libelle: "Travail" },
  { id: "echanges", libelle: "Échanges" },
  { id: "etablissement", libelle: "Établissement" },
] as const;

function Liste({ entrees }: { entrees: readonly (readonly [string, string])[] }) {
  return (
    <dl className="m-0 grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {entrees.map(([nom, texte]) => (
        <div key={nom} className="border-t border-[color:var(--color-bordure)] pt-4">
          <dt className="text-[1.0625rem] font-extrabold">{nom}</dt>
          <dd className="m-0 mt-1.5 text-[1rem] leading-[1.65] text-[color:var(--color-encre-faible)]">{texte}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PageProduit() {
  return (
    <>
      <TitrePage
        surtitre="La plateforme"
        titre="Le cours, le travail, la classe. Enfin reliés."
        chapeau="Retrouver une séance, comprendre une consigne, poser une question : Study accompagne le travail de la classe, même après la sonnerie."
        actions={
          <>
            <Link href="/contact" className="bouton bouton-primaire bouton-grand">
              Demander une démonstration
            </Link>
            <Link href="/securite" className="bouton bouton-secondaire bouton-grand">
              Sécurité et données
            </Link>
          </>
        }
      />

      <nav aria-label="Thèmes de la page" className="sticky top-16 z-20 border-y border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] md:top-[72px]">
        <ul className="contenu sans-barre m-0 flex list-none gap-2 overflow-x-auto py-2">
          {THEMES.map((t) => (
            <li key={t.id} className="shrink-0">
              <a href={`#${t.id}`} className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-[0.9375rem] font-bold text-[color:var(--color-encre)] no-underline hover:bg-[color:var(--color-rose-clair)]">
                {t.libelle}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="cours">
        <div className="grid items-start gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <EnteteSection surtitre="Cours" titre="Le cours, lisible partout." chapeau="Chaque séance a un titre, un objectif et des blocs : texte, exercice, lien, document, devoir. Elle se lit sur un téléphone comme au tableau." />
          <ExempleCours />
        </div>
        <div className="mt-12">
          <Liste
            entrees={[
              ["Publication par classe", "Une séance publiée en Seconde 1 n'apparaît pas en Seconde 2. Tant qu'elle est en brouillon, aucun élève ne la voit."],
              ["Aperçu élève", "Le professeur voit la séance exactement comme ses élèves avant de la publier."],
              ["Mode projection et impression", "Une vue pour le tableau, et une impression sans navigation ni discussions."],
              ["Recherche", "Dans les cours, fiches et échanges auxquels l'élève a accès — lexicale, et annoncée comme telle."],
            ]}
          />
        </div>
      </Section>

      <Section id="travail" fond="blanc">
        <div className="grid items-start gap-10 lg:grid-cols-[7fr_5fr] lg:gap-14">
          <div className="lg:order-2">
            <EnteteSection surtitre="Travail" titre="Ce qui est à faire, et pour quand." chapeau="Le devoir est rattaché à sa séance : il paraît avec elle et se retire avec elle. La copie se rend en ligne ou sur papier, selon la consigne." />
          </div>
          <div className="lg:order-1">
            <ExemplePublication />
          </div>
        </div>
        <div className="mt-12">
          <Liste
            entrees={[
              ["Remise horodatée", "L'heure retenue est celle du serveur. Un accusé est rendu à l'élève ; ce n'est pas une preuve juridique, et l'écran le dit."],
              ["Nouvelle version sans perte", "Rendre une nouvelle copie n'efface pas l'enregistrement de la précédente."],
              ["Correction", "Un retour individuel et une correction pour la classe, chacun publié quand le professeur le décide."],
              ["Révision", "Rappels, cartes et entraînements tirés des cours ; fiches assemblées à partir des passages du cours."],
            ]}
          />
        </div>
      </Section>

      <Section id="echanges">
        <div className="grid items-center gap-10 rounded-[var(--radius-grand)] bg-[color:var(--color-rose-clair)] p-6 sm:p-10 lg:grid-cols-[5fr_7fr] lg:p-14">
          <EnteteSection surtitre="Échanges" titre="Une classe qui s'entraide, avec son professeur." chapeau="Le salon de la classe réunit élèves et professeur. Les questions sur un cours y restent attachées, et se retrouvent ensuite." />
          <ExempleEchange />
        </div>
        <div className="mt-12">
          <Liste
            entrees={[
              ["Salon collectif", "Élèves et professeur d'une même classe. Pas de conversation privée entre élèves."],
              ["Demander à un adulte", "Une demande séparée du salon. Dans l'application, seuls l'élève qui l'écrit et l'adulte choisi peuvent la lire."],
              ["Signalement et modération", "Rien n'est retiré automatiquement : un responsable de l'établissement décide, avec un motif écrit et conservé."],
              ["Vie de classe", "Propositions, consultations et suivi des décisions, avec les délégués désignés par l'établissement."],
            ]}
          />
        </div>
      </Section>

      <Section id="etablissement" fond="blanc">
        <EnteteSection surtitre="Établissement" titre="Une administration claire." chapeau="Les comptes, les classes et les accès sont gérés par l'établissement, avec un second facteur pour les administrateurs." />
        <div className="mt-10">
          <Liste
            entrees={[
              ["Import de rentrée", "Un fichier .xlsx ou .csv, vérifié ligne par ligne avant confirmation. Réimporter le même fichier ne crée aucun doublon."],
              ["Remise des accès", "Identifiant d'établissement et lien d'activation remis par l'équipe. Aucune adresse e-mail n'est exigée des élèves."],
              ["Récupération d'accès", "La demande arrive à l'administration, qui vérifie l'identité hors de l'application avant de rétablir l'accès."],
              ["Années scolaires", "Préparer l'année suivante, reconduire les classes, puis basculer après contrôle de chaque élève."],
            ]}
          />
        </div>
      </Section>

      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          <article className="carte p-6 md:p-8">
            <h2 className="m-0 text-[1.375rem] font-extrabold">Ce que Study ne fait pas</h2>
            <ul className="m-0 mt-4 grid list-disc gap-2 pl-5 text-[1rem] text-[color:var(--color-encre-faible)]">
              <li>Aucune gestion administrative : ni absences, ni bulletins, ni cantine.</li>
              <li>Aucun classement public entre élèves, aucune série punitive.</li>
              <li>Aucune surveillance : ni vidéo de session, ni mesure d&apos;attention.</li>
              <li>Pas d&apos;intégration ENT, EduConnect ou GAR ; pas de visioconférence.</li>
            </ul>
          </article>
          <article className="carte p-6 md:p-8">
            <h2 className="m-0 text-[1.375rem] font-extrabold">Ce qui demande une configuration</h2>
            <ul className="m-0 mt-4 grid list-disc gap-2 pl-5 text-[1rem] text-[color:var(--color-encre-faible)]">
              <li>Aucun fournisseur d&apos;intelligence artificielle n&apos;est raccordé : les fiches assemblent des passages du cours.</li>
              <li>Aucun envoi d&apos;e-mail : les accès sont remis par l&apos;établissement.</li>
              <li>Pas d&apos;analyse antivirus des fichiers : type, taille et empreinte sont contrôlés, et c&apos;est annoncé.</li>
              <li>Pas de reconnaissance de texte (OCR) : un PDF scanné n&apos;est pas indexé.</li>
            </ul>
          </article>
        </div>
      </Section>

      <AppelFinal />
    </>
  );
}

import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { AppelFinal, Carte, Section, TitrePage } from "@/components/site/Ui";
import { Reveler } from "@/components/site/Reveler";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/produit",
  titre: "Produit",
  description:
    "Séances, devoirs et entraide, dans la continuité de la classe. Ce que fait AvecStudy aujourd'hui, et ce qu'il ne fait pas.",
});

const FAMILLES = [
  {
    titre: "Préparer et publier",
    entrees: [
      ["Bibliothèque privée", "Chaque enseignant prépare ses documents chez lui. Un collègue n'y accède pas."],
      ["Séance structurée", "Titre, objectif, chapitre, date, et cinq types de blocs : texte, exercice, lien, document joint, devoir."],
      ["Publication par classe", "Une séance publiée en Seconde 1 n'apparaît pas en Seconde 2. Elle reste un brouillon invisible tant qu'elle n'est pas publiée."],
      ["Réutilisation", "« Dupliquer vers une autre classe » crée un brouillon indépendant. Modifier la copie ne change pas l'original."],
    ],
  },
  {
    titre: "Animer la séance",
    entrees: [
      ["Mode projection", "Une vue distincte, pensée pour être projetée au tableau."],
      ["Aperçu élève", "Voir la séance exactement comme un élève de la classe la verra, avant de la publier."],
      ["Impression", "Le support s'imprime sans la navigation, sans les boutons et sans les discussions."],
    ],
  },
  {
    titre: "Donner du travail",
    entrees: [
      ["Devoir rattaché à la séance", "Un bloc « devoir » porte un titre, une consigne et une échéance. Il apparaît chez l'élève dans « À faire »."],
      ["Publié avec sa séance", "Un devoir préparé dans un brouillon reste invisible. Il paraît quand le cours paraît, et se retire avec lui."],
      ["Case « fait »", "L'élève coche ce qu'il a terminé. C'est son suivi à lui : personne d'autre ne le voit, et rien n'en est déduit."],
    ],
  },
  {
    titre: "Entraide",
    entrees: [
      ["Questions sur le cours", "Un élève pose une question sur une séance ; ses camarades de la même classe y répondent. Le fil reste dans la classe."],
      ["Groupes de travail", "De deux à six élèves, rattachés à un cours."],
      ["Jamais imprimé", "Les discussions n'apparaissent pas sur le support imprimé : ce qu'on colle dans un cahier, c'est le cours."],
    ],
  },
  {
    titre: "Administrer l'établissement",
    entrees: [
      ["Import de rentrée", "Un fichier .xlsx ou .csv crée les classes manquantes et rattache les élèves — après un récapitulatif et une confirmation. Réimporter le même fichier ne crée aucun doublon."],
      ["Remise des accès", "Identifiant lisible et secret temporaire, sur fiche imprimable. Après la première activation, aucun document ne permet de retrouver le mot de passe."],
      ["Affectation par cours", "Un professeur est rattaché à une classe pour une matière. Il ne voit que les classes où il enseigne."],
      ["Second facteur", "L'exploitant et les administrateurs d'établissement présentent un code à usage unique, en plus de leur mot de passe."],
      ["Journal", "Les actions sensibles sont tracées, avec leur auteur, leur portée et leur motif. Le journal est immuable."],
    ],
  },
] as const;

const ABSENT = [
  ["Aucune intelligence artificielle", "Pas de chatbot, pas de génération de cours, pas de correction intelligente, pas de transcription, pas d'analyse automatique de l'écriture."],
  ["Aucune gestion administrative", "Ni sanctions, ni cantine, ni bulletins officiels, ni absences. AvecStudy est un outil pédagogique."],
  ["Aucun mécanisme d'accrochage", "Pas de fil infini, pas de série quotidienne punitive, pas de classement public entre élèves."],
  ["Aucune surveillance", "Pas d'enregistrement vidéo de session, pas de mesure d'attention. Une ouverture de document ne prouve pas qu'un contenu a été appris."],
] as const;

/**
 * Ce qui n'existe pas aujourd'hui.
 *
 * Écrit au présent de l'absence, sans « bientôt » ni « prévu » : un
 * établissement ne doit pas demander un devis en croyant acheter une fonction
 * qui n'est pas là. Ce qui rejoindra le produit sera écrit plus haut le jour
 * où il fonctionnera — pas le jour où il sera décidé.
 */
const HORS_PREMIERE_LIVRAISON = [
  "Brouillon partagé entre élèves d'un même groupe",
  "Fiches de révision et quiz",
  "Annotations ancrées dans une copie",
  "Grille de notation",
  "Application native (le service fonctionne dans le navigateur)",
  "Intégration officielle ENT, EduConnect ou GAR",
  "Import universel Moodle ou Éléa",
  "Visioconférence",
  "Reconnaissance de texte manuscrit (OCR)",
  "Surveillance d'examens",
] as const;

export default function PageProduit() {
  return (
    <>
      <TitrePage
        surtitre="Produit"
        titre={`Ce que fait ${MARQUE}`}
        chapeau="Le cours, les devoirs et l'entraide, dans la continuité de la classe. Cette page ne décrit que ce qui fonctionne aujourd'hui ; ce qui n'existe pas est dit aussi clairement."
        actions={
          <>
            <Link href="/etablissements" className="bouton bouton-primaire">
              Demander une démonstration
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
            <Link href="/securite" className="bouton bouton-secondaire">
              Sécurité et données
            </Link>
          </>
        }
      />

      {FAMILLES.map((famille, index) => (
        <Section key={famille.titre} fond={index % 2 === 1 ? "doux" : "clair"}>
          <Reveler>
            <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
              {famille.titre}
            </h2>
          </Reveler>
          <dl className="m-0 mt-10 grid gap-5 md:grid-cols-2">
            {famille.entrees.map(([nom, description], rang) => (
              <Reveler key={nom} delai={rang * 60}>
                <div className="carte h-full p-6 md:p-7">
                  <dt className="font-semibold">{nom}</dt>
                  <dd className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
                    {description}
                  </dd>
                </div>
              </Reveler>
            ))}
          </dl>
        </Section>
      ))}

      <Section>
        <Reveler className="max-w-[46ch]">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Ce que {MARQUE} ne fait pas
          </h2>
          <p className="mt-5 text-[color:var(--color-encre-faible)]">
            Ce ne sont pas des manques à combler plus tard. Ce sont des
            décisions.
          </p>
        </Reveler>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {ABSENT.map(([nom, description], rang) => (
            <Reveler key={nom} delai={rang * 60}>
              <Carte titre={nom} className="h-full">
                <p>{description}</p>
              </Carte>
            </Reveler>
          ))}
        </div>
      </Section>

      <Section fond="doux">
        <Reveler className="max-w-[46ch]">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Hors première livraison
          </h2>
          <p className="mt-5 text-[color:var(--color-encre-faible)]">
            Ces éléments ne sont pas inclus. Les annoncer serait vous vendre
            quelque chose qui n&apos;existe pas.
          </p>
        </Reveler>

        <ul className="m-0 mt-8 grid list-none gap-x-10 gap-y-3 p-0 text-[color:var(--color-encre-faible)] md:grid-cols-2">
          {HORS_PREMIERE_LIVRAISON.map((element) => (
            <li key={element} className="flex gap-3 border-t border-[color:var(--color-bordure)] pt-3">
              {element}
            </li>
          ))}
        </ul>
      </Section>

      <AppelFinal />
    </>
  );
}

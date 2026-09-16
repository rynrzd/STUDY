import type { Metadata } from "next";
import Link from "next/link";
import { AppelFinal, Carte, Section, TitrePage } from "@/components/site/Ui";
import { Reveler } from "@/components/site/Reveler";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = {
  title: "Produit",
  description:
    "Séances, devoirs, copies, corrections, entraide et révisions. Ce que fait AvecStudy, " +
    "et ce qu'il ne fait pas.",
  alternates: { canonical: "/produit" },
};

const FAMILLES = [
  {
    titre: "Préparer et publier",
    entrees: [
      ["Bibliothèque privée", "Chaque enseignant prépare ses ressources chez lui. Un collègue n'y accède que si l'auteur partage explicitement."],
      ["Séance structurée", "Titre, objectif, chapitre, durée, blocs de cours, exercices, pièces jointes, corrigé séparé, devoir lié."],
      ["Publication par classe", "La cible est confirmée avant publication, avec le nombre d'élèves concernés. Une séance publiée en Seconde 1 n'apparaît pas en Seconde 2."],
      ["Réutilisation", "« Copier vers une autre classe » crée un brouillon indépendant. Modifier un modèle ne change pas une séance déjà donnée."],
    ],
  },
  {
    titre: "Animer la séance",
    entrees: [
      ["Mode projection", "Une vue distincte qui masque noms, copies, notifications et statistiques individuelles — pour ne jamais projeter un tableau de corrections par accident."],
      ["Papier, ordinateur ou mixte", "Le mode décrit l'organisation de la séance. Il ne change aucune permission."],
      ["Signal « Je bloque »", "L'élève signale un blocage sur un exercice, sans que son nom s'affiche publiquement. Aucune mesure d'attention n'en est déduite."],
      ["Corrigé libéré au bon moment", "Le corrigé ne devient visible qu'après une décision explicite de l'enseignant."],
    ],
  },
  {
    titre: "Devoirs et copies",
    entrees: [
      ["Copie personnelle", "Le brouillon reste privé jusqu'à la remise. L'enseignant voit l'état de travail, pas le contenu non remis."],
      ["Preuve de remise", "Date du serveur, version, fichiers reçus. « Enregistré » et « remis » ne sont jamais confondus."],
      ["Remise papier", "Photo du cahier, ou remise physique cochée par l'enseignant. L'absence de photo n'est pas un échec."],
      ["Correction", "Commentaire général, annotations ancrées, grille facultative. Les élèves ne voient rien tant que le retour n'est pas publié."],
    ],
  },
  {
    titre: "Entraide et révisions",
    entrees: [
      ["Groupes de travail", "De 2 à 6 élèves, liés à un devoir, si l'enseignant autorise l'entraide."],
      ["Brouillon partagé", "Distinct de « Ma copie ». Fermer un groupe ne touche pas la copie personnelle."],
      ["Signalement et modération", "Motif, contexte, décision justifiée et historique. Un modérateur désigné agit dans son périmètre."],
      ["Fiches et quiz", "Flashcards et quiz saisis manuellement. Les bonnes réponses ne partent pas au navigateur avant le moment prévu."],
    ],
  },
  {
    titre: "Administration",
    entrees: [
      ["Import de rentrée", "Un fichier .xlsx ou .csv crée les classes manquantes et rattache les élèves — après un récapitulatif et une confirmation."],
      ["Remise des accès", "Identifiant lisible et secret temporaire, sur fiche imprimable. Après la première activation, aucun document ne permet de retrouver le mot de passe."],
      ["Affectations datées", "Un remplacement a une date de début et de fin. La révocation est automatique."],
      ["Journal", "Les actions sensibles sont tracées, avec leur auteur, leur portée et leur motif."],
    ],
  },
] as const;

const ABSENT = [
  ["Aucune intelligence artificielle", "Pas de chatbot, pas de génération de cours, pas de correction intelligente, pas de transcription, pas d'analyse automatique de l'écriture."],
  ["Aucune gestion administrative", "Ni sanctions, ni cantine, ni bulletins officiels, ni absences. AvecStudy est un outil pédagogique."],
  ["Aucun mécanisme d'accrochage", "Pas de fil infini, pas de série quotidienne punitive, pas de classement public entre élèves."],
  ["Aucune surveillance", "Pas d'enregistrement vidéo de session, pas de mesure d'attention. Une ouverture de document ne prouve pas qu'un contenu a été appris."],
] as const;

const HORS_PREMIERE_LIVRAISON = [
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
        chapeau="Le cours, les devoirs et l'entraide, dans la continuité de la classe. Le reste est dit aussi clairement : ce qui n'existe pas, et ce qui n'est pas prévu pour la première livraison."
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

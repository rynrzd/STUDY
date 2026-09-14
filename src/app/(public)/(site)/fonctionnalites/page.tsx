import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Carte } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description:
    "Séances, devoirs, copies, corrections, entraide et révisions. Ce que fait study., " +
    "et ce qu'il ne fait pas.",
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
      ["Remise des accès", "Identifiant lisible et secret temporaire, sur fiche imprimable. Après la première activation, aucun PDF ne permet de retrouver le mot de passe."],
      ["Affectations datées", "Un remplacement a une date de début et de fin. La révocation est automatique."],
      ["Journal", "Les actions sensibles sont tracées, avec leur auteur, leur portée et leur motif."],
    ],
  },
] as const;

const ABSENT = [
  ["Aucune intelligence artificielle", "Pas de chatbot, pas de génération de cours, pas de correction intelligente, pas de transcription, pas d'analyse automatique de l'écriture."],
  ["Aucune gestion administrative", "Ni sanctions, ni cantine, ni bulletins officiels, ni absences. study. est un outil pédagogique."],
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

export default function Fonctionnalites() {
  return (
    <>
      <TitrePage
        surtitre="Fonctionnalités"
        titre="Ce que fait study."
        chapeau="Le cours, les devoirs et l'entraide, dans la continuité de la classe. Le reste est dit aussi clairement : ce qui n'existe pas, et ce qui n'est pas prévu pour la première livraison."
      />

      {FAMILLES.map((famille) => (
        <section key={famille.titre} className="border-t border-[color:var(--color-bordure)] py-12">
          <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
            {famille.titre}
          </h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {famille.entrees.map(([nom, description]) => (
              <div
                key={nom}
                className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6"
              >
                <dt className="font-semibold">{nom}</dt>
                <dd className="mt-2 ml-0 text-[color:var(--color-encre-faible)]">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Ce que study. ne fait pas
        </h2>
        <p className="mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Ce ne sont pas des manques à combler plus tard. Ce sont des décisions.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {ABSENT.map(([nom, description]) => (
            <Carte key={nom} titre={nom}>
              <p className="m-0 text-[color:var(--color-encre-faible)]">{description}</p>
            </Carte>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Hors première livraison
        </h2>
        <p className="mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Ces éléments ne sont pas inclus. Les annoncer serait vous vendre
          quelque chose qui n&apos;existe pas.
        </p>
        <ul className="mt-6 list-none space-y-2 p-0 text-[color:var(--color-encre-faible)]">
          {HORS_PREMIERE_LIVRAISON.map((element) => (
            <li key={element} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-[color:var(--color-bordure)]" />
              {element}
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href="/etablissements" className="text-[color:var(--color-accent)]">
            Parler de vos classes avec nous
          </Link>
        </p>
      </section>
    </>
  );
}

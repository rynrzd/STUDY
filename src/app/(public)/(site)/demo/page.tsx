import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, BandeauIndisponible, Carte } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Démonstration",
  description:
    "Trois parcours guidés sur des données fictives : élève, professeur, administration.",
  // La démonstration ne doit pas exposer de données scolaires à l'indexation
  // (ch. 05), et elle n'a aucune valeur de référencement.
  robots: { index: false, follow: false },
};

/**
 * /demo — ch. 05.
 *
 * L'espace de démonstration n'existe pas encore. Cette page décrit ce qu'il
 * sera et dit qu'il n'est pas disponible, plutôt que d'ouvrir un parcours
 * partiel qui laisserait croire à un produit terminé. Un aperçu n'est jamais
 * présenté comme une période d'essai opérationnelle.
 */

const PARCOURS = [
  {
    role: "Professeur",
    titre: "Publier une séance en Seconde 1",
    etapes: [
      "Préparer une séance dans la bibliothèque",
      "Choisir la classe cible et confirmer",
      "Constater qu'elle n'apparaît pas en Seconde 2",
    ],
  },
  {
    role: "Élève",
    titre: "Retrouver le cours et rendre une réponse",
    etapes: [
      "Ouvrir la séance publiée à sa classe",
      "Écrire une réponse dans sa copie",
      "Remettre, et voir la preuve de remise",
    ],
  },
  {
    role: "Administration",
    titre: "Découvrir l'import de classes",
    etapes: [
      "Déposer un fichier d'exemple",
      "Lire le récapitulatif avant création",
      "Voir les accès préparés, classe par classe",
    ],
  },
] as const;

export default function Demo() {
  return (
    <>
      <TitrePage
        surtitre="Démonstration"
        titre="Voir study. sans engager votre lycée."
        chapeau="Un espace isolé, avec des données entièrement fictives et trois parcours guidés. Aucune connexion à une base réelle, aucun fichier d'un vrai établissement."
      />

      <div className="pb-12">
        <BandeauIndisponible
          quoi="La démonstration n'est pas encore ouverte."
          bloquePar="le parcours pédagogique (séance, copie, correction) est en cours de construction. Ouvrir une démonstration partielle donnerait une idée fausse du produit."
        />
      </div>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Les trois parcours prévus
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {PARCOURS.map((parcours) => (
            <Carte key={parcours.role}>
              <p className="m-0 text-[length:var(--text-aide)] uppercase tracking-wide text-[color:var(--color-encre-faible)]">
                {parcours.role}
              </p>
              <h3 className="mt-2 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                {parcours.titre}
              </h3>
              <ol className="mt-4 space-y-2 pl-5 text-[color:var(--color-encre-faible)]">
                {parcours.etapes.map((etape) => (
                  <li key={etape}>{etape}</li>
                ))}
              </ol>
            </Carte>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Les limites seront affichées
        </h2>
        <div className="mt-6 max-w-[62ch] space-y-4 text-[color:var(--color-encre-faible)]">
          <p>
            Tout ce qui est modifié dans la démonstration reste dans un bac à
            sable éphémère. Le rôle « administration » de la démonstration
            n&apos;a aucun pouvoir réel : il montre les écrans, il ne crée aucun
            compte.
          </p>
          <p>
            La démonstration n&apos;est pas une période d&apos;essai. Elle ne
            permet pas d&apos;importer vos élèves, et elle ne deviendra pas
            l&apos;espace de votre établissement.
          </p>
        </div>
        <p className="mt-8">
          <Link href="/etablissements" className="text-[color:var(--color-accent)]">
            Demander un devis pour votre établissement
          </Link>
        </p>
      </section>
    </>
  );
}

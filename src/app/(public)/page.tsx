import Link from "next/link";
import type { Metadata } from "next";
import { ApercuStudio } from "@/components/site/ApercuStudio";
import { Journee } from "@/components/site/Journee";
import { Reveler } from "@/components/site/Reveler";
import { EnteteSection, Section } from "@/components/site/Ui";
import { MARQUE } from "@/lib/identite-legale";

/**
 * Page d'accueil — cahier V2, section 4.
 *
 * Dans l'ordre : héros avec l'aperçu réel du Studio, une journée avec
 * AvecStudy, le Studio en détail, puis les trois publics — professeurs,
 * élèves, établissement — la sécurité, et l'appel final.
 *
 * Ce qui n'y figure pas, volontairement : aucun prix, aucun formulaire
 * commercial dans le héros, aucun compteur d'élèves, aucun logo de lycée,
 * aucun témoignage. Nous n'avons rien de tout cela, et un établissement
 * vérifie.
 */

export const metadata: Metadata = {
  title: { absolute: `${MARQUE} — Le cours d'aujourd'hui, à sa place` },
  description:
    "Séances, documents, devoirs et classe au même endroit. Le professeur prépare sa séance " +
    "dans le Studio ; l'élève retrouve le cours et le travail à faire, sans rien chercher.",
};

const PROFESSEURS = [
  ["Préparer sans y passer la soirée", "Un chapitre, une séance, des blocs. Le texte, la fiche, le devoir : tout tient dans le même écran, et s'enregistre tout seul."],
  ["Publier quand c'est prêt", "Une séance est un brouillon tant que vous ne l'avez pas publiée. Vous la prévisualisez du point de vue de l'élève avant de décider."],
  ["Retrouver l'année", "Les séances restent rangées par chapitre. Reprendre le cours de l'an dernier ne demande pas de fouiller dans un disque partagé."],
] as const;

const ELEVES = [
  ["Savoir ce qu'il y a aujourd'hui", "La séance du jour est la première chose visible. Pas de fil à remonter, pas de dossier à ouvrir."],
  ["Savoir ce qui est à faire", "Les devoirs sont classés par échéance, avec la séance d'où ils viennent. Rien n'est caché derrière un onglet."],
  ["Retrouver un cours manqué", "Absent mardi ? La séance, ses documents et son devoir sont à leur place, dans le chapitre, à la bonne date."],
] as const;

const ETABLISSEMENT = [
  ["Des comptes créés par le lycée", "Aucune inscription libre. L'administration crée les comptes, affecte les professeurs à leurs classes, et coupe un accès quand il le faut."],
  ["Une rentrée qui tient en un fichier", "L'import crée les classes et les élèves depuis votre export, avec un aperçu avant écriture et des identifiants imprimables."],
  ["Des classes réellement séparées", "Deux Secondes du même professeur ne se mélangent pas. Un élève ne voit que ses classes, et la base le vérifie à chaque requête."],
] as const;

export default function PageAccueil() {
  return (
    <main id="contenu">
      {/* ------------------------------------------------------ Héros ---- */}
      <section className="pt-14 pb-16 md:pt-20 md:pb-20">
        <div className="contenu">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <Reveler>
                <h1 className="max-w-[16ch] text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[length:var(--text-h1)] md:leading-[var(--text-h1--line-height)]">
                  Le cours d&apos;aujourd&apos;hui,{" "}
                  <span className="surligne surligne-anime">à sa place</span>.
                </h1>
              </Reveler>

              <Reveler delai={90}>
                <p className="mt-6 max-w-[46ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
                  Séances, documents, devoirs et classe au même endroit. Le
                  professeur prépare dans le Studio ; l&apos;élève retrouve le
                  cours et le travail à faire, sans rien chercher.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="#decouvrir" className="bouton bouton-rose">
                    Découvrir AvecStudy
                    <span aria-hidden="true" className="fleche">→</span>
                  </Link>
                  <Link href="#fonctionnement" className="bouton bouton-secondaire">
                    Voir comment ça fonctionne
                  </Link>
                </div>
              </Reveler>
            </div>

            <Reveler delai={160}>
              <ApercuStudio />
            </Reveler>
          </div>
        </div>
      </section>

      {/* ------------------------------------ Une journée avec AvecStudy -- */}
      <Section fond="doux" id="fonctionnement">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-20">
          <EnteteSection
            surtitre="Fonctionnement"
            titre="Une journée avec AvecStudy"
            chapeau="Le produit suit le déroulement réel d'un cours, de la préparation du matin au travail du soir. Rien d'autre."
          />

          <Reveler delai={80}>
            <Journee />
          </Reveler>
        </div>
      </Section>

      {/* --------------------------------------------------- Le Studio --- */}
      <Section id="decouvrir">
        <EnteteSection
          surtitre="Le Studio"
          titre="Préparer une séance prend quelques minutes."
          chapeau="Un cours, ses chapitres, ses séances. On ouvre une séance, on empile des blocs — du texte, un document, un lien, un exercice, un devoir — et on publie."
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
          <Reveler>
            <ApercuStudio anime={false} />
          </Reveler>

          <Reveler delai={90}>
            <dl className="m-0 space-y-6 p-0">
              <Detail terme="Des blocs, pas un traitement de texte">
                Texte, document, lien, exercice, devoir. Cinq blocs qui
                couvrent ce qu&apos;on met réellement dans une séance, et qu&apos;on
                réordonne à la souris.
              </Detail>
              <Detail terme="Brouillon par défaut">
                Une séance n&apos;est jamais visible tant qu&apos;elle n&apos;est pas
                publiée. Vous pouvez la reprendre après publication ; la classe
                voit la date de dernière modification.
              </Detail>
              <Detail terme="Publiée à une classe, et à une seule">
                Publier en Première 3 ne publie pas en Première 5. Le
                cloisonnement n&apos;est pas un réglage d&apos;affichage : il est
                vérifié par la base de données.
              </Detail>
              <Detail terme="Le devoir naît dans la séance">
                Ajouté au cours, il apparaît tout de suite dans « À faire » chez
                l&apos;élève, avec son échéance et le lien vers la séance
                d&apos;origine.
              </Detail>
            </dl>
          </Reveler>
        </div>
      </Section>

      {/* ------------------------------------------------- Professeurs --- */}
      <Section fond="doux" id="professeurs">
        <EnteteSection surtitre="Professeurs" titre="Le temps passé dessus doit être court." />
        <Trois entrees={PROFESSEURS} />
      </Section>

      {/* ------------------------------------------------------ Élèves --- */}
      <Section id="eleves">
        <EnteteSection surtitre="Élèves" titre="Ouvrir, et savoir." />
        <Trois entrees={ELEVES} />
      </Section>

      {/* ---------------------------------------------- Établissements --- */}
      <Section fond="doux" id="etablissements">
        <EnteteSection
          surtitre="Établissements"
          titre="Vous gardez la main sur les comptes."
          chapeau="AvecStudy se souscrit par le lycée, pour le lycée. Les élèves et les professeurs ne paient jamais et n'ont rien à acheter."
        />
        <Trois entrees={ETABLISSEMENT} />

        <Reveler delai={200}>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/etablissements" className="bouton bouton-rose">
              Demander une démonstration
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
            <Link href="/offre" className="bouton bouton-secondaire">
              Voir l&apos;offre
            </Link>
          </div>
        </Reveler>
      </Section>

      {/* ---------------------------------------------------- Sécurité --- */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
          <EnteteSection
            surtitre="Sécurité et données"
            titre="Les copies des élèves ne sont pas une donnée comme une autre."
          />

          <Reveler delai={80}>
            <dl className="m-0 space-y-6 p-0">
              <Detail terme="Séparation vérifiée à chaque requête">
                Changer un identifiant dans l&apos;adresse ne donne accès à rien :
                l&apos;autorisation est recalculée au plus près de la donnée, pas
                dans le menu.
              </Detail>
              <Detail terme="Documents privés">
                Aucun fichier scolaire n&apos;est déposé dans un espace public. Les
                accès sont signés et limités dans le temps.
              </Detail>
              <Detail terme="Actions sensibles tracées">
                Création et suspension de comptes, changements d&apos;affectation :
                chaque action laisse une trace consultable, que personne ne peut
                effacer.
              </Detail>
              <Detail terme="Aucune intelligence artificielle">
                Pas de chatbot, pas de correction automatique, aucun
                entraînement sur les travaux des élèves. Ce n&apos;est pas un
                manque à combler : c&apos;est une décision.
              </Detail>
            </dl>

            <Link href="/securite" className="lien-fleche mt-8 inline-flex">
              Le détail des mesures et des sous-traitants
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
          </Reveler>
        </div>
      </Section>

      {/* ------------------------------------------------ Appel final ---- */}
      <Section fond="doux">
        <Reveler className="mx-auto max-w-[56ch] text-center">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Voir {MARQUE} sur vos classes
          </h2>
          <p className="mt-5 text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
            Une démonstration de trente minutes sur votre organisation réelle :
            vos niveaux, vos matières, vos groupes. Nous établissons ensuite un
            devis.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/etablissements" className="bouton bouton-rose">
              Demander une démonstration
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
            <Link href="/connexion" className="bouton bouton-secondaire">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </Reveler>
      </Section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Trois({ entrees }: { entrees: readonly (readonly [string, string])[] }) {
  return (
    <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
      {entrees.map(([titre, texte], index) => (
        <Reveler key={titre} delai={index * 80}>
          {/* Peu de cartes et peu de bordures (cahier V2, §3) : un simple
              filet rose en tête suffit à séparer les trois colonnes. */}
          <div className="border-t-2 border-[color:var(--color-rose-decor)] pt-5">
            <h3 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              {titre}
            </h3>
            <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">{texte}</p>
          </div>
        </Reveler>
      ))}
    </div>
  );
}

function Detail({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[color:var(--color-rose-decor)] pl-5">
      <dt className="font-semibold">{terme}</dt>
      <dd className="m-0 mt-1.5 text-[color:var(--color-encre-faible)]">{children}</dd>
    </div>
  );
}

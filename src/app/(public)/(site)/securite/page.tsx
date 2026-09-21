import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Reveler } from "@/components/site/Reveler";
import { AppelFinal, Carte, Prose, Section, TitrePage } from "@/components/site/Ui";
import { CONSERVATION, IDENTITE, MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/securite",
  titre: "Sécurité et données",
  description:
    "Isolation par établissement et par classe, comptes gérés par le lycée, journalisation des actions sensibles, hébergement et sous-traitants identifiés.",
});

/**
 * /securite.
 *
 * Cette page n'affiche jamais « certifié RGPD », « agréé Éducation nationale »
 * ni « 100 % sécurisé ». Elle décrit des mécanismes vérifiables, et elle nomme
 * ses limites. Une page sécurité qui ne dit que du bien n'informe personne — et
 * un responsable de lycée le sait.
 */

const MECANISMES = [
  [
    "Cloisonnement par établissement",
    "Chaque objet scolaire porte l'identifiant de son établissement, et les liaisons entre objets passent par des clés composites : le moteur de base de données refuse de relier une classe d'un lycée à un devoir d'un autre.",
  ],
  [
    "Accès par classe",
    "Une séance publiée en Seconde 1 n'est lisible que par les élèves inscrits dans cette classe, à la date du jour. Connaître l'adresse d'une page ne donne aucun droit.",
  ],
  [
    "Refus par défaut",
    "Sans identité vérifiée, aucune donnée scolaire n'est lisible. Les autorisations sont accordées explicitement, jamais déduites d'un rôle envoyé par le navigateur.",
  ],
  [
    "Révocation immédiate",
    "Suspendre un compte ou retirer une affectation coupe l'accès dès la requête suivante, côté serveur — pas seulement dans les menus.",
  ],
  [
    "Copies non réécrivables",
    "Une copie remise est immuable : elle ne peut être ni modifiée ni supprimée. Une nouvelle remise crée une nouvelle version, sans effacer la précédente.",
  ],
  [
    "Corrigés séparés",
    "Corrigés de séance et bonnes réponses de quiz vivent dans des tables distinctes, pour qu'ils ne puissent pas partir au navigateur avec le reste du cours.",
  ],
  [
    "Sessions opaques",
    "Le cookie de session ne contient aucune information : c'est une valeur aléatoire. Seule son empreinte est conservée en base, et une session se révoque côté serveur.",
  ],
  [
    "Journalisation des actions sensibles",
    "Création et suspension de comptes, changements d'affectation, accès d'assistance : chaque action sensible est tracée avec son auteur, sa portée et son motif.",
  ],
] as const;

const LIMITES = [
  [
    "Aucune certification",
    `${MARQUE} ne dispose d'aucun agrément ni d'aucune certification de sécurité. Nous décrivons des mécanismes, nous ne revendiquons pas de label.`,
  ],
  [
    "Aucun audit indépendant à ce jour",
    "Le code et la configuration n'ont pas été revus par un tiers. Un établissement qui souhaite faire auditer le service avant déploiement peut nous le demander.",
  ],
  [
    "Second facteur limité aux administrateurs",
    "L'authentification à deux facteurs est prévue pour les comptes d'administration. Elle n'est pas imposée aux élèves : leur compte est créé et révocable par l'établissement.",
  ],
  [
    "Accès technique d'exploitation",
    "Comme chez tout hébergeur, un accès technique à l'infrastructure reste possible en cas d'incident. Il suit une procédure tracée. Prétendre qu'il est techniquement impossible serait faux.",
  ],
] as const;

export default function PageSecurite() {
  return (
    <>
      <TitrePage
        surtitre="Sécurité et données"
        titre="Ce qui protège les données de vos élèves."
        chapeau="Cette page décrit des mécanismes vérifiables et nomme ses limites. Elle ne revendique aucune certification."
      />

      <Section>
        <Reveler>
          <div className="carte p-7 md:p-8">
            <p className="surtitre m-0">Le point qui compte le plus</p>
            <p className="mt-4 m-0 max-w-[62ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)]">
              Le chiffrement du transport n&apos;empêche pas un élève de lire la
              copie d&apos;un autre si l&apos;autorisation est mal faite.
              C&apos;est l&apos;autorisation, vérifiée à chaque requête au plus
              près de la donnée, qui protège réellement les travaux. Le reste
              vient après.
            </p>
          </div>
        </Reveler>
      </Section>

      <Section fond="doux">
        <Reveler className="max-w-[46ch]">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Mécanismes en place
          </h2>
          <p className="mt-5 text-[color:var(--color-encre-faible)]">
            Ces garanties sont implémentées dans la base de données elle-même et
            couvertes par des tests automatisés exécutés sur le schéma réel, à
            chaque modification.
          </p>
        </Reveler>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {MECANISMES.map(([titre, description], index) => (
            <Reveler key={titre} delai={(index % 2) * 70}>
              <Carte titre={titre} className="h-full">
                <p>{description}</p>
              </Carte>
            </Reveler>
          ))}
        </div>
      </Section>

      <Section>
        <Reveler className="max-w-[46ch]">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Limites, dites franchement
          </h2>
          <p className="mt-5 text-[color:var(--color-encre-faible)]">
            Ce qu&apos;un responsable d&apos;établissement doit savoir avant de
            signer.
          </p>
        </Reveler>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {LIMITES.map(([titre, description], index) => (
            <Reveler key={titre} delai={(index % 2) * 70}>
              <Carte titre={titre} className="h-full">
                <p>{description}</p>
              </Carte>
            </Reveler>
          ))}
        </div>
      </Section>

      <Section fond="doux">
        <Reveler className="max-w-[46ch]">
          <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Hébergement et sous-traitants
          </h2>
        </Reveler>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">Sous-traitants et données confiées</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Sous-traitant</th>
                <th scope="col" className="p-3 font-semibold">Rôle</th>
                <th scope="col" className="p-3 font-semibold">Données concernées</th>
              </tr>
            </thead>
            <tbody>
              {IDENTITE.sousTraitants.map((sousTraitant) => (
                <tr key={sousTraitant.nom} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{sousTraitant.nom}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{sousTraitant.role}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{sousTraitant.donnees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 overflow-x-auto">
          <h3 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
            Durées de conservation
          </h3>
          <table className="mt-5 w-full min-w-[40rem] border-collapse text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
            <caption className="sr-only">Durées de conservation par catégorie de données</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Données</th>
                <th scope="col" className="p-3 font-semibold">Durée</th>
                <th scope="col" className="p-3 font-semibold">Précision</th>
              </tr>
            </thead>
            <tbody>
              {CONSERVATION.map((ligne) => (
                <tr key={ligne.donnees} className="border-b border-[color:var(--color-bordure)]">
                  <th scope="row" className="p-3 text-left font-normal">{ligne.donnees}</th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.duree}</td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">{ligne.precision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <Prose>
          <h2>Ce que l&apos;administration du lycée peut voir</h2>
          <p>
            Un administrateur gère les comptes, les classes et les affectations.
            Il ne lit ni les copies, ni les notes personnelles, ni les
            discussions d&apos;entraide. Le détail de l&apos;activité
            pédagogique d&apos;un élève n&apos;est pas un outil de surveillance à
            la disposition de l&apos;administration.
          </p>
          <p>
            Le volet facturation demande une permission dédiée : un
            administrateur ne le voit pas par défaut, et un gestionnaire de
            facturation n&apos;a aucun accès aux contenus pédagogiques.
          </p>

          <h2>Ce que notre équipe peut voir</h2>
          <p>
            Aucun accès permanent aux données d&apos;un établissement. Une
            intervention d&apos;assistance exige un motif écrit, l&apos;accord
            d&apos;un administrateur du lycée, une portée limitée, une expiration
            et une trace. L&apos;usurpation silencieuse d&apos;un compte
            n&apos;existe pas : cette interdiction est vérifiée par un test qui
            échoue si quelqu&apos;un ouvre un accès aux copies des élèves.
          </p>

          <h2>Signaler une faille</h2>
          <p>
            Si vous pensez avoir trouvé un défaut de sécurité, écrivez-nous
            plutôt que de le rendre public, depuis la page{" "}
            <Link href="/contact">contact</Link>. Nous accusons réception et
            nous vous tenons informé du correctif.
          </p>
        </Prose>
      </Section>

      <AppelFinal
        titre="Faire examiner le service par votre DPO"
        chapeau="Nous fournissons le détail des traitements, les durées de conservation et la liste des sous-traitants sur demande, avant toute signature."
      />
    </>
  );
}

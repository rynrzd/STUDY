import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage, Prose, Carte } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Sécurité",
  description:
    "Comment les accès sont contrôlés, ce qui est en place et ce qui ne l'est pas encore.",
};

/**
 * /securite — ch. 04 et ch. 23 à 27.
 *
 * Cette page n'affiche jamais « certifié RGPD », « agréé Éducation nationale »
 * ni « 100 % sécurisé ». Elle décrit des mécanismes, leur état réel, et ce qui
 * manque. Une page sécurité qui ne dit que du bien n'informe personne.
 */

const EN_PLACE = [
  ["Cloisonnement par établissement", "Chaque objet scolaire porte l'identifiant de son établissement, et les liaisons entre objets passent par des clés composites : le moteur de base de données refuse de relier une classe d'un lycée à un devoir d'un autre."],
  ["Accès par classe", "Une séance publiée en Seconde 1 n'est lisible que par les élèves inscrits dans cette classe, à la date du jour. Connaître l'adresse d'une page ne donne aucun droit."],
  ["Refus par défaut", "Sans identité vérifiée, aucune donnée scolaire n'est lisible. Les autorisations sont accordées explicitement, jamais déduites d'un rôle envoyé par le navigateur."],
  ["Révocation immédiate", "Suspendre un compte ou retirer une affectation coupe l'accès dès la requête suivante, côté serveur — pas seulement dans les menus."],
  ["Copies non réécrivables", "Une copie remise est immuable : elle ne peut être ni modifiée ni supprimée. Une nouvelle remise crée une nouvelle version, sans effacer la précédente."],
  ["Corrigés séparés", "Corrigés de séance et bonnes réponses de quiz vivent dans des tables distinctes, pour qu'ils ne puissent pas partir au navigateur avec le reste du cours."],
] as const;

const PAS_ENCORE = [
  "La connexion n'est pas opérationnelle : le fournisseur d'identité n'est pas raccordé.",
  "L'authentification à deux facteurs n'est pas implémentée.",
  "Le dépôt de fichiers, l'analyse antivirus et la mise en quarantaine n'existent pas.",
  "Aucune limitation de débit n'est en place.",
  "Aucune sauvegarde n'a été effectuée, et aucune restauration n'a été exercée.",
  "Aucune revue de sécurité indépendante n'a eu lieu.",
] as const;

export default function Securite() {
  return (
    <>
      <TitrePage
        surtitre="Sécurité"
        titre="Ce qui protège les copies de vos élèves."
        chapeau="Cette page décrit des mécanismes vérifiables et l'état réel de leur mise en œuvre. Elle ne revendique aucune certification : study. n'en a aucune."
      />

      <section className="pb-12">
        <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
          <p className="m-0 font-semibold">Le point qui compte le plus</p>
          <p className="mt-3 m-0 max-w-[62ch] text-[color:var(--color-encre-faible)]">
            Le chiffrement du transport (HTTPS) n&apos;empêche pas un élève de
            lire la copie d&apos;un autre si l&apos;autorisation est mal faite.
            C&apos;est l&apos;autorisation, vérifiée à chaque requête au plus
            près de la donnée, qui protège réellement les travaux. Le reste vient
            après.
          </p>
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          En place et vérifié par des tests
        </h2>
        <p className="mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          Ces garanties sont implémentées dans la base de données et couvertes
          par des tests automatisés qui s&apos;exécutent sur le schéma réel.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {EN_PLACE.map(([titre, description]) => (
            <Carte key={titre} titre={titre}>
              <p className="m-0 text-[color:var(--color-encre-faible)]">{description}</p>
            </Carte>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
        <h2 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Pas encore en place
        </h2>
        <p className="mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
          study. est en construction. Tant que ces points ne sont pas traités,
          aucun élève réel ne doit être enregistré.
        </p>
        <ul className="mt-6 max-w-[62ch] list-none space-y-3 p-0">
          {PAS_ENCORE.map((element) => (
            <li key={element} className="flex gap-3 text-[color:var(--color-encre-faible)]">
              <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-[color:var(--color-erreur)]" />
              {element}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[color:var(--color-bordure)] py-12">
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
            n&apos;existe pas.
          </p>
          <p>
            Les accès techniques exceptionnels à l&apos;infrastructure restent
            possibles, comme chez tout hébergeur : ils suivent une procédure
            d&apos;incident tracée. Prétendre qu&apos;ils sont techniquement
            impossibles serait faux.
          </p>

          <h2>Signaler une faille</h2>
          <p>
            Si vous pensez avoir trouvé un défaut de sécurité, écrivez-nous
            plutôt que de le rendre public. Le canal de signalement sera précisé
            sur la page <Link href="/contact" className="text-[color:var(--color-accent)]">contact</Link>{" "}
            dès que l&apos;identité contractuelle de l&apos;éditeur sera arrêtée.
          </p>
        </Prose>
      </section>
    </>
  );
}

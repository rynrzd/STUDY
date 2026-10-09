import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import { FormulaireDemande } from "@/components/site/FormulaireDemande";
import { EnteteSection, Section, TitrePage } from "@/components/site/Ui";
import { jetonOuverture } from "@/lib/demande-commerciale";

export const metadata: Metadata = pagePublique({
  chemin: "/etablissements",
  titre: "Pour les établissements",
  description: "Équiper votre lycée : mise en place, accès, responsabilités, et demande de démonstration ou de devis. Aucun fichier d'élèves n'est demandé à cette étape.",
});

/**
 * P16 — Établissements, R2 (cahier §05).
 *
 * Bénéfices pour l'organisation, mise en place en étapes, responsabilités de
 * chacun, puis le formulaire existant (même service que /contact). La page
 * est rendue à chaque requête : elle émet un jeton d'ouverture daté.
 */
export const dynamic = "force-dynamic";

const ETAPES = [
  ["Un échange", "Nous comprenons vos niveaux, vos matières et votre équipement."],
  ["Un devis", "Chiffré sur l'effectif couvert. Une demande n'est pas une commande."],
  ["L'espace de l'établissement", "Après commande, il est créé et son premier administrateur reçoit ses accès."],
  ["L'import de rentrée", "Le fichier des classes est vérifié ligne par ligne, puis les identifiants sont préparés à distribuer."],
] as const;

export default function PageEtablissements() {
  // Sans secret de session, le formulaire refusera la soumission : l'action
  // serveur le dit franchement plutôt que d'accepter une demande perdue.
  const secret = process.env.SESSION_ENCRYPTION_KEY ?? "";
  const ouverture = secret === "" ? "" : jetonOuverture(secret);

  return (
    <>
      <TitrePage
        surtitre="Pour les établissements"
        titre="Un espace commun. Chaque classe à sa place."
        chapeau="Rassemblez les cours et les échanges dans un espace géré par vos équipes. Préparons une mise en place adaptée à vos classes et à votre organisation."
        actions={
          <a href="#demande" className="bouton bouton-primaire bouton-grand">
            Demander une démonstration
          </a>
        }
      />

      <Section>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {[
            ["Une seule adresse pour la classe", "Séances, devoirs, documents et échanges, publiés par classe, lisibles sur tout appareil."],
            ["Des accès que vous maîtrisez", "Identifiants d'établissement, activation remise par vos équipes, second facteur pour les administrateurs."],
            ["Aucun coût pour les familles", "Financé par l'établissement, sur devis : ni abonnement élève, ni publicité."],
          ].map(([titre, texte]) => (
            <article key={titre} className="carte p-6 md:p-7">
              <h2 className="m-0 text-[1.25rem] font-extrabold">{titre}</h2>
              <p className="m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)]">{texte}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section fond="doux">
        <EnteteSection surtitre="Mise en place" titre="Quatre étapes, dans l'ordre." />
        <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map(([titre, texte], i) => (
            <li key={titre} className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-rose-clair)] font-extrabold text-[color:var(--color-accent)]" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="m-0 mt-4 text-[1.125rem] font-extrabold">{titre}</h3>
              <p className="m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)]">{texte}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section fond="blanc">
        <EnteteSection surtitre="Responsabilités" titre="Qui fait quoi." />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="carte p-6 md:p-8">
            <h3 className="m-0 text-[1.25rem] font-extrabold">Votre établissement</h3>
            <ul className="m-0 mt-4 grid list-disc gap-2 pl-5 text-[1rem] text-[color:var(--color-encre-faible)]">
              <li>Fournit la liste des classes et affecte les professeurs.</li>
              <li>Remet les accès et vérifie l&apos;identité lors d&apos;une récupération.</li>
              <li>Désigne les administrateurs et modère les échanges signalés.</li>
            </ul>
          </article>
          <article className="carte p-6 md:p-8">
            <h3 className="m-0 text-[1.25rem] font-extrabold">Study</h3>
            <ul className="m-0 mt-4 grid list-disc gap-2 pl-5 text-[1rem] text-[color:var(--color-encre-faible)]">
              <li>Héberge le service et cloisonne les données de chaque établissement.</li>
              <li>Journalise les actions sensibles et applique les droits à chaque requête.</li>
              <li>Décrit ses garanties sur la page <a href="/securite" className="font-semibold text-[color:var(--color-accent)]">Sécurité et données</a>.</li>
            </ul>
          </article>
        </div>
      </Section>

      <Section id="demande">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div>
            <EnteteSection titre="Demander une démonstration" chapeau="Trente minutes sur votre organisation réelle. Aucun fichier d'élèves n'est demandé à cette étape." />
            <div className="mt-8">
              <FormulaireDemande ouverture={ouverture} />
            </div>
          </div>
          <aside className="h-fit rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6">
            <h2 className="m-0 text-[1.125rem] font-extrabold">Sans engagement</h2>
            <p className="m-0 mt-2 text-[0.9375rem]">
              Une demande de devis n&apos;est pas une commande. Aucun compte n&apos;est créé, aucun élève n&apos;est enregistré, et vous ne recevrez aucune relance automatique.
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}

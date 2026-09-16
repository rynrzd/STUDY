import type { Metadata } from "next";
import { FormulaireDemande } from "@/components/site/FormulaireDemande";
import { Section, TitrePage } from "@/components/site/Ui";
import { jetonOuverture } from "@/lib/demande-commerciale";

export const metadata: Metadata = {
  title: "Pour les établissements",
  description:
    "Demander une démonstration ou un devis pour équiper votre lycée. Aucun fichier " +
    "d'élèves n'est demandé à cette étape.",
  alternates: { canonical: "/etablissements" },
};

/**
 * /etablissements — parcours unique de demande (finition V1, §5.2).
 *
 * L'ancienne page /demo redirige ici : deux formulaires pour la même demande
 * donnaient deux files à traiter et deux façons de se perdre.
 *
 * La page est rendue à chaque requête, parce qu'elle émet un jeton d'ouverture
 * daté. Un jeton mis en cache serait périmé pour tout le monde.
 */
export const dynamic = "force-dynamic";

const SUITE = [
  "Nous vous rappelons ou vous écrivons pour comprendre vos classes et votre équipement.",
  "Vous recevez un devis chiffré sur l'effectif couvert.",
  "Après commande, l'espace de l'établissement est créé et son premier administrateur reçoit ses accès.",
  "L'import de rentrée crée les classes et prépare les identifiants à distribuer.",
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
        titre="Parlons de vos classes."
        chapeau="Dites-nous comment votre lycée est organisé et ce que vous cherchez à régler. Nous répondons avec une démonstration et un devis, pas avec une relance commerciale."
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div>
            <FormulaireDemande ouverture={ouverture} />
          </div>

          <aside className="space-y-5">
            <div className="carte p-6">
              <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                Ce qui se passe ensuite
              </h2>
              <ol className="m-0 mt-4 space-y-3 pl-5 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
                {SUITE.map((etape) => (
                  <li key={etape}>{etape}</li>
                ))}
              </ol>
            </div>

            <div className="carte bg-[color:var(--color-rose-clair)] p-6">
              <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                Sans engagement
              </h2>
              <p className="m-0 mt-3 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
                Une demande de devis n&apos;est pas une commande. Aucun compte
                n&apos;est créé, aucun élève n&apos;est enregistré, et vous ne
                recevrez aucune relance automatique.
              </p>
            </div>

            <div className="carte p-6">
              <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                Une démonstration, pas un diaporama
              </h2>
              <p className="m-0 mt-3 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
                Trente minutes sur votre organisation réelle : vos niveaux, vos
                matières, vos groupes. Vous voyez le produit tel qu&apos;il est
                aujourd&apos;hui.
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}

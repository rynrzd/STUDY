import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { Signalements } from "@/components/admin/Signalements";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { pagePrivee } from "@/lib/metadonnees";
import { signalements as listerSignalements } from "@/lib/moderation";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = pagePrivee({
  titre: "Modération",
  description: "Les signalements de l'entraide, et les décisions prises.",
});

/**
 * La modération de l'entraide — cahier V5, §7.
 *
 * **Pourquoi cet écran est dans l'administration et pas chez le professeur.**
 * Le professeur participe à l'entraide de son cours ; lui confier l'arbitrage
 * d'un conflit entre ses propres élèves mélangerait deux rôles. Il conserve ce
 * qu'il avait — masquer un contenu de son cours — mais ce geste ne clôt aucun
 * signalement et ne répond à personne.
 *
 * L'administrateur, lui, a une autorité qui couvre plusieurs classes, présente
 * un second facteur, et ses décisions sont journalisées.
 *
 * La base reconnaît aussi un rôle `moderateur`, qu'un établissement pourrait
 * confier à un CPE. **Aucun écran ne l'attribue aujourd'hui** : cette page est
 * donc, en pratique, celle de l'administrateur.
 */
export const dynamic = "force-dynamic";

export default async function PageModeration() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (!personne.roles.includes("admin_etablissement")) redirect("/app");

  // Le gabarit a déjà redirigé si le second facteur manquait. On le revérifie :
  // lire qui a signalé qui n'est pas un droit qu'un mot de passe seul ouvre, et
  // cette page peut être atteinte sans passer par le gabarit lors d'une
  // navigation côté client.
  if (!(await assuranceSuffisante(personne))) redirect("/second-facteur");

  if (personne.organizationId === null) {
    return (
      <>
        <TitreEspace titre="Modération" />
        <div className="mt-8">
          <Vide
            titre="Votre compte n'administre aucun établissement actif."
            texte="Les signalements apparaîtront ici dès que votre établissement sera actif."
          />
        </div>
      </>
    );
  }

  const lignes = await listerSignalements({ organisation: personne.organizationId });

  return (
    <>
      <TitreEspace
        titre="Modération"
        sousTitre={personne.organisation ?? "Établissement"}
      />

      <p className="m-0 mt-4 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
        Un signalement, seul, ne masque rien — et dix non plus. Un message ne
        disparaît que par une décision écrite, prise ici, et conservée au journal
        d&apos;audit. Le nom de la personne qui a signalé ne sort pas de cette
        page.
      </p>

      <Signalements signalements={lignes} />
    </>
  );
}

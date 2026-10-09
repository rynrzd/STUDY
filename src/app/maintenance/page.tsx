import type { Metadata } from "next";
import Link from "next/link";
import { CadreAccesPublic } from "@/components/site/CadreAccesPublic";

/**
 * Page de maintenance.
 *
 * Elle existe pour être basculée volontairement pendant une intervention
 * planifiée : on ne l'atteint jamais par accident. Elle n'est pas indexable et
 * ne dit rien de l'infrastructure — une page de maintenance qui nomme la base
 * de données ou le fournisseur en panne renseigne gratuitement.
 */

export const metadata: Metadata = {
  title: "Maintenance",
  robots: { index: false, follow: false },
};

export default function PageMaintenance() {
  return (
    <CadreAccesPublic titre="Intervention en cours." sousTitre="Study revient après une mise à jour planifiée.">
        <p className="mt-6 max-w-[58ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
          Le service est momentanément interrompu pour une mise à jour
          planifiée. Les données déposées avant l&apos;interruption sont
          conservées.
        </p>
        <p className="mt-4 max-w-[58ch] text-[color:var(--color-encre-faible)]">
          Si l&apos;interruption dépasse la durée annoncée à votre
          établissement, écrivez-nous depuis la page de{" "}
          <Link href="/contact" className="text-[color:var(--color-accent)]">
            contact
          </Link>
          .
        </p>
    </CadreAccesPublic>
  );
}

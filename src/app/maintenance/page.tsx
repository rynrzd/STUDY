import type { Metadata } from "next";
import Link from "next/link";
import { MARQUE } from "@/lib/identite-legale";

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
    <main id="contenu" className="sans-debordement">
      <div className="contenu flex min-h-screen max-w-[46rem] flex-col justify-center py-20">
        <p className="m-0 text-[1.3125rem] font-extrabold tracking-[-0.03em]">{MARQUE}</p>
        <h1 className="mt-8 text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[3.25rem] md:leading-[3.5rem]">
          Intervention en cours.
        </h1>
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
      </div>
    </main>
  );
}

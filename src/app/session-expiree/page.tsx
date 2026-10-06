import type { Metadata } from "next";
import Link from "next/link";
import { CadreConnexion } from "@/components/study/connexion/CadreConnexion";
import { pagePrivee } from "@/lib/metadonnees";
import { suiteSure, versConnexion } from "@/lib/v6/redirection";

export const metadata: Metadata = pagePrivee({ titre: "Session expirée", description: "Se reconnecter et reprendre." });
export const dynamic = "force-dynamic";

/**
 * P10 — Session expirée. La reprise n'accepte qu'un chemin interne revalidé
 * (`suiteSure`) ; aucun contenu privé ne passe dans l'adresse. Les brouillons
 * restent sur l'appareil de la même personne (garde par propriétaire) ; rien
 * n'est publié automatiquement.
 */
export default async function PageSessionExpiree({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const chemin = suiteSure(suite);
  return (
    <CadreConnexion titre="Ta session a pris fin" sousTitre="Par sécurité, Study ferme les sessions inactives.">
      <ul className="m-0 grid gap-2 pl-5 text-[1rem]">
        <li>Reconnecte-toi : tu reviendras {chemin ? "sur la page que tu consultais" : "sur ton accueil"}.</li>
        <li>Les brouillons enregistrés sur cet appareil t&apos;attendent ; rien n&apos;a été envoyé à ta place.</li>
        <li>Sur un ordinateur partagé, la session dure 30 minutes sans activité.</li>
      </ul>
      <Link href={versConnexion(chemin, "expiree")} className="bouton bouton-primaire bouton-acces mt-6 w-full">
        Se reconnecter
      </Link>
    </CadreConnexion>
  );
}

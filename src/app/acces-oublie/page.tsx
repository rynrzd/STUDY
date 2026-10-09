import type { Metadata } from "next";
import Link from "next/link";
import { BandeauEtablissement } from "@/components/study/connexion/CadreConnexion";
import { CadreAccesPublic as CadreConnexion } from "@/components/site/CadreAccesPublic";
import { pagePrivee } from "@/lib/metadonnees";
import { lireContexteEtablissement } from "@/lib/v6/connexion-serveur";
import { FormulaireRecuperation } from "./FormulaireRecuperation";

export const metadata: Metadata = pagePrivee({
  titre: "Mot de passe oublié",
  description: "Retrouver un accès perdu, auprès de son établissement.",
});

export const dynamic = "force-dynamic";

/**
 * Mot de passe oublié — demande à l'établissement, accusé de réception avec
 * référence, vérification d'identité sur place, puis lien temporaire.
 * (Ancienne adresse `/mot-de-passe-oublie` : redirection permanente.)
 */
export default async function PageAccesOublie() {
  const contexte = await lireContexteEtablissement();
  return (
    <CadreConnexion titre="Mot de passe oublié ?" sousTitre="Ton établissement te remettra un nouvel accès, après avoir vérifié ton identité.">
      {contexte ? (
        <BandeauEtablissement
          nom={contexte.nom}
          changer={
            <Link href="/connexion" className="bouton bouton-discret bouton-compact">
              Changer
            </Link>
          }
        />
      ) : null}
      <FormulaireRecuperation etablissement={contexte?.nom ?? null} />
      <p className="meta m-0 mt-6">
        La récupération par e-mail n&apos;est pas proposée : Study ne dispose pas d&apos;adresse vérifiée pour chaque compte. Ton mot de
        passe n&apos;est stocké nulle part en clair : personne ne peut te le rappeler, seulement t&apos;en faire choisir un nouveau.
      </p>
      <p className="mt-6 text-[0.9375rem]">
        <Link href="/connexion" className="font-semibold text-[color:var(--color-accent)]">
          ← Retour à la connexion
        </Link>
      </p>
    </CadreConnexion>
  );
}

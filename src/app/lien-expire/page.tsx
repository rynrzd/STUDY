import type { Metadata } from "next";
import Link from "next/link";
import { CadreAccesPublic as CadreConnexion } from "@/components/site/CadreAccesPublic";
import { pagePrivee } from "@/lib/metadonnees";

export const metadata: Metadata = pagePrivee({ titre: "Lien indisponible", description: "Ce lien n'est plus utilisable." });

/** P11 — Lien expiré ou indisponible. Aucun détail sur le lien ni sur un compte. */
export default function PageLienExpire() {
  return (
    <CadreConnexion titre="Ce lien n'est plus disponible" sousTitre="Il a peut-être expiré, déjà servi ou été remplacé.">
      <p className="m-0 text-[1rem]">
        Demande un nouveau lien à la vie scolaire ou au secrétariat de ton établissement. Si ton compte est déjà activé, connecte-toi
        simplement.
      </p>
      <Link href="/connexion" className="bouton bouton-primaire bouton-acces mt-6 w-full">
        Connexion
      </Link>
      <p className="mt-4 text-center text-[0.9375rem]">
        <Link href="/acces-oublie" className="font-semibold text-[color:var(--color-accent)]">
          Demander un nouvel accès
        </Link>
      </p>
    </CadreConnexion>
  );
}

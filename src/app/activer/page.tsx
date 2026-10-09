import type { Metadata } from "next";
import Link from "next/link";
import { CadreAccesPublic as CadreConnexion } from "@/components/site/CadreAccesPublic";
import { pagePrivee } from "@/lib/metadonnees";
import { ouvrirInvitation } from "./actions";
import { FormulaireLien } from "./FormulaireLien";

export const metadata: Metadata = pagePrivee({ titre: "Première connexion", description: "Activer son accès à Study." });

/**
 * Première connexion — deux façons réelles d'activer un compte, et aucune
 * autre : Study ne crée pas de compte ici. C'est l'établissement qui crée le
 * compte et remet soit un lien d'invitation (personnel, 7 jours, une seule
 * utilisation), soit une fiche avec un mot de passe temporaire.
 */
export default function PageActiver() {
  return (
    <CadreConnexion titre="Première connexion" sousTitre="Ton compte a été créé par ton établissement. Choisis ce que tu as reçu.">
      <section aria-labelledby="lien" className="rounded-[12px] border border-[color:var(--color-bordure)] p-4">
        <h2 id="lien" className="m-0 text-[1.125rem]">
          Un lien d&apos;invitation
        </h2>
        <p className="meta m-0 mt-1">Ouvre-le directement, ou colle-le ici.</p>
        <FormulaireLien action={ouvrirInvitation} />
      </section>

      <section aria-labelledby="fiche" className="mt-4 rounded-[12px] border border-[color:var(--color-bordure)] p-4">
        <h2 id="fiche" className="m-0 text-[1.125rem]">
          Une fiche avec un mot de passe temporaire
        </h2>
        <p className="m-0 mt-1 text-[0.9375rem]">
          Connecte-toi avec le code établissement, l&apos;identifiant et le mot de passe de la fiche : Study te demandera ensuite
          d&apos;en choisir un personnel.
        </p>
        <Link href="/connexion" className="bouton bouton-secondaire bouton-acces mt-4 w-full">
          Me connecter avec ma fiche
        </Link>
      </section>

      <section aria-labelledby="rien" className="mt-4 p-1">
        <h2 id="rien" className="m-0 text-[1rem]">
          Rien reçu ?
        </h2>
        <p className="m-0 mt-1 text-[0.9375rem] text-[color:var(--color-encre-faible)]">
          Demande ton accès à la vie scolaire ou au secrétariat. Un code de classe donné par un professeur ne suffit pas pour
          créer un compte : il sert, une fois connecté, à demander à rejoindre une classe.
        </p>
      </section>

      <p className="mt-8 text-[0.9375rem]">
        <Link href="/connexion" className="font-semibold text-[color:var(--color-accent)]">
          ← Retour à la connexion
        </Link>
      </p>
    </CadreConnexion>
  );
}

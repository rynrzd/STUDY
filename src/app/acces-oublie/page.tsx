import type { Metadata } from "next";
import { pagePrivee } from "@/lib/metadonnees";
import Link from "next/link";
import { MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = pagePrivee({
  titre: "Mot de passe oublié",
  description:
    "Comment retrouver un accès perdu.",
});

/**
 * /mot-de-passe-oublie — cahier V2, §21.
 *
 * Il n'y a pas de formulaire ici, et ce n'est pas un manque : la
 * réinitialisation par courriel supposerait une adresse personnelle pour
 * chaque élève. AvecStudy n'en collecte aucune — un élève de seconde n'a pas à
 * confier son adresse à un outil scolaire pour retrouver son cours de maths.
 *
 * Le chemin réel est donc humain : l'administration du lycée vérifie l'identité
 * sur place et remet un nouvel accès. C'est plus lent qu'un courriel, et
 * considérablement plus difficile à détourner.
 */
export default function PageMotDePasseOublie() {
  return (
    <main
      id="contenu"
      className="sans-debordement mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center px-5 py-12"
    >
      <Link href="/" className="text-[1.5rem] font-extrabold tracking-[-0.03em] no-underline">
        {MARQUE}
      </Link>

      <h1 className="mt-10 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)]">
        Mot de passe oublié
      </h1>

      <p className="mt-4 text-[color:var(--color-encre-faible)]">
        Votre accès se rétablit auprès de votre établissement, pas par courriel.
      </p>

      <ol className="m-0 mt-8 list-none space-y-6 p-0">
        <Etape numero={1} titre="Adressez-vous à l'administration de votre établissement">
          Vie scolaire, secrétariat, ou la personne qui vous a remis votre
          identifiant à la rentrée. Elle vérifie votre identité sur place.
        </Etape>
        <Etape numero={2} titre="Elle vous remet une nouvelle fiche d'accès">
          Un identifiant et un mot de passe temporaire, imprimés. Rien n&apos;est
          envoyé par message.
        </Etape>
        <Etape numero={3} titre="Vous choisissez votre mot de passe">
          À la première connexion, {MARQUE} vous demande d&apos;en choisir un
          personnel. Le mot de passe temporaire cesse alors de fonctionner.
        </Etape>
      </ol>

      <p className="mt-10 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Personne — ni votre établissement, ni {MARQUE} — ne peut lire votre mot
        de passe : il n&apos;est stocké nulle part en clair. C&apos;est pourquoi
        on ne peut pas vous le rappeler, seulement le remplacer.
      </p>

      <p className="mt-8 text-[length:var(--text-aide)]">
        <Link href="/connexion" className="text-[color:var(--color-encre-faible)]">
          ← Retour à la connexion
        </Link>
      </p>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Etape({
  numero,
  titre,
  children,
}: {
  numero: number;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-rose-clair)] text-[length:var(--text-aide)] font-bold text-[color:var(--color-accent)]"
      >
        {numero}
      </span>
      <span>
        <span className="block font-semibold">{titre}</span>
        <span className="mt-1 block text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
          {children}
        </span>
      </span>
    </li>
  );
}

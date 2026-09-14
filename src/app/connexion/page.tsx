import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Entrée réservée aux membres d'un établissement équipé.",
  // L'entrée privée n'a rien à faire dans un index (ch. 05).
  robots: { index: false, follow: false },
};

/**
 * /connexion — entrée privée (ch. 02, AUTH-03).
 *
 * Trois éléments : code établissement, identifiant, mot de passe. Le code
 * identifie le lycée et n'accorde aucun droit. Il n'y a pas d'inscription
 * publique : un compte est créé par l'établissement, jamais demandé ici.
 *
 * Le formulaire est affiché mais inerte, et le dit. Le raccordement au
 * fournisseur d'identité n'est pas fait : un écran qui accepterait un mot de
 * passe sans rien vérifier serait pire qu'un écran absent.
 *
 * Note de conception pour la suite : le message d'erreur devra être identique
 * que le compte existe ou non, pour ne pas révéler l'existence d'un compte.
 */

const CHAMP =
  "mt-2 block w-full min-h-[44px] rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] " +
  "bg-[color:var(--color-surface)] px-3 text-[length:var(--text-corps)] " +
  "disabled:bg-[color:var(--color-fond)] disabled:text-[color:var(--color-encre-faible)]";

export default function Connexion() {
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mot-symbole text-3xl no-underline text-[color:var(--color-encre)]"
      >
        study.
      </Link>

      <h1 className="mt-8 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        Se connecter
      </h1>
      <p className="mt-3 text-[color:var(--color-encre-faible)]">
        Votre établissement vous a remis un code, un identifiant et un mot de
        passe temporaire.
      </p>

      <aside
        role="note"
        className="mt-8 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-rose-selection)] p-5"
      >
        <p className="m-0 font-semibold">Connexion indisponible</p>
        <p className="mt-2 m-0 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
          Le service d&apos;authentification n&apos;est pas encore raccordé.
          Aucun compte ne peut être ouvert, et aucun identifiant saisi ici ne
          serait vérifié. Le formulaire est affiché pour revue.
        </p>
      </aside>

      <form className="mt-8">
        <fieldset className="m-0 border-0 p-0 space-y-6" disabled>
          <legend className="sr-only">Identifiants de connexion</legend>

          <div>
            <label className="block font-semibold" htmlFor="code-etablissement">
              Code établissement
            </label>
            <input
              className={CHAMP}
              id="code-etablissement"
              name="code_etablissement"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              aria-describedby="aide-code"
              required
            />
            <span
              id="aide-code"
              className="mt-1 block text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
            >
              Il figure sur la fiche remise par votre lycée. Il identifie
              l&apos;établissement et n&apos;ouvre aucun accès à lui seul.
            </span>
          </div>

          <div>
            <label className="block font-semibold" htmlFor="identifiant">
              Identifiant
            </label>
            <input
              className={CHAMP}
              id="identifiant"
              name="identifiant"
              type="text"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block font-semibold" htmlFor="mot-de-passe">
              Mot de passe
            </label>
            <input
              className={CHAMP}
              id="mot-de-passe"
              name="mot_de_passe"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" name="poste_partage" className="h-4 w-4" />
            <span>
              Poste partagé
              <span className="block text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
                Session plus courte, rien n&apos;est conservé sur cet ordinateur.
              </span>
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          disabled
          aria-describedby="raison-desactivation"
          className="mt-8 inline-flex min-h-[44px] w-full cursor-not-allowed items-center justify-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-6 text-[color:var(--color-surface)] opacity-50"
        >
          Se connecter
        </button>
        <p
          id="raison-desactivation"
          className="mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
        >
          Indisponible tant que le service d&apos;authentification n&apos;est pas
          raccordé.
        </p>
      </form>

      <div className="mt-10 border-t border-[color:var(--color-bordure)] pt-6 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
        <p className="m-0">
          <strong className="text-[color:var(--color-encre)]">Mot de passe oublié ?</strong>{" "}
          Adressez-vous à l&apos;administrateur study. de votre établissement. Il
          réinitialise votre accès après avoir vérifié votre identité sur place.
        </p>
        <p className="mt-4 m-0">
          Il n&apos;y a pas d&apos;inscription sur study. Les comptes sont créés
          par l&apos;établissement. Si votre lycée n&apos;utilise pas encore
          study.,{" "}
          <Link href="/etablissements" className="text-[color:var(--color-accent)]">
            parlez-en à votre direction
          </Link>
          .
        </p>
      </div>

      <p className="mt-8 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
        <Link href="/" className="text-[color:var(--color-encre-faible)]">
          ← Retour au site
        </Link>
      </p>
    </main>
  );
}

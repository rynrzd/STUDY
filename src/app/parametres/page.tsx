import Link from "next/link";
import { redirect } from "next/navigation";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { TitreEspace } from "@/components/app/Cadre";
import { MotDePasse } from "@/components/parametres/MotDePasse";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Paramètres du compte — cahier V2, §15.
 *
 * Ce que la personne peut réellement changer : son mot de passe. Le reste —
 * son nom, son identifiant, sa classe, son établissement — appartient à
 * l'administration de son lycée, et l'écran le dit au lieu d'afficher des
 * champs grisés qui laisseraient croire le contraire.
 */
export const dynamic = "force-dynamic";

export default async function PageParametres() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const role = personne.roles.includes("editeur")
    ? "Exploitation AvecStudy"
    : personne.roles.includes("admin_etablissement")
      ? "Administration de l'établissement"
      : personne.roles.includes("professeur")
        ? "Professeur"
        : "Élève";

  return (
    <>
      <TitreEspace titre="Paramètres" sousTitre={`${personne.prenom} ${personne.nom}`} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <MotDePasse />

        <aside className="space-y-5">
          <section className="carte p-5">
            <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
              Mon compte
            </h2>
            <dl className="m-0 mt-3 space-y-3">
              <Ligne terme="Nom" valeur={`${personne.prenom} ${personne.nom}`} />
              <Ligne terme="Rôle" valeur={role} />
              <Ligne terme="Établissement" valeur={personne.organisation ?? "—"} />
              <Ligne
                terme="Appareil"
                valeur={personne.appareil === "partage" ? "Partagé" : "Personnel"}
              />
            </dl>
            <p className="m-0 mt-4 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
              Ces informations sont tenues par l&apos;administration de votre
              établissement. Signalez-lui toute erreur : la correction se fait de
              son côté.
            </p>
          </section>

          <section className="carte p-5">
            <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
              Session
            </h2>
            <p className="m-0 mt-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
              Sur un ordinateur partagé, déconnectez-vous avant de quitter votre
              place : fermer l&apos;onglet ne suffit pas.
            </p>
            <form action={seDeconnecter} className="mt-4">
              <button type="submit" className="bouton bouton-secondaire w-full">
                Se déconnecter
              </button>
            </form>
          </section>

          <p className="m-0 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
            Questions sur vos données personnelles :{" "}
            <Link href="/confidentialite" className="text-[color:var(--color-accent)]">
              politique de confidentialité
            </Link>
            .
          </p>
        </aside>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
        {terme}
      </dt>
      <dd className="m-0 mt-0.5 text-[length:var(--text-tableau)] font-medium">{valeur}</dd>
    </div>
  );
}

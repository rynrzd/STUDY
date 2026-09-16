import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { MARQUE } from "@/lib/identite-legale";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata: Metadata = {
  title: "Mes cours",
  robots: { index: false, follow: false },
};

/**
 * Espace de l'élève et de l'enseignant.
 *
 * Toutes les lectures de cette page passent par le **jeton de la personne**,
 * pas par la clé de service : les politiques RLS s'appliquent donc réellement.
 * C'est la différence qui compte — un écran d'administration peut se permettre
 * la clé privilégiée parce que son périmètre est l'ensemble du service ; un
 * écran d'élève, jamais.
 *
 * Si une requête ne renvoie rien, ce n'est pas une erreur à masquer : cela veut
 * dire que la personne n'a accès à rien de plus, et la page le dit.
 */
export const dynamic = "force-dynamic";

export default async function PageMesCours() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const jeton = await jetonAccesDe(personne);

  const classes = jeton === null ? [] : await lireClasses(jeton);
  const seances = jeton === null ? [] : await lireSeances(jeton);

  return (
    <div className="sans-debordement min-h-screen bg-[color:var(--color-fond)]">
      <header className="border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex h-[64px] w-full max-w-[var(--spacing-contenu)] items-center justify-between gap-4 px-5">
          <div className="flex items-baseline gap-3">
            <span className="text-[1.125rem] font-extrabold tracking-[-0.03em]">{MARQUE}</span>
            <span className="hidden text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] sm:inline">
              {personne.organisation ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] sm:inline">
              {personne.prenom} {personne.nom}
            </span>
            <form action={seDeconnecter}>
              <button
                type="submit"
                className="bouton bouton-secondaire h-9 min-h-9 px-3.5 text-[length:var(--text-tableau)]"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-[var(--spacing-contenu)] px-5 py-10">
        <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Bonjour {personne.prenom}
        </h1>

        <section className="mt-8">
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Mes classes
          </h2>

          {classes.length === 0 ? (
            <p className="m-0 mt-3 max-w-[60ch] text-[color:var(--color-encre-faible)]">
              Aucune classe n&apos;est rattachée à votre compte pour le moment.
              Votre établissement les enregistre au moment de l&apos;import de
              rentrée ; signalez-le-lui si vous pensez qu&apos;il y a une erreur.
            </p>
          ) : (
            <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {classes.map((classe) => (
                <li key={classe.id} className="carte p-5">
                  <p className="m-0 font-semibold">{classe.label}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Séances publiées
          </h2>

          {seances.length === 0 ? (
            <p className="m-0 mt-3 max-w-[60ch] text-[color:var(--color-encre-faible)]">
              Aucune séance publiée pour l&apos;instant. Elles apparaîtront ici
              dès qu&apos;un enseignant en publiera une dans l&apos;une de vos
              classes.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-3 p-0">
              {seances.map((seance) => (
                <li key={seance.id} className="carte p-5">
                  <p className="m-0 font-semibold">{seance.title}</p>
                  {seance.objective === null ? null : (
                    <p className="m-0 mt-1.5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                      {seance.objective}
                    </p>
                  )}
                  {seance.published_at === null ? null : (
                    <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                      Publiée le {dateLisible(seance.published_at)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-12 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          Un problème d&apos;accès ou une classe qui manque ?{" "}
          <Link href="/aide" className="text-[color:var(--color-accent)]">
            Consultez l&apos;aide
          </Link>{" "}
          — pour un compte, c&apos;est votre établissement qui intervient.
        </p>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface Classe {
  id: string;
  label: string;
}

interface Seance {
  id: string;
  title: string;
  objective: string | null;
  published_at: string | null;
}

async function lireClasses(jeton: string): Promise<Classe[]> {
  const client = clientUtilisateur(jeton);
  const { data, error } = await client.from("classes").select("id, label").limit(50);
  if (error !== null) return [];
  return (data ?? []) as unknown as Classe[];
}

async function lireSeances(jeton: string): Promise<Seance[]> {
  const client = clientUtilisateur(jeton);
  const { data, error } = await client
    .from("lessons")
    .select("id, title, objective, published_at")
    .eq("state", "publiee")
    .order("published_at", { ascending: false })
    .limit(30);
  if (error !== null) return [];
  return (data ?? []) as unknown as Seance[];
}

function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { devoirsDuProfesseur, seancesDuProfesseur } from "@/lib/espace-professeur";
import { echeanceLisible, seancesDuJour } from "@/lib/echeances";

/**
 * Accueil du professeur — cahier V2, §8.1.
 *
 * L'écran répond à une seule question : « qu'est-ce que je prépare
 * maintenant ? ». Les séances du jour d'abord, les brouillons ensuite — parce
 * qu'un brouillon oublié est l'incident le plus coûteux du produit : la classe
 * arrive, et le cours n'est pas visible.
 */
export const dynamic = "force-dynamic";

export default async function PageProfesseur() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const cours = await coursDuProfesseur(jeton);

  if (cours.length === 0) {
    return (
      <>
        <TitreEspace titre={`Bonjour ${personne.prenom}`} sousTitre={personne.organisation} />
        <div className="mt-8">
          <Vide
            titre="Aucun cours ne vous est encore affecté."
            texte="Vos cours apparaissent ici dès que l'administration de votre établissement vous affecte à une classe et à une matière. C'est elle qui réalise cette opération, depuis son espace."
          />
        </div>
      </>
    );
  }

  const [seances, devoirs] = await Promise.all([
    seancesDuProfesseur(jeton),
    devoirsDuProfesseur(jeton),
  ]);

  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const aujourdhui = seancesDuJour(seances);
  const brouillons = seances.filter((s) => s.state === "brouillon").slice(0, 8);
  const publiees = seances.filter((s) => s.state === "publiee").slice(0, 6);
  const devoirsOuverts = devoirs.filter((d) => d.state === "publiee").slice(0, 6);

  return (
    <>
      <TitreEspace
        titre={`Bonjour ${personne.prenom}`}
        sousTitre={personne.organisation}
        action={
          <Link href="/studio" className="bouton bouton-rose">
            Ouvrir le Studio
          </Link>
        }
      />

      <section className="mt-9">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Aujourd&apos;hui
        </h2>

        {aujourdhui.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Aucune séance n&apos;est datée d&apos;aujourd&apos;hui. Vous pouvez en
            préparer une pour un autre jour depuis le Studio.
          </p>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {aujourdhui.map((seance) => (
              <li key={seance.id}>
                <Link href={`/studio/${seance.id}`} className="carte block p-5 no-underline">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[color:var(--color-encre)]">
                      {seance.title}
                    </span>
                    <span
                      className={`pastille ${
                        seance.state === "publiee" ? "pastille-publie" : "pastille-brouillon"
                      }`}
                    >
                      {seance.state === "publiee" ? "Publiée" : "Brouillon"}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                    {libelles.get(seance.teaching_space_id) ?? "Cours"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-11 grid gap-11 lg:grid-cols-2 lg:items-start">
        <Colonne titre="Brouillons à terminer" vide="Aucun brouillon en attente.">
          {brouillons.map((seance) => (
            <Ligne
              key={seance.id}
              href={`/studio/${seance.id}`}
              titre={seance.title}
              detail={libelles.get(seance.teaching_space_id) ?? "Cours"}
              marque={<span className="pastille pastille-brouillon">Brouillon</span>}
            />
          ))}
        </Colonne>

        <Colonne titre="Devoirs en cours" vide="Aucun devoir donné pour l'instant.">
          {devoirsOuverts.map((devoir) => (
            <Ligne
              key={devoir.id}
              href="/professeur/devoirs"
              titre={devoir.title}
              detail={libelles.get(devoir.teaching_space_id) ?? "Cours"}
              marque={
                <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                  {echeanceLisible(devoir.due_at)}
                </span>
              }
            />
          ))}
        </Colonne>
      </div>

      <section className="mt-11">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Dernières séances publiées
        </h2>
        {publiees.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Rien n&apos;est encore publié. Tant qu&apos;une séance reste un
            brouillon, vos élèves ne la voient pas.
          </p>
        ) : (
          <ul className="m-0 mt-3 list-none p-0">
            {publiees.map((seance) => (
              <Ligne
                key={seance.id}
                href={`/studio/${seance.id}`}
                titre={seance.title}
                detail={libelles.get(seance.teaching_space_id) ?? "Cours"}
                marque={<span className="pastille pastille-publie">Publiée</span>}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Colonne({
  titre,
  vide,
  children,
}: {
  titre: string;
  vide: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        {titre}
      </h2>
      {children.length === 0 ? (
        <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">{vide}</p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">{children}</ul>
      )}
    </section>
  );
}

function Ligne({
  href,
  titre,
  detail,
  marque,
}: {
  href: string;
  titre: string;
  detail: string;
  marque: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-[color:var(--color-encre)]">{titre}</span>
          <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            {detail}
          </span>
        </span>
        {marque}
      </Link>
    </li>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RemiseCopie } from "@/components/eleve/RemiseCopie";
import { devoir as lireDevoir, maRemise } from "@/lib/devoirs";
import { coursDeLEleve } from "@/lib/espace-eleve";
import { instantLisible, jourLisible } from "@/lib/horodatage";
import { pagePrivee } from "@/lib/metadonnees";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = pagePrivee({
  titre: "Devoir",
  description: "Le détail d'un devoir et la remise de la copie.",
});

/**
 * Le détail d'un devoir, côté élève — cahier V5, §3.1.
 *
 * Tout ce dont l'élève a besoin pour décider quoi faire est sur cet écran :
 * la consigne, l'échéance en heure de Paris, l'état de sa remise, et l'endroit
 * où déposer. Rien n'est caché derrière un second clic.
 *
 * L'écran ne montre une zone de dépôt que si le devoir en attend une. Un
 * travail papier ou un travail sans rien à rendre affiche ce qu'il est, et
 * pas un champ de fichier qui ne servirait à rien.
 */
export const dynamic = "force-dynamic";

const ETIQUETTES: Record<string, string> = {
  non_commence: "Pas encore remis",
  brouillon: "Pas encore remis",
  remis: "Remis",
  remis_en_retard: "Remis en retard",
  retour_disponible: "Corrigé",
  a_reprendre: "À reprendre",
};

export default async function PageDevoirEleve({
  params,
}: {
  params: Promise<{ devoir: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { devoir: identifiant } = await params;
  const leDevoir = await lireDevoir(jeton, identifiant);

  // « Pas le droit » et « n'existe pas » donnent la même réponse : distinguer
  // les deux apprendrait quels devoirs existent ailleurs.
  if (leDevoir === null || leDevoir.etat === "brouillon" || leDevoir.etat === "archive") {
    notFound();
  }

  const [cours, remise] = await Promise.all([coursDeLEleve(jeton), maRemise(jeton, identifiant)]);
  const libelle = cours.find((unCours) => unCours.id === leDevoir.cours)?.libelle ?? "Cours";

  const attendUnFichier = leDevoir.mode === "numerique" || leDevoir.mode === "mixte";
  // L echeance est passee ? On ne le recalcule pas ici : l etat vient du
  // serveur, et refaire le calcul avec l horloge de la machine de rendu
  // donnerait une seconde verite.
  const echu = leDevoir.etat === "publie_en_retard" || leDevoir.etat === "ferme";
  const dejaRemis = (remise?.versions.length ?? 0) > 0;

  return (
    <article className="max-w-[var(--spacing-lecture)]">
      <nav aria-label="Fil d'ariane" className="mb-6 print:hidden">
        <Link href="/eleve/devoirs" className="lien-fleche text-[length:var(--text-tableau)]">
          <span aria-hidden="true">←</span> À faire
        </Link>
      </nav>

      <p className="m-0 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        {libelle}
      </p>

      <h1
        data-testid="devoir-titre"
        className="m-0 mt-1 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]"
      >
        {leDevoir.titre}
      </h1>

      <dl className="m-0 mt-5 grid gap-x-8 gap-y-2 text-[length:var(--text-tableau)] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="font-semibold">À rendre</dt>
        <dd className="m-0" data-testid="devoir-echeance">
          {leDevoir.echeance === null
            ? "Sans date limite"
            : `${instantLisible(leDevoir.echeance)} (heure de Paris)`}
          {echu && leDevoir.etat === "publie_en_retard" ? (
            <span className="ml-2 text-[color:var(--color-erreur)]">échéance passée</span>
          ) : null}
        </dd>

        <dt className="font-semibold">Remise</dt>
        <dd className="m-0" data-testid="devoir-mode">
          {leDevoir.mode === "numerique" || leDevoir.mode === "mixte"
            ? "Un fichier à déposer ici"
            : leDevoir.mode === "papier"
              ? "À rendre sur papier"
              : "Rien à rendre"}
        </dd>

        <dt className="font-semibold">Mon état</dt>
        <dd className="m-0" data-testid="devoir-etat-remise" data-etat={remise?.etat ?? "non_commence"}>
          {ETIQUETTES[remise?.etat ?? "non_commence"] ?? "Pas encore remis"}
        </dd>
      </dl>

      {leDevoir.consigne !== "" ? (
        <section className="mt-8">
          <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Consigne
          </h2>
          <p className="m-0 mt-3 whitespace-pre-line">{leDevoir.consigne}</p>
        </section>
      ) : null}

      {/* ----------------------------------------------------- Ma remise -- */}

      <section className="mt-10 print:hidden">
        <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Ma remise
        </h2>

        {dejaRemis ? (
          <ul data-testid="mes-versions" className="m-0 mt-4 list-none space-y-2 p-0">
            {remise!.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3"
              >
                <span className="text-[length:var(--text-tableau)]">
                  Version {version.numero} — {instantLisible(version.remisLe)}
                  {version.enRetard ? (
                    <span className="ml-2 text-[color:var(--color-erreur)]">en retard</span>
                  ) : null}
                </span>
                {version.fichier !== null ? (
                  <a
                    href={`/documents/${version.fichier}`}
                    data-testid="telecharger-ma-copie"
                    className="bouton bouton-secondaire bouton-compact"
                  >
                    Télécharger
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5">
          {attendUnFichier ? (
            leDevoir.etat === "ferme" ? (
              <p className="m-0 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-fond-doux)] p-4 text-[length:var(--text-tableau)]">
                La remise est fermée : l&apos;échéance est passée et ce devoir
                n&apos;accepte pas les retards.
              </p>
            ) : (
              <RemiseCopie
                devoir={leDevoir.id}
                remplacement={leDevoir.remplacementAutorise}
                dejaRemis={dejaRemis}
                enRetardSiRemisMaintenant={echu}
              />
            )
          ) : (
            <p
              data-testid="remise-sans-fichier"
              className="m-0 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-fond-doux)] p-4 text-[length:var(--text-tableau)]"
            >
              {leDevoir.mode === "papier"
                ? "Ce devoir est à rendre sur papier. Votre professeur notera ici qu'il l'a reçu."
                : "Ce devoir n'attend rien à rendre."}
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- Correction -- */}

      {remise?.retour !== null && remise?.retour !== undefined && remise.retour.publieLe !== null ? (
        <section className="mt-10" data-testid="correction-recue">
          <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Correction
          </h2>
          <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            Publiée le {jourLisible(remise.retour.publieLe)}
          </p>

          {remise.retour.commentaire !== null && remise.retour.commentaire !== "" ? (
            <p className="m-0 mt-3 whitespace-pre-line" data-testid="correction-commentaire">
              {remise.retour.commentaire}
            </p>
          ) : null}

          {remise.retour.fichier !== null ? (
            <p className="m-0 mt-4">
              <a
                href={`/documents/${remise.retour.fichier}`}
                data-testid="telecharger-correction"
                className="bouton bouton-secondaire"
              >
                Télécharger {remise.retour.nomFichier ?? "la correction"}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

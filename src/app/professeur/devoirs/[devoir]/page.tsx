import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormulaireDevoir } from "@/components/professeur/FormulaireDevoir";
import { SuiviRemises } from "@/components/professeur/SuiviRemises";
import { BasculeDevoir } from "@/components/professeur/BasculeDevoir";
import { CorrectionCommune } from "@/components/professeur/CorrectionCommune";
import { correctionCommune, devoir as lireDevoir, suiviDuDevoir } from "@/lib/devoirs";
import { instantLisible } from "@/lib/horodatage";
import { pagePrivee } from "@/lib/metadonnees";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";

export const metadata: Metadata = pagePrivee({
  titre: "Devoir",
  description: "Le suivi des remises et les corrections d'un devoir.",
});

/**
 * Un devoir, côté professeur — cahier V5, §2, §4 et §5.
 *
 * Trois moments sur un seul écran : ce que le devoir dit, qui a rendu, et ce
 * qu'on leur répond. Les séparer obligerait à revenir en arrière pour relire
 * la consigne pendant qu'on corrige.
 */
export const dynamic = "force-dynamic";

const ETATS: Record<string, string> = {
  brouillon: "Brouillon — vos élèves ne le voient pas",
  publie: "Publié",
  publie_en_retard: "Publié — échéance passée, les retards sont acceptés",
  ferme: "Fermé — l'échéance est passée et les retards sont refusés",
  archive: "Archivé",
};

export default async function PageDevoirProfesseur({
  params,
}: {
  params: Promise<{ devoir: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");
  if (!personne.roles.includes("professeur")) redirect("/app");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { devoir: identifiant } = await params;
  const leDevoir = await lireDevoir(jeton, identifiant);
  if (leDevoir === null) notFound();

  const [cours, suivi, commune] = await Promise.all([
    coursDuProfesseur(jeton),
    suiviDuDevoir(jeton, identifiant),
    correctionCommune(jeton, identifiant),
  ]);

  const libelle = cours.find((unCours) => unCours.id === leDevoir.cours)?.libelle ?? "Cours";
  const echeance = leDevoir.echeance === null ? null : new Date(leDevoir.echeance);

  return (
    <article>
      <nav aria-label="Fil d'ariane" className="mb-6 print:hidden">
        <Link href="/professeur/devoirs" className="lien-fleche text-[length:var(--text-tableau)]">
          <span aria-hidden="true">←</span> Mes devoirs
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

      <p
        data-testid="devoir-etat"
        data-etat={leDevoir.etat}
        className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]"
      >
        {ETATS[leDevoir.etat] ?? leDevoir.etat}
        {leDevoir.echeance !== null ? ` — à rendre le ${instantLisible(leDevoir.echeance)}` : ""}
      </p>

      <div className="mt-5 print:hidden">
        <BasculeDevoir
          devoir={leDevoir.id}
          publie={leDevoir.etat !== "brouillon" && leDevoir.etat !== "archive"}
          archive={leDevoir.etat === "archive"}
        />
      </div>

      <section className="mt-10 print:hidden">
        <h2 className="m-0 mb-4 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Le devoir
        </h2>
        <FormulaireDevoir
          cours={cours.map((unCours) => ({ id: unCours.id, libelle: unCours.libelle }))}
          seances={[]}
          valeurs={{
            id: leDevoir.id,
            titre: leDevoir.titre,
            consigne: leDevoir.consigne,
            date: echeance === null ? "" : echeance.toISOString().slice(0, 10),
            heure:
              echeance === null
                ? ""
                : new Intl.DateTimeFormat("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Paris",
                  }).format(echeance),
            mode: leDevoir.mode,
            remplacement: leDevoir.remplacementAutorise,
            retard: leDevoir.politiqueRetard,
          }}
        />
      </section>

      {/* Une liste vide ressemble à « personne n'a rendu » et non à « la
          lecture a échoué ». L'écran doit pouvoir dire la panne, sinon le
          professeur conclut que sa classe n'a rien fait. */}
      {suivi.ok ? (
        <SuiviRemises
          devoir={leDevoir.id}
          organisation={personne.organizationId ?? ""}
          mode={leDevoir.mode}
          lignes={suivi.lignes}
        />
      ) : (
        <section className="mt-12">
          <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Remises
          </h2>
          <p
            role="alert"
            data-testid="suivi-erreur"
            className="m-0 mt-4 rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4 text-[length:var(--text-tableau)]"
          >
            {suivi.message}
          </p>
        </section>
      )}

      <CorrectionCommune
        devoir={leDevoir.id}
        organisation={personne.organizationId ?? ""}
        correction={commune}
        nombreEleves={suivi.ok ? suivi.lignes.length : 0}
      />
    </article>
  );
}

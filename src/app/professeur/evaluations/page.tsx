import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { FormulaireNouvelle } from "@/components/evaluations/FormulairesProf";
import { Etiquette, type Ton } from "@/components/study/ui";
import { heureLisible } from "@/lib/evaluations/dates";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { etatEvaluation, evaluationsDuProfesseur, LIBELLES_ETAT, LIBELLES_MODE, type EtatEvaluation } from "@/lib/v6/evaluations";

export const metadata: Metadata = { title: "Évaluations" };
export const dynamic = "force-dynamic";

const TON: Record<EtatEvaluation, Ton> = { brouillon: "neutre", programmee: "rose", ouverte: "attention", fermee: "erreur", publiee: "succes" };
const ORDRE: EtatEvaluation[] = ["fermee", "ouverte", "programmee", "brouillon", "publiee"];
const TITRES: Record<EtatEvaluation, string> = {
  fermee: "À corriger",
  ouverte: "En cours",
  programmee: "Programmées",
  brouillon: "Brouillons",
  publiee: "Résultats publiés",
};

/**
 * Évaluations du professeur : créer, suivre, corriger, analyser. Ce qui
 * attend une correction vient en premier — c'est ce qui coûte du temps.
 */
export default async function PageEvaluations() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const [cours, evaluations] = await Promise.all([coursDuProfesseur(jeton), evaluationsDuProfesseur(jeton)]);
  const libelles = new Map(cours.map((c) => [c.id, c.libelle]));
  const parEtat = new Map<EtatEvaluation, NonNullable<typeof evaluations>>();
  for (const e of evaluations ?? []) {
    const etat = etatEvaluation(e);
    parEtat.set(etat, [...(parEtat.get(etat) ?? []), e]);
  }

  return (
    <>
      <TitreEspace
        titre="Évaluations"
        sousTitre="Un sujet différent pour chaque élève, la correction automatique de ce qui se corrige, et ce qu'il faut reprendre en classe."
      />

      {cours.length === 0 ? (
        <div className="mt-8">
          <Vide titre="Aucune classe ne vous est affectée." texte="Une évaluation se donne à une classe. Demandez à l'administration de votre établissement de vous rattacher à vos cours." />
        </div>
      ) : (
        <>
          <section className="panneau mt-8" aria-labelledby="nouvelle">
            <h2 id="nouvelle" className="titre-bloc m-0 mb-4 font-bold">
              Nouvelle évaluation
            </h2>
            <FormulaireNouvelle cours={cours.map((c) => ({ id: c.id, libelle: c.libelle }))} />
          </section>

          {evaluations === null ? (
            <p role="alert" className="mt-8 text-[color:var(--color-erreur)]">
              La liste des évaluations n&apos;a pas pu être chargée.
            </p>
          ) : evaluations.length === 0 ? (
            <p className="meta mt-8">Vous n&apos;avez encore créé aucune évaluation.</p>
          ) : (
            ORDRE.filter((etat) => parEtat.has(etat)).map((etat) => (
              <section key={etat} className="mt-10" aria-labelledby={`etat-${etat}`}>
                <h2 id={`etat-${etat}`} className="titre-section m-0 mb-3">
                  {TITRES[etat]}
                </h2>
                <ul className="liste-r2">
                  {parEtat.get(etat)!.map((e) => (
                    <li key={e.id}>
                      <Link href={`/professeur/evaluations/${e.id}`} className="ligne-r2">
                        <span className="tuile" aria-hidden="true">
                          <ClipboardCheck size={20} strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{e.titre}</span>
                          <span className="meta block">
                            {libelles.get(e.coursId) ?? "Cours"} · {LIBELLES_MODE[e.mode]} · {e.support === "papier" ? "papier" : "en ligne"}
                            {e.copies > 0 ? ` · ${e.rendues}/${e.copies} copie${e.copies > 1 ? "s" : ""}` : ""}
                            {e.ouvreLe && etat === "programmee" ? ` · ouvre ${heureLisible(e.ouvreLe)}` : ""}
                          </span>
                        </span>
                        <Etiquette ton={TON[etat]}>{LIBELLES_ETAT[etat]}</Etiquette>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </>
  );
}

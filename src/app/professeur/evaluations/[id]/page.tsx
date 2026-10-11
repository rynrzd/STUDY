import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { archiverEvaluation } from "../actions";
import { TitreEspace } from "@/components/app/Cadre";
import { OngletCorrection } from "@/components/evaluations/OngletCorrection";
import { OngletEleves } from "@/components/evaluations/OngletEleves";
import { OngletResultats } from "@/components/evaluations/OngletResultats";
import { OngletSujet } from "@/components/evaluations/OngletSujet";
import { Etiquette, OngletsLiens, type Ton } from "@/components/study/ui";
import { heureLisible } from "@/lib/evaluations/dates";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import {
  banquePourEvaluation,
  elevesDeLEspace,
  etatEvaluation,
  evaluationDuProfesseur,
  LIBELLES_ETAT,
  LIBELLES_MODE,
  suiviEvaluation,
  type EtatEvaluation,
} from "@/lib/v6/evaluations";

export const metadata: Metadata = { title: "Évaluation" };
export const dynamic = "force-dynamic";

const ONGLETS = ["sujet", "eleves", "correction", "resultats"] as const;
type Onglet = (typeof ONGLETS)[number];
const TON: Record<EtatEvaluation, Ton> = { brouillon: "neutre", programmee: "rose", ouverte: "attention", fermee: "erreur", publiee: "succes" };

export default async function PageEvaluation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string; question?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const [{ id }, recherche] = await Promise.all([params, searchParams]);

  const prof = await evaluationDuProfesseur(jeton, id);
  if (prof === null) notFound();
  const e = prof.evaluation;
  const etat = etatEvaluation(e);
  // Par défaut : le sujet tant qu'il n'est pas distribué, puis les résultats.
  const onglet: Onglet = (ONGLETS as readonly string[]).includes(recherche.onglet ?? "") ? (recherche.onglet as Onglet) : e.distribueeLe ? "resultats" : "sujet";

  const [cours, suivi, banque, eleves] = await Promise.all([
    coursDuProfesseur(jeton),
    suiviEvaluation(jeton, prof),
    onglet === "sujet" && !e.distribueeLe ? banquePourEvaluation(jeton, e.coursId) : Promise.resolve([]),
    elevesDeLEspace(jeton, e.coursId),
  ]);
  const libelle = cours.find((c) => c.id === e.coursId)?.libelle ?? "Cours";
  const fenetre = e.support === "papier" ? "Sur papier" : [e.ouvreLe ? `ouvre ${heureLisible(e.ouvreLe)}` : null, e.fermeLe ? `ferme ${heureLisible(e.fermeLe)}` : null, e.dureeMinutes ? `${e.dureeMinutes} min par élève` : null].filter(Boolean).join(" · ") || "Ouverte sans limite";

  return (
    <>
      <Link href="/professeur/evaluations" className="meta mb-3 inline-flex items-center gap-1 no-underline">
        <ArrowLeft size={14} aria-hidden="true" /> Évaluations
      </Link>
      <TitreEspace
        titre={e.titre}
        sousTitre={`${libelle} · ${LIBELLES_MODE[e.mode]} · ${fenetre}`}
        action={<Etiquette ton={TON[etat]}>{LIBELLES_ETAT[etat]}</Etiquette>}
      />
      <div className="mt-6">
        <OngletsLiens
          etiquette="Parties de l'évaluation"
          onglets={[
            { href: "?onglet=sujet", libelle: "Sujet", compte: prof.questions.length, actif: onglet === "sujet" },
            { href: "?onglet=eleves", libelle: "Élèves", compte: eleves.length, actif: onglet === "eleves" },
            { href: "?onglet=correction", libelle: "Correction", compte: suivi.analyse.aCorrigerTotal || null, actif: onglet === "correction" },
            { href: "?onglet=resultats", libelle: "Résultats", actif: onglet === "resultats" },
          ]}
        />
        {onglet === "sujet" ? <OngletSujet prof={prof} banque={banque} eleves={eleves.length} /> : null}
        {onglet === "eleves" ? <OngletEleves prof={prof} suivi={suivi} /> : null}
        {onglet === "correction" ? <OngletCorrection prof={prof} suivi={suivi} questionId={recherche.question ?? null} /> : null}
        {onglet === "resultats" ? <OngletResultats prof={prof} suivi={suivi} /> : null}
      </div>

      <form action={archiverEvaluation} className="mt-12 print:hidden">
        <input type="hidden" name="evaluation" value={e.id} />
        <button type="submit" className="bouton bouton-compact bouton-discret">
          Archiver cette évaluation
        </button>
      </form>
    </>
  );
}

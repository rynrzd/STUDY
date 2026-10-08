import { redirect } from "next/navigation";
import { BookOpen, CircleHelp, ClipboardCheck, Library } from "lucide-react";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { devoirsDuProfesseur, seancesDuProfesseur } from "@/lib/espace-professeur";
import { seancesDuJour } from "@/lib/echeances";
import { QuestionsDesClasses } from "@/components/study/QuestionsDesClasses";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { agenda } from "@/lib/v6/eleve";
import { tableauProfesseur } from "@/lib/v6/professeur";
import { VueAccueilProfesseur } from "./vue";

/**
 * T01 — Accueil du professeur (R2). L'écran répond à une seule question :
 * « qu'est-ce que je prépare maintenant ? ». Une carte par classe (questions
 * sans réponse réelles), les priorités, l'agenda, puis les séances du jour et
 * les brouillons — un brouillon oublié est l'incident le plus coûteux du
 * produit : la classe arrive, et le cours n'est pas visible.
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
        <EnTetePage sourcil={personne.organisation} titre={`Bonjour ${personne.prenom}`} />
        <EtatVide
          icone={BookOpen}
          titre="Aucun cours ne vous est encore affecté."
          texte="Vos cours apparaissent ici dès que l'administration de votre établissement vous affecte à une classe et à une matière. C'est elle qui réalise cette opération, depuis son espace."
        />
      </>
    );
  }

  const maintenant = new Date();
  const [seances, devoirs, tableau, semaine] = await Promise.all([
    seancesDuProfesseur(jeton),
    devoirsDuProfesseur(jeton),
    tableauProfesseur(jeton, cours),
    agenda(jeton, maintenant, new Date(maintenant.getTime() + 7 * 86_400_000)),
  ]);
  const priorites = [
    { libelle: "Questions en attente", detail: "Questions d'élèves sans réponse dans vos salons", n: tableau.questionsEnAttente, href: "#questions", icone: CircleHelp },
    { libelle: "Copies à évaluer", detail: "Remises en attente de votre retour", n: tableau.copiesAEvaluer, href: "/professeur/devoirs", icone: ClipboardCheck },
    { libelle: "Réponses aux ateliers", detail: "Réponses d'élèves des sept derniers jours", n: tableau.reponsesAteliers, href: "/app/prof/ateliers", icone: Library },
  ];

  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const aujourdhui = seancesDuJour(seances);
  const brouillons = seances.filter((s) => s.state === "brouillon").slice(0, 8);
  const publiees = seances.filter((s) => s.state === "publiee").slice(0, 6);
  const devoirsOuverts = devoirs.filter((d) => d.state === "publiee").slice(0, 6);
  const questions = <QuestionsDesClasses jeton={jeton} />;
  const prenom = personne.prenom;
  const organisation = personne.organisation;

  return <VueAccueilProfesseur prenom={prenom} organisation={organisation} tableau={tableau} priorites={priorites} semaine={semaine} questions={questions} aujourdhui={aujourdhui} libelles={libelles} brouillons={brouillons} devoirsOuverts={devoirsOuverts} publiees={publiees} />;
}

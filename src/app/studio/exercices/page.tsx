import { redirect } from "next/navigation";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { seancesDuProfesseur } from "@/lib/espace-professeur";
import { coursDuProfesseur } from "@/lib/studio";
import { banqueExercices, corrigeDe } from "@/lib/v6/banque";
import { versConnexion } from "@/lib/v6/redirection";
import type { Params } from "./vue";
import { VueBanque } from "./vue";

export const metadata = { title: "Banque d'exercices" };
export const dynamic = "force-dynamic";

/**
 * T04 — Banque d'exercices : tous les exercices de vos enseignements,
 * filtrables (filtres dans l'URL), avec aperçu du corrigé réservé aux
 * professeurs et ajout à une autre séance (copie non publiée, 0060).
 */
export default async function PageBanque({ searchParams }: { searchParams: Promise<Params> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/studio/exercices"));
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/studio/exercices", "expiree"));
  const p = await searchParams;
  const difficultes = (Array.isArray(p.difficulte) ? p.difficulte : p.difficulte ? [p.difficulte] : []).map(Number).filter((n) => [1, 2, 3].includes(n));
  const miens = p.vue === "miens";

  const cours = await coursDuProfesseur(jeton);
  const [{ exercices, total, erreur }, seances] = await Promise.all([
    banqueExercices(jeton, personne.profileId, cours, { q: p.q, matiere: p.matiere, difficultes, type: p.type, miens, tri: p.tri === "anciens" ? "anciens" : "recents" }),
    seancesDuProfesseur(jeton, 120),
  ]);
  const ouvert = exercices.find((e) => e.version === p.ex) ?? null;
  const corrige = ouvert ? await corrigeDe(jeton, ouvert.version) : null;
  const matieres = [...new Set(cours.map((c) => c.matiere))].sort();
  const libelleCours = new Map(cours.map((c) => [c.id, c.libelle]));
  const choixSeances = seances.map((s) => ({ id: s.id, libelle: `${s.title} — ${libelleCours.get(s.teaching_space_id) ?? "Cours"}${s.state === "brouillon" ? " (brouillon)" : ""}` }));

  return <VueBanque p={p} miens={miens} total={total} exercices={exercices} erreur={erreur} ouvert={ouvert} corrige={corrige} matieres={matieres} difficultes={difficultes} choixSeances={choixSeances} />;
}

import { redirect } from "next/navigation";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import type { Annee, Apercu, ClasseAnnee, EleveSansClasse } from "./vue";
import { VueAnnees } from "./vue";

export const metadata = { title: "Années scolaires" };
export const dynamic = "force-dynamic";

/**
 * D05 — Passage d'année : préparer → classes → reconduire les élèves →
 * contrôler (liste nominative de ceux qui perdraient leur classe) → basculer.
 * Tous les contrôles sont en base (0059) ; rien n'est supprimé.
 */
export default async function PageAnnees() {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const client = clientUtilisateur(ctx.jeton);
  const [annees, classes] = await Promise.all([
    client.from("academic_years").select("id, label, starts_on, ends_on, is_current, archived_at").order("starts_on", { ascending: false }),
    client.from("classes").select("id, label, academic_year_id, archived_at").is("archived_at", null).order("label"),
  ]);
  const liste = (annees.data ?? []) as Annee[];
  const toutes = (classes.data ?? []) as ClasseAnnee[];
  const erreurAnnees = annees.error !== null;
  const courante = liste.find((a) => a.is_current) ?? null;
  const cible = liste.find((a) => !a.is_current && a.archived_at === null && (!courante || a.starts_on > courante.starts_on)) ?? null;

  const classesCourantes = courante ? toutes.filter((c) => c.academic_year_id === courante.id) : [];
  const classesCible = cible ? toutes.filter((c) => c.academic_year_id === cible.id) : [];
  const [apercu, sansClasse, effectifs] = cible
    ? await Promise.all([
        client.rpc("annee_apercu", { p_cible: cible.id }),
        client.rpc("annee_eleves_sans_classe", { p_cible: cible.id }),
        client.from("class_enrollments").select("class_id").is("ends_on", null).in("class_id", classesCourantes.map((c) => c.id)),
      ])
    : [null, null, null];
  const resume = ((apercu?.data ?? []) as Apercu[])[0] ?? null;
  const eleves = (sansClasse?.data ?? []) as EleveSansClasse[];
  const parClasse = new Map<string, number>();
  for (const e of (effectifs?.data ?? []) as { class_id: string }[]) parClasse.set(e.class_id, (parClasse.get(e.class_id) ?? 0) + 1);
  const debutSuivant = courante ? Number(courante.label.slice(0, 4)) + 1 : new Date().getFullYear();
  // Étape réelle, déduite de l'état en base (pas d'un paramètre d'adresse).
  const etape = !cible ? 1 : classesCible.length === 0 ? 2 : (resume?.inscriptions_cible ?? 0) === 0 ? 3 : 4;

  return <VueAnnees etape={etape} erreurAnnees={erreurAnnees} courante={courante} cible={cible} classesCourantes={classesCourantes} classesCible={classesCible} debutSuivant={debutSuivant} parClasse={parClasse} resume={resume} eleves={eleves} liste={liste} />;
}

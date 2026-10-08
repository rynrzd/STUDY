import { contexteApp } from "@/lib/v6/contexte";
import { revisionsCollectives } from "@/lib/v6/eleve";
import { consultations, decisions, droits as lireDroits, membres } from "@/lib/v6/classe";
import { VueClasse } from "./vue";

export const metadata = { title: "Ma classe" };
export const dynamic = "force-dynamic";

/**
 * A11 — Ma classe (maquettes R2 n° 3 et 5) : la consultation du moment en
 * encadré blush, les suites données aux idées et l'entraide en listes de
 * lignes, les délégués et l'adulte à qui écrire en colonne. Tous les
 * compteurs viennent de données autorisées pour cette personne et cette
 * classe, jamais d'un filtre côté client.
 */
export default async function PageClasse({ params }: { params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const [lesConsultations, lesDecisions, lesMembres, entraide, droits] = await Promise.all([
    consultations(ctx.jeton, classe),
    decisions(ctx.jeton, classe),
    membres(ctx.jeton, classe),
    revisionsCollectives(ctx.jeton, classe),
    lireDroits(ctx.jeton, classe),
  ]);
  const ouverte = lesConsultations.find((c) => c.etat === "ouverte" && c.fermeLe !== null && new Date(c.fermeLe) > new Date());
  const delegues = (lesMembres ?? []).filter((m) => m.role === "delegue");
  const principal = (lesMembres ?? []).find((m) => m.role === "professeur_principal");
  const suivies = lesDecisions.filter((d) => d.publiee).slice(0, 6);

  return <VueClasse ouverte={ouverte} classe={classe} droits={droits} suivies={suivies} entraide={entraide} delegues={delegues} principal={principal} />;
}

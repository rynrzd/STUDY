import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { AccesIndisponible } from "@/components/study/ui";
import { consultations, decisions, droits as lireDroits } from "@/lib/v6/classe";
import { FILTRES } from "./vue";
import { VuePropositions } from "./vue";

export const metadata = { title: "Propositions et suivi" };
export const dynamic = "force-dynamic";

/**
 * A14 — Vie de classe : propositions des délégués et leur suivi.
 *
 * Statuts réels (0050) : proposée → discutée → transmise → réponse reçue →
 * en cours → faite, ou non retenue (motif obligatoire). Les filtres
 * regroupent ces statuts ; chaque changement est journalisé (historique).
 * Faire une proposition et changer un statut : délégués et professeur
 * principal seulement (`anime_vie_de_classe`, vérifié en base). Les élèves
 * voient les propositions publiées ; aucune promesse d'anonymat n'est faite.
 */
export default async function PagePropositions({ params, searchParams }: { params: Promise<{ classe: string }>; searchParams: Promise<{ vue?: string; filtre?: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const { vue = "propositions", filtre = "toutes" } = await searchParams;
  const droits = await lireDroits(ctx.jeton, classe);
  if (!droits.membre) return <AccesIndisponible retour="/app/classe" />;
  const anime = droits.delegue || droits.principal;

  const [liste, lesConsultations] = await Promise.all([decisions(ctx.jeton, classe), consultations(ctx.jeton, classe)]);
  const ids = liste.map((d) => d.id);
  const { data: evenementsBruts } = ids.length
    ? await clientUtilisateur(ctx.jeton)
        .from("decision_evenements")
        .select("id, decision_id, de_statut, vers_statut, motif, created_at")
        .in("decision_id", ids)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const evenements = (evenementsBruts ?? []) as { id: number; decision_id: string; de_statut: string | null; vers_statut: string; motif: string | null; created_at: string }[];
  const parDecision = new Map<string, number>();
  for (const e of evenements) parDecision.set(e.decision_id, (parDecision.get(e.decision_id) ?? 0) + 1);
  const titres = new Map(liste.map((d) => [d.id, d.titre]));

  const filtreActif = FILTRES.find((f) => f.cle === filtre) ?? FILTRES[0];
  const compte = (statuts: readonly string[] | null) => liste.filter((d) => !statuts || statuts.includes(d.statut)).length;
  const visibles = liste.filter((d) => !filtreActif.statuts || (filtreActif.statuts as readonly string[]).includes(d.statut));
  const suivies = liste.filter((d) => d.statut === "en_cours");
  const ouverte = lesConsultations.find((c) => c.etat === "ouverte");
  const base = `/app/classes/${classe}/propositions`;

  return <VuePropositions classe={classe} vue={vue} anime={anime} liste={liste} ouverte={ouverte} base={base} filtreActif={filtreActif} compte={compte} visibles={visibles} suivies={suivies} parDecision={parDecision} evenements={evenements} titres={titres} />;
}

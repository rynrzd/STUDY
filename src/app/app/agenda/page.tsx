import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { agenda } from "@/lib/v6/eleve";
import { VueAgenda } from "./vue";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

function lundi(d: Date): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - jour);
  return r;
}

/**
 * E16 — Agenda : la semaine de cinq jours sur ordinateur, une liste sur
 * téléphone. Contrôles, rendus et créneaux sont distingués par un libellé
 * (la couleur n'est qu'un appui). On ne modifie que ses propres événements.
 * Fuseau affiché : Europe/Paris.
 */
export default async function PageAgenda({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const ctx = await contexteApp();
  const { semaine } = await searchParams;
  const base = semaine && /^\d{4}-\d{2}-\d{2}$/u.test(semaine) ? new Date(`${semaine}T12:00:00Z`) : new Date();
  const debut = new Date(lundi(base).getTime() + 12 * 3_600_000);
  const fin = new Date(debut.getTime() + 7 * 86_400_000);
  // Fenêtre élargie : lundi 0 h à Paris précède midi UTC de quatorze heures au plus.
  const evenements = await agenda(ctx.jeton, new Date(debut.getTime() - 14 * 3_600_000), new Date(fin.getTime() - 12 * 3_600_000));
  // Cibles collectives : seulement celles que l'équipe pédagogique peut renseigner.
  const cibles: { valeur: string; libelle: string }[] = [{ valeur: "moi", libelle: "Moi seulement" }];
  if (ctx.roles.professeur) {
    const { data } = await clientUtilisateur(ctx.jeton).rpc("mes_cours");
    for (const c of (data ?? []) as { id: string; matiere: string; classe: string | null; enseigne: boolean }[]) {
      if (c.enseigne) cibles.push({ valeur: `espace:${c.id}`, libelle: `${c.matiere}${c.classe ? ` — ${c.classe}` : ""}` });
    }
  }

  return <VueAgenda debut={debut} fin={fin} evenements={evenements} cibles={cibles} />;
}

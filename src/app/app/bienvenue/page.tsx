import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { mesCours } from "@/lib/v6/cours";
import { VueBienvenue } from "./vue";

export const metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

/**
 * A01 — Bienvenue : chaque repère est nourri par ce qui existe vraiment
 * (cours, devoirs publiés), lu sous la session de la personne. Seulement
 * après une appartenance active ; la demande en attente a son propre écran.
 */
export default async function PageBienvenue() {
  const ctx = await contexteApp();
  const [cours, devoirs] = await Promise.all([
    mesCours(ctx.jeton),
    clientUtilisateur(ctx.jeton).from("assignments").select("id", { count: "exact", head: true }).eq("state", "publiee"),
  ]);
  return (
    <VueBienvenue
      prenom={ctx.personne.prenom}
      classe={ctx.classeActive?.libelle ?? null}
      role={ctx.roles.admin ? "administration" : ctx.roles.professeur ? "professeur" : "élève"}
      matieres={cours ? cours.map((c) => c.matiere) : null}
      nbDevoirs={devoirs.count ?? 0}
    />
  );
}

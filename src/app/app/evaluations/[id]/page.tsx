import { CopieCorrigee } from "@/components/evaluations/CopieCorrigee";
import { Passation } from "@/components/evaluations/Passation";
import { AccesIndisponible, Encadre, EnTetePage } from "@/components/study/ui";
import { heureLisible } from "@/lib/evaluations/dates";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { evaluationDeLEleve, exercicesDesNotions, LIBELLES_MODE, maCopieCorrigee } from "@/lib/v6/evaluations";

export const metadata = { title: "Évaluation" };

/** Où en est la fenêtre d'ouverture, au moment de la requête. */
function fenetre(e: { ouvreLe: string | null; fermeLe: string | null; commenceeLe: string | null }): "avant" | "apres" | "ouverte" {
  const maintenant = Date.now();
  if (e.commenceeLe) return "ouverte";
  if (e.ouvreLe && Date.parse(e.ouvreLe) > maintenant) return "avant";
  if (e.fermeLe && Date.parse(e.fermeLe) <= maintenant) return "apres";
  return "ouverte";
}
export const dynamic = "force-dynamic";

/**
 * Une évaluation, côté élève : avant, pendant (passation), après (copie
 * rendue), puis la copie corrigée quand le professeur publie les résultats.
 */
export default async function PageEvaluationEleve({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexteApp();
  const { id } = await params;
  const e = await evaluationDeLEleve(ctx.jeton, ctx.personne.profileId, id);
  if (e === null) return <AccesIndisponible retour="/app/evaluations" />;
  const filAriane = [{ href: "/app/evaluations", libelle: "Évaluations" }];
  const sousTitre = `${LIBELLES_MODE[e.mode]}${e.support === "papier" ? " · sur papier" : e.dureeMinutes ? ` · ${e.dureeMinutes} min` : ""}`;

  if (e.resultatsPubliesLe) {
    const lignes = (await maCopieCorrigee(ctx.jeton, id)) ?? [];
    // Remise à niveau : les notions réussies à moins de moitié.
    const parNotion = new Map<string, { obtenus: number; max: number }>();
    for (const l of lignes) {
      if (!l.notionId) continue;
      const n = parNotion.get(l.notionId) ?? { obtenus: 0, max: 0 };
      n.obtenus += l.points ?? 0;
      n.max += l.pointsMax;
      parNotion.set(l.notionId, n);
    }
    const ratees = [...parNotion].filter(([, n]) => n.max > 0 && n.obtenus < 0.5 * n.max).map(([k]) => k);
    const [versions, photos] = await Promise.all([
      exercicesDesNotions(ctx.jeton, e.coursId, ratees),
      e.copieId
        ? clientUtilisateur(ctx.jeton).from("evaluation_photos").select("file_id").eq("copie_id", e.copieId).order("ordre").then((r) => ((r.data ?? []) as { file_id: string }[]).map((p) => p.file_id))
        : Promise.resolve([] as string[]),
    ]);
    return (
      <div className="mx-auto max-w-[820px]">
        <EnTetePage filAriane={filAriane} sourcil="Résultats" titre={e.titre} sousTitre={sousTitre} />
        <CopieCorrigee titre={e.titre} notation={e.notation} lignes={lignes} remiseANiveau={versions} photos={photos} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px]">
      <EnTetePage filAriane={filAriane} sourcil="Évaluation" titre={e.titre} sousTitre={sousTitre} />
      {e.support === "papier" ? (
        <Encadre titre="Cette évaluation se fait sur papier, en classe">
          Ton professeur saisit ta copie ; tu la retrouveras ici, corrigée, quand il publiera les résultats.
        </Encadre>
      ) : fenetre(e) === "avant" && e.ouvreLe ? (
        <Encadre titre="Pas encore ouverte">Elle ouvre {heureLisible(e.ouvreLe)}. Reviens à ce moment-là.</Encadre>
      ) : fenetre(e) === "apres" && e.fermeLe ? (
        <Encadre titre="Fermée">Cette évaluation a fermé {heureLisible(e.fermeLe)}. Tes résultats apparaîtront ici à leur publication.</Encadre>
      ) : (
        <Passation evaluation={e.id} titre={e.titre} consigne={e.consigne} dureeMinutes={e.dureeMinutes} dejaCommencee={Boolean(e.commenceeLe)} />
      )}
    </div>
  );
}

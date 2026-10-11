import { ClipboardCheck } from "lucide-react";
import { EnTetePage, Etiquette, EtatVide, Ligne, ListeLignes, type Ton } from "@/components/study/ui";
import { heureLisible } from "@/lib/evaluations/dates";
import { contexteApp } from "@/lib/v6/contexte";
import { evaluationsDeLEleve, LIBELLES_MODE, type EvaluationEleve } from "@/lib/v6/evaluations";

export const metadata = { title: "Évaluations" };
export const dynamic = "force-dynamic";

function situation(e: EvaluationEleve, maintenant = Date.now()): { libelle: string; ton: Ton; rang: number } {
  if (e.resultatsPubliesLe) return { libelle: "Résultats", ton: "succes", rang: 3 };
  if (e.rendueLe) return { libelle: "Rendue", ton: "neutre", rang: 2 };
  if (e.support === "papier") return { libelle: "Sur papier", ton: "neutre", rang: 2 };
  if (e.ouvreLe && Date.parse(e.ouvreLe) > maintenant) return { libelle: "À venir", ton: "rose", rang: 1 };
  if (e.fermeLe && Date.parse(e.fermeLe) <= maintenant) return { libelle: "Fermée", ton: "neutre", rang: 2 };
  return { libelle: e.commenceeLe ? "En cours" : "À faire", ton: "attention", rang: 0 };
}

/** Les évaluations de l'élève : à faire d'abord, puis à venir, rendues, résultats. */
export default async function PageEvaluationsEleve() {
  const ctx = await contexteApp();
  const evaluations = await evaluationsDeLEleve(ctx.jeton, ctx.personne.profileId);
  const triees = [...(evaluations ?? [])].map((e) => ({ e, s: situation(e) })).sort((a, b) => a.s.rang - b.s.rang);

  return (
    <div className="mx-auto max-w-[900px]">
      <EnTetePage sourcil="Évaluations" titre="Tes évaluations" sousTitre="Les contrôles de tes professeurs, et ta copie corrigée quand les résultats sont publiés." />
      {evaluations === null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          La liste n&apos;a pas pu être chargée.
        </p>
      ) : triees.length === 0 ? (
        <EtatVide icone={ClipboardCheck} titre="Aucune évaluation pour l'instant" texte="Quand un professeur te donne une évaluation, elle apparaît ici." />
      ) : (
        <ListeLignes etiquette="Évaluations">
          {triees.map(({ e, s }) => (
            <Ligne
              key={e.id}
              href={`/app/evaluations/${e.id}`}
              icone={ClipboardCheck}
              titre={e.titre}
              detail={[
                LIBELLES_MODE[e.mode],
                e.support === "en_ligne" && e.dureeMinutes ? `${e.dureeMinutes} min` : null,
                s.libelle === "À venir" && e.ouvreLe ? `ouvre ${heureLisible(e.ouvreLe)}` : null,
                s.libelle === "À faire" && e.fermeLe ? `jusqu'à ${heureLisible(e.fermeLe)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              fin={<Etiquette ton={s.ton}>{s.libelle}</Etiquette>}
            />
          ))}
        </ListeLignes>
      )}
    </div>
  );
}

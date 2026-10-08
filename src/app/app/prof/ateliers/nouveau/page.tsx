import { AccesIndisponible, EnTetePage } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { AssistantAtelier } from "../../../ateliers/AssistantAtelier";
import { espacesEnseignes } from "../espaces";

export const metadata = { title: "Nouvel atelier" };
export const dynamic = "force-dynamic";

/** T05 — étape 1 d'un nouvel atelier ; l'atelier est créé en brouillon à l'enregistrement. */
export default async function PageNouvelAtelier() {
  const ctx = await contexteApp();
  if (!ctx.roles.professeur) return <AccesIndisponible />;
  const espaces = await espacesEnseignes(ctx.jeton);
  return (
    <div className="mx-auto max-w-[900px]">
      <EnTetePage filAriane={[{ href: "/app/prof/ateliers", libelle: "Ateliers" }]} sourcil="Éditeur d’atelier" titre="Nouvel atelier" sousTitre="Croiser une question, des documents datés et, si besoin, une réponse à vérifier." />
      <AssistantAtelier
        etape={1}
        espaces={espaces}
        donnees={{ id: null, kind: "actualite", titre: "", question: "", consigne: "", texte: "", sources: [], corrige: "", cours: null }}
      />
    </div>
  );
}

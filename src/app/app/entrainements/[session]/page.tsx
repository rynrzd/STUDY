import { AccesIndisponible, EnTetePage, EtatVide } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { etatEntrainement } from "@/lib/v6/fiches";
import { Entrainement } from "./Entrainement";

export const metadata = { title: "Entraînement" };
export const dynamic = "force-dynamic";

/** E07 — une question par écran ; correction serveur ; reprise là où on s'était arrêté. */
export default async function PageEntrainement({ params }: { params: Promise<{ session: string }> }) {
  const ctx = await contexteApp();
  const { session } = await params;
  const etat = await etatEntrainement(ctx.jeton, session);
  if (etat === null) return <AccesIndisponible retour="/app/reviser" />;
  return (
    <div className="mx-auto max-w-[760px]">
      <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]} sourcil="Entraînement" titre={etat.titre} />
      {etat.questions.length === 0 ? (
        <EtatVide titre="Ces exercices ne sont plus disponibles" texte="Ils ont été retirés ou ne font plus partie de tes cours." />
      ) : (
        <Entrainement session={session} questions={etat.questions} />
      )}
    </div>
  );
}

import { AccesIndisponible, EnTetePage, EtatVide } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { lireFiche } from "@/lib/v6/fiches";
import { PaquetCartes } from "./PaquetCartes";

export const metadata = { title: "Cartes mémoire" };
export const dynamic = "force-dynamic";

/** E06 — Cartes mémoire : rappel actif, sans avance automatique ni chronomètre. */
export default async function PageCartes({ params }: { params: Promise<{ fiche: string }> }) {
  const ctx = await contexteApp();
  const { fiche: id } = await params;
  const fiche = await lireFiche(ctx.jeton, id);
  if (fiche === null) return <AccesIndisponible retour="/app/reviser" />;
  return (
    <div className="mx-auto max-w-[760px]">
      <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }, { href: `/app/fiches/${id}`, libelle: fiche.titre }]} titre="Cartes mémoire" />
      {!fiche.sourcesLisibles || !fiche.cartes || fiche.cartes.length === 0 ? (
        <EtatVide titre="Pas de cartes à réviser" texte={fiche.sourcesLisibles ? "Cette fiche ne contient pas de cartes." : "Une source de ces cartes n'est plus accessible."} />
      ) : (
        <PaquetCartes fiche={id} cartes={fiche.cartes.map((c) => ({ recto: c.recto, verso: c.verso, lesson: c.citation.lessonId, ref: c.citation.ref }))} />
      )}
    </div>
  );
}

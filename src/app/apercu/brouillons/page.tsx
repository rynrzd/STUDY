import { GardienBrouillons } from "@/components/study/connexion/NettoyageLocal";
import { NotePrivee } from "@/components/study/NotePrivee";

/**
 * Aperçu de développement : reprise d'un brouillon après expiration de
 * session. `?proprietaire=` simule la personne connectée.
 */
export default async function ApercuBrouillons({ searchParams }: { searchParams: Promise<{ proprietaire?: string }> }) {
  const { proprietaire = "personne-a" } = await searchParams;
  return (
    <main id="contenu" className="mx-auto max-w-[640px] p-6">
      <p className="meta">Aperçu de développement · données fictives · propriétaire {proprietaire}</p>
      <GardienBrouillons proprietaire={proprietaire}>
        <NotePrivee key={proprietaire} proprietaire={proprietaire} autoriserBrouillon seance="00000000-0000-4000-8000-0000000000a1" initiale="" revision={0} />
      </GardienBrouillons>
    </main>
  );
}

import { AccesIndisponible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesCours, seancesParChapitre } from "@/lib/v6/cours";
import { VueUnCours } from "./vue";

export const metadata = { title: "Cours" };
export const dynamic = "force-dynamic";

/**
 * A04 — Un cours (maquettes R2 n° 1 et 3) : une fiche de cours en tête
 * (matière, classe, professeurs, nombre de séances), puis les chapitres en
 * listes de lignes. Seules les séances publiées et autorisées apparaissent.
 */
export default async function PageUnCours({ params }: { params: Promise<{ cours: string }> }) {
  const ctx = await contexteApp();
  const { cours: id } = await params;
  const tous = await mesCours(ctx.jeton);
  const cours = tous?.find((c) => c.id === id) ?? null;
  // Un cours d'une autre classe n'est pas « introuvable » ni « interdit » : il n'est pas accessible.
  if (tous !== null && cours === null) return <AccesIndisponible retour="/app/cours" />;

  const chapitres = cours === null ? null : await seancesParChapitre(ctx.jeton, cours.id);
  const nbSeances = chapitres?.reduce((n, ch) => n + ch.seances.length, 0) ?? 0;
  const requete = chapitres === null ? idRequete() : null;

  return <VueUnCours id={id} cours={cours} chapitres={chapitres} nbSeances={nbSeances} requete={requete} />;
}

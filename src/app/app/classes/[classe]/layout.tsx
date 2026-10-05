import { AccesIndisponible } from "@/components/study/ui";
import { OngletsClasse } from "@/components/study/OngletsClasse";
import { contexteApp } from "@/lib/v6/contexte";
import { classe as lireClasse, droits as lireDroits } from "@/lib/v6/classe";

export const dynamic = "force-dynamic";

/**
 * Gabarit d'une classe — E10. L'appartenance est relue en base : un élève
 * d'une autre classe qui tape l'adresse obtient « pas accessible », sans le
 * nom de la classe ni le moindre compteur (RLS-01).
 */
export default async function GabaritClasse({ children, params }: { children: React.ReactNode; params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe: id } = await params;
  const [laClasse, droits] = await Promise.all([lireClasse(ctx.jeton, id), lireDroits(ctx.jeton, id)]);
  const adminVoit = ctx.roles.admin && laClasse !== null;
  if (laClasse === null || (!droits.membre && !droits.responsable && !adminVoit)) {
    return <AccesIndisponible retour="/app" />;
  }
  return (
    <>
      <OngletsClasse classe={id} libelle={laClasse.libelle} delegues={droits.delegue || droits.principal} gestion={droits.responsable || droits.enseignant || adminVoit} />
      {children}
    </>
  );
}

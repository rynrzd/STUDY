import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesSalons } from "@/lib/v6/messagerie";
import { VueMessagerie } from "./vue";

export const metadata = { title: "Messagerie" };
export const dynamic = "force-dynamic";

/**
 * A12 — Messagerie (maquette R2 n° 3, « Ma classe ») : les salons en lignes à
 * tuile, non-lus calculés côté base. Sur téléphone : liste → salon → fil.
 * Les demandes personnelles à un adulte ont leur propre circuit, distinct.
 */
export default async function PageMessagerie() {
  const ctx = await contexteApp();
  const salons = await mesSalons(ctx.jeton);
  const requete = salons === null ? idRequete() : null;

  return <VueMessagerie salons={salons} requete={requete} />;
}

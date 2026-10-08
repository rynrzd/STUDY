import { contexteApp } from "@/lib/v6/contexte";
import { mesFiches } from "@/lib/v6/fiches";
import { suggestionsDeRevision } from "@/lib/v6/revision";
import { VueReviser } from "./vue";

export const metadata = { title: "Réviser" };
export const dynamic = "force-dynamic";

/**
 * A06 — Réviser (maquettes R2 n° 1 et 3) : d'abord ce qui est dû (les
 * suggestions calculées par le serveur), puis les activités, puis les fiches
 * de l'élève. Aucune note, aucun classement : des repères pour soi.
 */
export default async function PageReviser({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const ctx = await contexteApp();
  const { erreur } = await searchParams;
  const [fiches, priorites] = await Promise.all([mesFiches(ctx.jeton), suggestionsDeRevision(ctx.jeton, { limite: 5 })]);

  return <VueReviser erreur={erreur} fiches={fiches} priorites={priorites} />;
}

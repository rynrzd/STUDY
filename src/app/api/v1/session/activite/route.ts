import { marquerActivite, sessionCourante } from "@/lib/session-serveur";

export async function POST() {
  // La protection d'origine reste celle du proxy, comme pour les autres mutations.
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await marquerActivite(personne);
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

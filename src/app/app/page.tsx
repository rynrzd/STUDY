import { redirect } from "next/navigation";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

/**
 * `/app` — l'aiguillage par rôle du cahier V2, §21.
 *
 * C'est l'adresse à donner quand on ne sait pas qui va cliquer : le logo de la
 * barre, un lien dans un courriel, un signet partagé entre un professeur et un
 * élève. Elle ne rend rien, elle redirige — et le rôle est relu en base, jamais
 * pris dans l'URL.
 */
export const dynamic = "force-dynamic";

export default async function PageApp() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  redirect(destinationApresConnexion(personne));
}

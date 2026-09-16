import { redirect } from "next/navigation";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

/**
 * Aiguillage après connexion.
 *
 * La destination dépend du rôle, et le rôle est relu en base : il ne transite
 * jamais par un champ de formulaire ni par un paramètre d'URL. Cette page
 * n'affiche rien — elle redirige.
 */
export const dynamic = "force-dynamic";

export default async function PageApresConnexion() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  redirect(destinationApresConnexion(personne));
}

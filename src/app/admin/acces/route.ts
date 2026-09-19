import { csvAcces, listeAcces } from "@/lib/acces";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Export des accès — cahier V5, §7.2.
 *
 * L'adresse n'est pas publique et ne peut pas le devenir : le rôle est relu à
 * chaque appel depuis la session, et la liste est celle que
 * `study.etab_acces` rend pour **cet** établissement. Un lien copié puis
 * ouvert ailleurs, ou déconnecté, ne rend rien.
 *
 * Le fichier ne contient aucun mot de passe. Ce n'est pas un oubli : ils ne
 * sont conservés nulle part, et un export qui en porterait serait une liste
 * d'accès complète circulant par courriel.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const personne = await sessionCourante();

  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    // Pas de 403 bavard : l'adresse se comporte comme si elle n'existait pas.
    return new Response("Introuvable.", { status: 404 });
  }

  const adresse = new URL(requete.url);
  const classe = adresse.searchParams.get("classe");
  const filtre = classe !== null && UUID.test(classe) ? classe : undefined;

  const lignes = await listeAcces(personne.profileId, filtre);
  const contenu = csvAcces(lignes);

  const jour = new Date().toISOString().slice(0, 10);

  return new Response(contenu, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="acces-avecstudy-${jour}.csv"`,
      // Un export d'identifiants ne se met pas en cache, ni chez le client ni
      // sur un intermédiaire.
      "cache-control": "no-store, private",
    },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

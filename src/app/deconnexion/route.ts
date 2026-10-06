import { NextResponse } from "next/server";
import { DepotSupabase } from "@/lib/depot-authentification";
import { cookieSessionSupprime, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * POST /deconnexion — fermer sa session, ou toutes ses sessions.
 *
 * Une route plutôt qu'une action serveur, pour une seule raison : poser
 * l'en-tête `Clear-Site-Data`, qui demande au navigateur d'effacer les caches
 * et le stockage local de Study (brouillons, copies hors ligne, service
 * worker). Les cookies ne sont pas visés : la préférence d'effets et
 * l'établissement mémorisé sur un appareil personnel survivent ; aucun ne
 * contient de donnée de compte. Les navigateurs qui ignorent l'en-tête sont
 * couverts par un nettoyage côté page sur `/connexion?fin=1`.
 *
 * La vérification d'origine du proxy s'applique (méthode POST) : un site
 * tiers ne peut pas déconnecter quelqu'un.
 *
 * Ce que ni l'en-tête ni le nettoyage ne touchent : les fichiers téléchargés,
 * l'historique et les mots de passe enregistrés par le navigateur.
 */
export async function POST(requete: Request) {
  let partout = false;
  try {
    partout = (await requete.formData()).get("partout") === "oui";
  } catch {
    // Corps absent : déconnexion simple.
  }

  const cookieEntrant = requete.headers.get("cookie") ?? "";
  const jeton = cookieEntrant
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NOM_COOKIE_SESSION}=`))
    ?.slice(NOM_COOKIE_SESSION.length + 1);

  const depot = new DepotSupabase();
  try {
    if (partout) {
      const personne = await sessionCourante();
      if (personne !== null) await depot.revoquerSessions(personne.profileId, "deconnexion_partout");
    }
    if (jeton) await depot.revoquerSession(empreinteJeton(decodeURIComponent(jeton)), "deconnexion");
  } catch {
    // Le cookie est retiré quoi qu'il arrive : on ne laisse pas un écran
    // connecté parce que la base a hoqueté.
  }

  const reponse = NextResponse.redirect(new URL(`/connexion?fin=${partout ? "partout" : "1"}`, requete.url), 303);
  const supprime = cookieSessionSupprime();
  reponse.cookies.set(supprime.name, "", { httpOnly: true, secure: supprime.secure, sameSite: "lax", path: "/", maxAge: 0 });
  reponse.headers.set("Clear-Site-Data", '"cache", "storage"');
  reponse.headers.set("Cache-Control", "no-store");
  return reponse;
}

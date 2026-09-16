"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DepotSupabase } from "@/lib/depot-authentification";
import { cookieSessionSupprime, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";

/**
 * Déconnexion réelle.
 *
 * Deux gestes, et les deux comptent : la session est **révoquée en base** — le
 * jeton devient inutilisable même si quelqu'un a copié le cookie — puis le
 * cookie est supprimé du navigateur. Effacer le cookie seul laisserait une
 * session valide côté serveur ; c'est le défaut classique d'une déconnexion de
 * façade.
 */
export async function seDeconnecter(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE_SESSION)?.value;

  if (jeton !== undefined && jeton !== "") {
    try {
      await new DepotSupabase().revoquerSession(empreinteJeton(jeton), "deconnexion");
    } catch {
      // La suppression du cookie a lieu quoi qu'il arrive : on ne laisse pas
      // une personne devant un écran connecté parce que la base a hoqueté.
    }
  }

  const supprime = cookieSessionSupprime();
  magasin.set(supprime.name, supprime.value, {
    httpOnly: supprime.httpOnly,
    secure: supprime.secure,
    sameSite: supprime.sameSite,
    path: supprime.path,
    maxAge: 0,
  });

  redirect("/connexion?fin=1");
}

"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { idRequete } from "@/lib/v6/contexte";
import { versConnexion } from "@/lib/v6/redirection";

/**
 * Rejoindre une classe — E32, dossier V6 §6.2.
 *
 * Le code ne remplace pas l'authentification : il faut être connecté. Il ne
 * donne aucun accès : il prépare une demande que la classe validera. Le code
 * en clair ne quitte pas cette fonction ; seule son empreinte va en base.
 */

const MESSAGES: Record<string, string> = {
  code_inconnu: "Ce code ne correspond à aucune classe. Vérifiez-le auprès de la personne qui vous l'a donné.",
  code_expire: "Ce code a expiré. Demandez-en un nouveau à votre professeur principal ou à la vie scolaire.",
  code_revoque: "Ce code n'est plus valable : un nouveau code a été créé pour cette classe.",
  trop_essais: "Trop d'essais. Réessayez dans une heure, ou demandez de l'aide à la vie scolaire.",
};

function normaliserCode(brut: string): string {
  return brut.toUpperCase().replace(/[^A-Z0-9]/gu, "");
}

export async function rejoindre(_precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/rejoindre"));
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/rejoindre", "expiree"));

  const code = normaliserCode(String(donnees.get("code") ?? ""));
  if (code.length !== 10) {
    return { ok: false, message: "Le code compte 10 caractères.", champs: { code: ["Le code compte 10 lettres ou chiffres."] }, valeurs: { code } };
  }
  const empreinte = createHash("sha256").update(code).digest();
  const requestId = idRequete();
  const { data, error } = await clientUtilisateur(jeton).rpc("classe_rejoindre", { p_empreinte: `\\x${empreinte.toString("hex")}` });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "rejoindre", code: error.code, requestId }));
    return { ok: false, message: "La demande n'a pas pu être envoyée. Réessayez dans un instant.", requestId, valeurs: { code } };
  }
  const ligne = ((data ?? []) as { etat: string; classe: string | null }[])[0];
  if (!ligne) return { ok: false, message: "La demande n'a pas pu être envoyée.", requestId, valeurs: { code } };
  if (ligne.etat === "en_attente") redirect("/acces-en-attente?envoyee=1");
  if (ligne.etat === "deja_membre") {
    return { ok: true, message: `Vous faites déjà partie de la classe ${ligne.classe ?? ""}. Ouvrez votre espace pour la retrouver.` };
  }
  return { ok: false, message: MESSAGES[ligne.etat] ?? "Ce code n'est pas utilisable.", valeurs: { code }, champs: { code: [MESSAGES[ligne.etat] ?? ""] } };
}

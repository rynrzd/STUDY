"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messageDeRefus, tenterConnexion } from "@/lib/authentification";
import { chiffrer, lireCles } from "@/lib/chiffrement";
import { DepotSupabase } from "@/lib/depot-authentification";
import { FournisseurSupabase } from "@/lib/fournisseur-supabase";
import { cookieSession, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";
import { baseConfiguree } from "@/lib/supabase-serveur";

/**
 * Connexion — section 5.1 du cahier de finition.
 *
 * Toute la logique sensible vit dans `tenterConnexion` : ordre des contrôles,
 * non-divulgation, limitation des tentatives. Cette action se contente de
 * valider la saisie, d'appeler cette fonction et de poser le cookie.
 *
 * Trois points qui se jouent ici et nulle part ailleurs :
 *
 *  - **Rotation de session.** Le cookie éventuellement présent est révoqué
 *    avant qu'un nouveau soit émis : un jeton posé par un tiers sur un poste
 *    partagé ne survit pas à la connexion de la personne suivante.
 *  - **Cookie HttpOnly, Secure, SameSite=Lax, préfixe `__Host-`** en
 *    production : il est donc lié à l'origine exacte et inaccessible au script.
 *  - **Redirection selon le rôle**, décidée côté serveur à partir de la base,
 *    jamais d'un champ envoyé par le navigateur.
 */

const schemaConnexion = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/, "Code invalide"),
  identifiant: z.string().trim().min(2).max(40),
  motDePasse: z.string().min(1).max(200),
  postePartage: z.boolean(),
});

import type { EtatConnexion } from "./etats";

const REFUS_SAISIE: EtatConnexion = {
  etat: "refus",
  // Exactement le même message que pour un mot de passe faux : une saisie mal
  // formée ne doit pas se distinguer d'un compte inconnu.
  message:
    "Code établissement, identifiant ou mot de passe incorrect. " +
    "Si vous avez perdu vos identifiants, adressez-vous à votre établissement.",
};

export async function seConnecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  if (!baseConfiguree()) {
    return {
      etat: "refus",
      message:
        "La connexion est momentanément indisponible. Aucune information n'a été perdue ; réessayez dans quelques minutes.",
    };
  }

  const analyse = schemaConnexion.safeParse({
    code: donnees.get("code"),
    identifiant: donnees.get("identifiant"),
    motDePasse: donnees.get("motDePasse"),
    postePartage: donnees.get("postePartage") === "oui",
  });

  if (!analyse.success) return REFUS_SAISIE;

  const saisie = analyse.data;
  const magasin = await cookies();

  // Rotation : la session éventuellement présente est révoquée d'abord.
  const ancien = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (ancien !== undefined && ancien !== "") {
    try {
      await new DepotSupabase().revoquerSession(empreinteJeton(ancien), "rotation_connexion");
    } catch {
      // Une session déjà expirée ou inconnue n'empêche pas de se connecter.
    }
  }

  const cles = lireCles();

  const resultat = await tenterConnexion(
    {
      codeEtablissement: saisie.code,
      identifiant: saisie.identifiant,
      secret: saisie.motDePasse,
      appareil: saisie.postePartage ? "partage" : "personnel",
    },
    {
      depot: new DepotSupabase(),
      fournisseur: new FournisseurSupabase(),
      chiffrer: (clair) => chiffrer(clair, cles),
    },
  );

  if (!resultat.reussi) {
    return {
      etat: "refus",
      message: messageDeRefus(resultat),
      reprendreDansSecondes: resultat.reprendreDansSecondes,
    };
  }

  const cookie = cookieSession(resultat.jetonSession, resultat.dureeSecondes);
  magasin.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });

  // L'ardoise des tentatives est effacée : cinq fautes de frappe le matin ne
  // doivent pas ralentir la connexion de l'après-midi.
  try {
    await new DepotSupabase().effacerEchecs(resultat.profileId);
  } catch {
    // Sans importance : la purge périodique s'en charge de toute façon.
  }

  // `redirect` lève : rien de ce qui suit ne s'exécute.
  redirect(resultat.activationRequise ? "/activation" : "/app");
}

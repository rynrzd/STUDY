"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { ouvrirSessionVerifiee } from "@/lib/authentification";
import { chiffrer, lireCles } from "@/lib/chiffrement";
import { lireGroupe } from "@/lib/config";
import { DepotSupabase, DepotSupabaseDirect } from "@/lib/depot-authentification";
import { controlerMotDePasse, MESSAGES_MOT_DE_PASSE } from "@/lib/mot-de-passe";
import { schemaConfirmationProfesseur } from "@/lib/confirmation-professeur";
import { cookieSession, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";
import { baseConfiguree, clientAuthentification, clientExploitation } from "@/lib/supabase-serveur";
import type { EtatInscriptionProfesseur } from "./etats";

const schema = z.object({
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(180),
});

export async function inscrireProfesseur(_precedent: EtatInscriptionProfesseur, donnees: FormData): Promise<EtatInscriptionProfesseur> {
  const valeurs = {
    prenom: String(donnees.get("prenom") ?? "").slice(0, 80),
    nom: String(donnees.get("nom") ?? "").slice(0, 80),
    email: String(donnees.get("email") ?? "").slice(0, 180).toLowerCase(),
  };
  const motDePasse = String(donnees.get("motDePasse") ?? "").slice(0, 200);
  const confirmation = String(donnees.get("confirmation") ?? "").slice(0, 200);
  const resultat = schema.safeParse(valeurs);
  const champs: EtatInscriptionProfesseur["champs"] = {};
  if (!resultat.success) {
    for (const erreur of resultat.error.issues) champs[erreur.path[0] as "prenom" | "nom" | "email"] = erreur.path[0] === "email" ? "Indique une adresse e-mail valide." : "Ce champ est obligatoire.";
  }
  const controle = controlerMotDePasse({ nouveau: motDePasse, confirmation });
  if (!controle.accepte && controle.motif) champs[controle.motif === "confirmation_differente" ? "confirmation" : "motDePasse"] = MESSAGES_MOT_DE_PASSE[controle.motif];
  if (Object.keys(champs).length > 0) return { etat: "refus", message: "Vérifie les champs indiqués.", champs, valeurs };
  if (!baseConfiguree()) return { etat: "refus", message: "Le service de création de compte est momentanément indisponible.", valeurs };

  const email = valeurs.email.trim();
  const auth = clientAuthentification();
  const { data, error } = await auth.auth.signUp({
    email,
    password: motDePasse,
    options: {
      emailRedirectTo: adresseAcces("confirmation"),
      data: { prenom_avecstudy: valeurs.prenom.trim(), nom_avecstudy: valeurs.nom.trim() },
    },
  });
  const attente: EtatInscriptionProfesseur = {
    etat: "envoyee",
    valeurs,
    message: "Vérifie ta boîte mail et les indésirables, puis saisis ton code à 6 chiffres ci-dessous. Tu peux demander un nouveau code ou corriger l’adresse.",
  };
  if (error) console.warn(JSON.stringify({ niveau: "avertissement", contexte: "inscription_professeur", code: error.code ?? error.status }));
  if (data.session) {
    await auth.auth.signOut({ scope: "local" });
    console.error(JSON.stringify({ niveau: "erreur", contexte: "inscription_professeur", code: "confirmation_auth_requise" }));
  }
  return attente;
}

function adresseAcces(mode: "confirmation" | "recuperation") {
  return new URL(`/inscription/professeur/acces?mode=${mode}`, lireGroupe("base").APP_ORIGIN).href;
}

const emailValide = z.string().trim().toLowerCase().email().max(180);
const jetonValide = z.string().regex(/^[a-zA-Z0-9_-]{20,200}$/u);

export async function envoyerLienProfesseur(
  mode: "confirmation" | "recuperation", _precedent: EtatInscriptionProfesseur, donnees: FormData,
): Promise<EtatInscriptionProfesseur> {
  const email = emailValide.safeParse(donnees.get("email"));
  if (!email.success) return { etat: "refus", message: "Indique une adresse e-mail valide." };
  if (!baseConfiguree()) return { etat: "refus", message: "L’envoi d’e-mails est momentanément indisponible. Réessaie plus tard." };
  const auth = clientAuthentification().auth;
  const retour = adresseAcces(mode);
  const { error } = mode === "confirmation"
    ? await auth.resend({ type: "signup", email: email.data, options: { emailRedirectTo: retour } })
    : await auth.resetPasswordForEmail(email.data, { redirectTo: retour });
  if (error) {
    console.warn(JSON.stringify({ niveau: "avertissement", contexte: "courrier_professeur", mode, code: error.code ?? error.status }));
  }
  return {
    etat: "envoyee",
    message: mode === "confirmation"
      ? "Si un code peut être envoyé à cette adresse, vérifie ta boîte et les indésirables. Attends quelques minutes avant de réessayer."
      : "Si un lien peut être envoyé à cette adresse, vérifie ta boîte et les indésirables. Attends quelques minutes avant de réessayer.",
  };
}

export async function confirmerCodeProfesseur(
  _etat: EtatInscriptionProfesseur, donnees: FormData,
): Promise<EtatInscriptionProfesseur> {
  const verification = schemaConfirmationProfesseur.safeParse({ email: donnees.get("email"), code: donnees.get("code") });
  if (!verification.success) {
    return { etat: "refus", message: "Vérifie l’adresse e-mail et le code à 6 chiffres." };
  }
  if (!baseConfiguree()) {
    return { etat: "refus", message: "La validation est momentanément indisponible. Réessaie plus tard." };
  }
  const auth = clientAuthentification().auth;
  const { data, error } = await auth.verifyOtp({
    email: verification.data.email, token: verification.data.code, type: "signup",
  });
  if (error || !data.user?.email_confirmed_at || !data.session) {
    return { etat: "refus", message: "Ce code est incorrect, expiré ou a déjà servi. Vérifie-le ou demande un nouveau code." };
  }
  return preparerCompteProfesseur(auth, data.user, data.session);
}

export async function confirmerAdresse(jeton: string, _etat: EtatInscriptionProfesseur): Promise<EtatInscriptionProfesseur> {
  if (!jetonValide.safeParse(jeton).success || !baseConfiguree()) {
    return { etat: "refus", message: "Le lien est inutilisable pour le moment. Tu peux demander un nouveau lien." };
  }
  const auth = clientAuthentification().auth;
  const { data, error } = await auth.verifyOtp({ token_hash: jeton, type: "signup" });
  if (error || !data.user?.email_confirmed_at || !data.session) {
    return { etat: "refus", message: "Ce lien a expiré ou a déjà servi. Demande un nouveau lien ou connecte-toi." };
  }
  return preparerCompteProfesseur(auth, data.user, data.session);
}

async function preparerCompteProfesseur(
  auth: ReturnType<typeof clientAuthentification>["auth"], utilisateur: User, session: Session,
): Promise<EtatInscriptionProfesseur> {
  // Le jeton de confirmation atteste l’adresse, et le type « signup » limite
  // cette création au parcours d’inscription. Les métadonnées portent les noms.
  const valeurs = schema.safeParse({
    prenom: utilisateur.user_metadata.prenom_avecstudy,
    nom: utilisateur.user_metadata.nom_avecstudy,
    email: utilisateur.email,
  });
  if (!valeurs.success) {
    await auth.signOut({ scope: "local" });
    return { etat: "refus", message: "L’espace professeur n’a pas pu être préparé. Contacte l’assistance." };
  }
  const { error: preparation } = await clientExploitation("administration_des_comptes").rpc("professeur_autonome_preparer", {
    p_profile: utilisateur.id,
    p_prenom: valeurs.data.prenom,
    p_nom: valeurs.data.nom,
    p_email: valeurs.data.email,
  });
  if (preparation) {
    await auth.signOut({ scope: "local" });
    console.error(JSON.stringify({ niveau: "erreur", contexte: "preparation_professeur", code: preparation.code }));
    return { etat: "refus", message: "L’espace professeur n’a pas pu être préparé. Contacte l’assistance." };
  }

  // Un code valide ne suffit pas à créer notre cookie : les droits sont relus
  // en base. Seul un professeur actif dans un espace autonome y a accès.
  try {
    const depot = new DepotSupabaseDirect();
    const identite = await depot.resoudreIdentifiant("DIRECT", valeurs.data.email);
    if (!identite || identite.profileId !== utilisateur.id || !identite.organizationId ||
        identite.accountState !== "actif" || identite.mustChangePassword) {
      throw new Error("identite_non_active");
    }
    const { data: appartenances, error: lecture } = await clientExploitation("administration_des_comptes")
      .from("organization_memberships")
      .select("organization_id, organizations!inner(autonome)")
      .eq("profile_id", utilisateur.id)
      .eq("organization_id", identite.organizationId)
      .eq("state", "active")
      .eq("account_state", "actif")
      .eq("organizations.autonome", true)
      .contains("roles", ["professeur"])
      .limit(1);
    if (lecture || !appartenances?.length) throw new Error("droits_professeur_absents");

    const resultat = await ouvrirSessionVerifiee(identite, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expireLe: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in) * 1000),
      niveauAssurance: "aal1",
    }, "personnel", { depot, chiffrer: (texte) => chiffrer(texte, lireCles()) });
    if (!resultat) throw new Error("session_non_autorisee");

    const magasin = await cookies();
    const ancienne = magasin.get(NOM_COOKIE_SESSION)?.value;
    if (ancienne) {
      try { await new DepotSupabase().revoquerSession(empreinteJeton(ancienne), "rotation_confirmation"); }
      catch { /* Une session précédente expirée ne bloque pas l'arrivée. */ }
    }
    const cookie = cookieSession(resultat.jetonSession, resultat.dureeSecondes);
    magasin.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite,
      path: cookie.path, maxAge: cookie.maxAge,
    });
  } catch (e) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "connexion_apres_code_professeur", code: e instanceof Error ? e.message : "inconnu" }));
    // En cas de panne de la session applicative, le compte confirmé existe
    // toujours : la connexion classique avec son mot de passe reste possible.
    redirect("/connexion?confirmation=1");
  }
  redirect("/professeur?bienvenue=1");
}

export async function reinitialiserProfesseur(
  jeton: string, _etat: EtatInscriptionProfesseur, donnees: FormData,
): Promise<EtatInscriptionProfesseur> {
  const nouveau = String(donnees.get("motDePasse") ?? "");
  const controle = controlerMotDePasse({ nouveau, confirmation: String(donnees.get("confirmation") ?? "") });
  if (!controle.accepte) return { etat: "refus", message: MESSAGES_MOT_DE_PASSE[controle.motif!] };
  if (!jetonValide.safeParse(jeton).success || !baseConfiguree()) {
    return { etat: "refus", message: "Le lien est inutilisable pour le moment. Demande un nouveau lien." };
  }
  const auth = clientAuthentification().auth;
  const { data, error } = await auth.verifyOtp({ token_hash: jeton, type: "recovery" });
  if (error || !data.user?.email_confirmed_at || !data.session) {
    return { etat: "refus", message: "Ce lien a expiré ou a déjà servi. Demande un nouveau lien." };
  }
  try {
    const { data: espace, error: lecture } = await clientExploitation("administration_des_comptes")
      .from("organization_memberships")
      .select("organization_id, organizations!inner(autonome)")
      .eq("profile_id", data.user.id)
      .eq("state", "active")
      .eq("account_state", "actif")
      .eq("organizations.autonome", true)
      .contains("roles", ["professeur"])
      .limit(1);
    if (lecture || !espace?.length) throw new Error("Parcours indisponible");
    await new DepotSupabase().revoquerSessions(data.user.id, "recuperation_professeur");
    const changement = await auth.updateUser({ password: nouveau });
    if (changement.error) throw changement.error;
    const fermeture = await auth.signOut({ scope: "global" });
    if (fermeture.error) throw fermeture.error;
  } catch {
    await auth.signOut({ scope: "local" });
    return { etat: "refus", message: "La récupération n’a pas pu être terminée. Demande un nouveau lien avant de réessayer." };
  }
  redirect("/connexion?recuperation=1");
}

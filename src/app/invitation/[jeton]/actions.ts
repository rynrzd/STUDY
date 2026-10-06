"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { tenterConnexion } from "@/lib/authentification";
import { chiffrer, lireCles } from "@/lib/chiffrement";
import { DepotSupabase } from "@/lib/depot-authentification";
import { FournisseurSupabase } from "@/lib/fournisseur-supabase";
import { controlerMotDePasse, MESSAGES_MOT_DE_PASSE } from "@/lib/mot-de-passe";
import { cookieSession, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";
import { appliquerPolitique, poserParcours } from "@/lib/v6/connexion-serveur";
import { empreinteInvitation, FORME_JETON } from "@/lib/v6/invitations";

/**
 * Utiliser une invitation : poser le mot de passe, consommer le lien (usage
 * unique, il révoque les sessions existantes du compte), puis ouvrir
 * directement une session dans le bon établissement.
 *
 * Rien n'est créé : le compte, l'identifiant et les appartenances existent
 * déjà. Si l'ouverture de session échoue après coup (service d'identité
 * momentanément indisponible), le mot de passe reste posé et la personne est
 * conduite à la connexion, établissement déjà choisi.
 */
export async function utiliserInvitation(jeton: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!baseConfiguree()) return { ok: false, message: "Le service est momentanément indisponible. Ton lien reste valable ; réessaie plus tard." };
  if (!FORME_JETON.test(jeton)) redirect("/invitation/invalide");

  if (donnees.get("confirme") !== "oui") {
    return { ok: false, message: "Confirme qu'il s'agit bien de toi.", champs: { confirme: ["Coche cette case si ce lien t'a été remis personnellement."] } };
  }
  const nouveau = String(donnees.get("nouveau") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");
  const controle = controlerMotDePasse({ nouveau, confirmation });
  if (!controle.accepte) {
    const message = MESSAGES_MOT_DE_PASSE[controle.motif!];
    return { ok: false, message, champs: controle.motif === "confirmation_differente" ? { confirmation: [message] } : { nouveau: [message] } };
  }

  const client = clientExploitation("invitation_et_recuperation");
  const empreinte = empreinteInvitation(jeton);
  const lu = await client.rpc("invitation_etat", { p_empreinte: empreinte });
  const etat = ((lu.data ?? []) as { etat: string; profile_id: string | null; code_etablissement: string | null; organisation: string | null; identifiant: string | null }[])[0];
  if (lu.error !== null || !etat) return { ok: false, message: "Le service est momentanément indisponible. Réessaie dans un instant." };
  if (etat.etat !== "valide" || etat.profile_id === null) redirect(`/invitation/${encodeURIComponent(jeton)}`);

  const pose = await clientExploitation("administration_des_comptes").auth.admin.updateUserById(etat.profile_id, { password: nouveau });
  if (pose.error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "invitation.mot_de_passe", code: pose.error.status }));
    return { ok: false, message: "Ce mot de passe a été refusé par le service d'identité. Choisis-en un autre, d'au moins douze caractères.", champs: { nouveau: ["Mot de passe refusé."] } };
  }

  const consomme = await client.rpc("invitation_consommer", { p_empreinte: empreinte });
  if (consomme.error !== null) redirect(`/invitation/${encodeURIComponent(jeton)}`);

  const contexte = etat.code_etablissement && etat.organisation ? { code: etat.code_etablissement, nom: etat.organisation } : null;
  const appareil = donnees.get("postePartage") === "oui" ? "partage" : "personnel";

  // Ouverture directe de la session, par la voie ordinaire (limitation,
  // journalisation, rotation) : aucune voie parallèle.
  const magasin = await cookies();
  const ancien = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (ancien) {
    try {
      await new DepotSupabase().revoquerSession(empreinteJeton(ancien), "rotation_connexion");
    } catch {
      /* sans conséquence */
    }
  }
  let resultat;
  try {
    resultat =
      contexte && etat.identifiant
        ? await tenterConnexion(
            { codeEtablissement: contexte.code, identifiant: etat.identifiant, secret: nouveau, appareil },
            { depot: new DepotSupabase(), fournisseur: new FournisseurSupabase(), chiffrer: (clair) => chiffrer(clair, lireCles()) },
          )
        : null;
  } catch {
    resultat = null;
  }
  if (!resultat || !resultat.reussi) {
    if (contexte) await poserParcours(contexte);
    redirect("/connexion?invitation=ok");
  }
  const cookie = cookieSession(resultat.jetonSession, resultat.dureeSecondes, appareil === "personnel");
  magasin.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
  });
  await appliquerPolitique(contexte, appareil);
  redirect(resultat.activationRequise ? "/activation" : "/acces-active");
}

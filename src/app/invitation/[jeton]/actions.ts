"use server";

import { redirect } from "next/navigation";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { controlerMotDePasse, MESSAGES_MOT_DE_PASSE } from "@/lib/mot-de-passe";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";
import { empreinteInvitation, FORME_JETON } from "@/lib/v6/invitations";

/**
 * Utiliser une invitation — dossier V6, §6.2.
 *
 * Ordre : l'état du lien est relu ; le mot de passe est posé chez le
 * fournisseur ; puis le lien est consommé en base (usage unique, atomique),
 * ce qui active le compte et coupe les sessions antérieures. Un lien utilisé
 * entre-temps par une autre requête fait échouer la consommation : la
 * personne est renvoyée vers un message clair, sans rien apprendre d'autre.
 */

export async function utiliserInvitation(jeton: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!baseConfiguree()) return { ok: false, message: "Le service est momentanément indisponible. Votre lien reste valable ; réessayez plus tard." };
  if (!FORME_JETON.test(jeton)) redirect("/invitation/invalide");

  const nouveau = String(donnees.get("nouveau") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");
  const controle = controlerMotDePasse({ nouveau, confirmation });
  if (!controle.accepte) {
    return { ok: false, message: MESSAGES_MOT_DE_PASSE[controle.motif!], champs: { nouveau: [MESSAGES_MOT_DE_PASSE[controle.motif!]] } };
  }

  const client = clientExploitation("invitation_et_recuperation");
  const empreinte = empreinteInvitation(jeton);
  const lu = await client.rpc("invitation_etat", { p_empreinte: empreinte });
  const etat = ((lu.data ?? []) as { etat: string; profile_id: string | null }[])[0];
  if (lu.error !== null || !etat) return { ok: false, message: "Le service est momentanément indisponible. Réessayez dans un instant." };
  if (etat.etat !== "valide" || etat.profile_id === null) redirect(`/invitation/${encodeURIComponent(jeton)}`);

  const pose = await clientExploitation("administration_des_comptes").auth.admin.updateUserById(etat.profile_id, { password: nouveau });
  if (pose.error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "invitation.mot_de_passe", code: pose.error.status }));
    return { ok: false, message: "Ce mot de passe a été refusé par le service d'identité. Choisissez-en un autre, d'au moins douze caractères." };
  }

  const consomme = await client.rpc("invitation_consommer", { p_empreinte: empreinte });
  if (consomme.error !== null) redirect(`/invitation/${encodeURIComponent(jeton)}`);
  redirect("/connexion?invitation=ok");
}

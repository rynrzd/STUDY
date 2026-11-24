"use server";

import { z } from "zod";
import { lireGroupe } from "@/lib/config";
import { controlerMotDePasse, MESSAGES_MOT_DE_PASSE } from "@/lib/mot-de-passe";
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
  if (Object.keys(champs).length > 0) return { etat: "refus", message: "Vérifie les champs indiqués.", champs };
  if (!baseConfiguree()) return { etat: "refus", message: "Le service de création de compte est momentanément indisponible." };

  const origine = lireGroupe("base").APP_ORIGIN!;
  const auth = clientAuthentification();
  const { data, error } = await auth.auth.signUp({ email: valeurs.email, password: motDePasse, options: { emailRedirectTo: `${origine}/connexion?confirmation=1` } });
  // Même réponse publique lorsqu'un compte existe déjà : aucune adresse n'est divulguée.
  if (error || !data.user) return { etat: "envoyee", message: "Si cette adresse peut être utilisée, un e-mail de confirmation vient d’être envoyé." };

  const admin = clientExploitation("administration_des_comptes");
  const { error: preparation } = await admin.rpc("professeur_autonome_preparer", {
    p_profile: data.user.id,
    p_prenom: valeurs.prenom,
    p_nom: valeurs.nom,
    p_email: valeurs.email,
  });
  if (preparation) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(JSON.stringify({ niveau: "erreur", contexte: "inscription_professeur", code: preparation.code }));
    return { etat: "refus", message: "Le compte n’a pas pu être préparé. Réessaie dans quelques minutes." };
  }
  return { etat: "envoyee", message: "Compte préparé. Ouvre l’e-mail reçu pour confirmer ton adresse, puis connecte-toi." };
}

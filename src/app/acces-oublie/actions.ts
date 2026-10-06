"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";
import { normaliserCode, referenceDemande } from "@/lib/v6/contexte-etablissement";
import { empreinteReseau, lireContexteEtablissement } from "@/lib/v6/connexion-serveur";

/**
 * Récupération d'accès — demande à l'établissement.
 *
 * Pas de récupération autonome : les élèves n'ont pas d'adresse, les
 * adresses des adultes ne sont pas vérifiées, et aucun service d'envoi
 * n'est configuré. On ne simule donc aucun e-mail.
 *
 * La réponse publique est la même que le compte existe ou non. La référence
 * est toujours affichée ; elle n'est enregistrée que si un compte
 * correspond, et ne donne aucun droit : elle aide l'administration à
 * rapprocher la personne présente de sa demande, en plus d'une vérification
 * d'identité. Le nouvel accès est un lien personnel, temporaire et
 * révocable ; aucun mot de passe permanent n'est transmis.
 */

export interface EtatRecuperation {
  readonly etat: "vierge" | "refus" | "envoyee";
  readonly message?: string;
  readonly champs?: Partial<Record<"code" | "identifiant", string>>;
  readonly valeurs?: { readonly code?: string; readonly identifiant?: string };
  readonly reference?: string;
  readonly etablissement?: string;
}

const schema = z.object({ identifiant: z.string().trim().min(1).max(40) });

export async function demanderRecuperation(_precedent: EtatRecuperation, donnees: FormData): Promise<EtatRecuperation> {
  const contexte = await lireContexteEtablissement();
  const codeSaisi = String(donnees.get("code") ?? "").slice(0, 40);
  const identifiant = String(donnees.get("identifiant") ?? "").slice(0, 40);
  const valeurs = { code: codeSaisi, identifiant };
  const code = contexte?.code ?? normaliserCode(codeSaisi);

  const champs: EtatRecuperation["champs"] = {
    ...(code === null ? { code: codeSaisi.trim() === "" ? "Indique le code de ton établissement." : "Un code établissement compte 4 à 16 lettres ou chiffres." } : {}),
    ...(!schema.safeParse({ identifiant }).success ? { identifiant: "Indique ton identifiant." } : {}),
  };
  if (Object.keys(champs).length > 0) return { etat: "refus", message: "Un champ est à compléter.", champs, valeurs };
  if (!baseConfiguree()) {
    return { etat: "refus", message: "Le service est momentanément indisponible. Réessaie dans quelques minutes, ou adresse-toi directement à ton établissement.", valeurs };
  }

  const reference = referenceDemande(randomBytes(8));
  const { error } = await clientExploitation("invitation_et_recuperation").rpc("recuperation_demander", {
    p_code: code,
    p_identifiant: identifiant.trim(),
    p_empreinte: await empreinteReseau("study-recuperation"),
    p_reference: reference,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "recuperation", code: error.code }));
    return { etat: "refus", message: "Le service est momentanément indisponible. Réessaie dans quelques minutes.", valeurs };
  }
  return { etat: "envoyee", reference, etablissement: contexte?.nom };
}

"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";

/**
 * Récupération d'accès — E31, AUTH-02.
 *
 * Aucun courrier : la demande est transmise à l'administration de
 * l'établissement, qui vérifie l'identité et remet un nouvel accès. La
 * réponse est **la même** pour un compte connu, inconnu, ou un établissement
 * inexistant ; seule l'administration concernée voit une demande réelle.
 */

const schema = z.object({
  code: z.string().trim().min(4).max(16).regex(/^[A-Za-z0-9-]+$/),
  identifiant: z.string().trim().min(2).max(40),
});

const CONFIRMATION =
  "Si ces informations correspondent à un compte, l'administration de votre établissement a reçu votre demande. " +
  "Présentez-vous à la vie scolaire ou au secrétariat : on vous remettra un nouvel accès après avoir vérifié votre identité.";

export async function demanderRecuperation(_precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { code: String(donnees.get("code") ?? "").slice(0, 40), identifiant: String(donnees.get("identifiant") ?? "").slice(0, 40) };
  const analyse = schema.safeParse(valeurs);
  if (!analyse.success) {
    const champs: Record<string, string[]> = {};
    for (const i of analyse.error.issues) {
      const cle = String(i.path[0]);
      champs[cle] = [cle === "code" ? "Le code établissement compte 4 à 16 lettres ou chiffres." : "Indiquez votre identifiant."];
    }
    return { ok: false, message: "Vérifiez les champs signalés.", champs, valeurs };
  }
  if (!baseConfiguree()) {
    return { ok: false, message: "Le service est momentanément indisponible. Réessayez dans quelques minutes, ou adressez-vous directement à votre établissement.", valeurs };
  }

  const entetes = await headers();
  const ip = (entetes.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  // Empreinte seulement : l'adresse réseau n'est jamais conservée.
  const empreinte = createHash("sha256").update(`study-recuperation:${ip}`).digest();

  const { error } = await clientExploitation("invitation_et_recuperation").rpc("recuperation_demander", {
    p_code: analyse.data.code,
    p_identifiant: analyse.data.identifiant,
    p_empreinte: `\\x${empreinte.toString("hex")}`,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "recuperation", code: error.code }));
    return { ok: false, message: "Le service est momentanément indisponible. Réessayez dans quelques minutes.", valeurs };
  }
  return { ok: true, message: CONFIRMATION };
}

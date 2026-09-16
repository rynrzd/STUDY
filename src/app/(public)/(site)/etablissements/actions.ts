"use server";

import { randomBytes } from "node:crypto";
import {
  empreinteDeduplication,
  genererReference,
  MESSAGES,
  schemaDemande,
  verifierOuverture,
} from "@/lib/demande-commerciale";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";

/**
 * Dépôt d'une demande de démonstration ou de devis.
 *
 * Next vérifie déjà l'origine des actions serveur : une soumission venue d'un
 * autre site est rejetée avant d'arriver ici. S'y ajoutent, dans l'ordre :
 * le champ leurre, le jeton d'ouverture signé, la validation de schéma, puis
 * la déduplication au niveau de la base.
 *
 * Le résultat est volontairement pauvre : un état, une référence, des erreurs
 * par champ. Aucun identifiant interne ne remonte au navigateur.
 */

import type { EtatFormulaire } from "./etats";

export async function deposerDemande(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // --- 0. La base est-elle joignable ? -------------------------------------
  // Mieux vaut le dire que d'accepter une demande qui ne sera enregistrée
  // nulle part.
  if (!baseConfiguree()) {
    return {
      etat: "indisponible",
      message:
        "Le dépôt de demande est momentanément impossible. Écrivez-nous depuis la page de contact.",
    };
  }

  const secret = process.env.SESSION_ENCRYPTION_KEY;
  if (typeof secret !== "string" || secret.length === 0) {
    return {
      etat: "indisponible",
      message:
        "Le dépôt de demande est momentanément impossible. Écrivez-nous depuis la page de contact.",
    };
  }

  // --- 1. Champ leurre ------------------------------------------------------
  // Un robot remplit tous les champs. Une personne ne voit pas celui-ci.
  // On répond comme si tout s'était bien passé : inutile d'apprendre au robot
  // ce qui l'a trahi.
  if (String(donnees.get("organisme") ?? "").trim() !== "") {
    return { etat: "envoye", reference: genererReference(octets) };
  }

  // --- 2. Jeton d'ouverture -------------------------------------------------
  const verdict = verifierOuverture(String(donnees.get("ouverture") ?? ""), secret);
  if (verdict === "perime") {
    return {
      etat: "erreur",
      message: "Cette page est restée ouverte trop longtemps. Rechargez-la et renvoyez le formulaire.",
    };
  }
  if (verdict !== "valide") {
    return {
      etat: "erreur",
      message: "Le formulaire n'a pas pu être vérifié. Rechargez la page et réessayez.",
    };
  }

  // --- 3. Validation --------------------------------------------------------
  const analyse = schemaDemande.safeParse({
    etablissement: donnees.get("etablissement"),
    type: donnees.get("type"),
    commune: donnees.get("commune"),
    contactNom: donnees.get("contactNom"),
    contactFonction: donnees.get("contactFonction"),
    contactEmail: donnees.get("contactEmail"),
    contactTelephone: donnees.get("contactTelephone") ?? "",
    effectif: donnees.get("effectif") ?? "",
    besoin: donnees.get("besoin"),
    consentement: donnees.get("consentement"),
  });

  if (!analyse.success) {
    const champs: Record<string, string> = {};
    for (const probleme of analyse.error.issues) {
      const nom = String(probleme.path[0] ?? "");
      if (nom !== "" && champs[nom] === undefined) {
        champs[nom] = MESSAGES[nom] ?? "Ce champ n'est pas valide.";
      }
    }
    return {
      etat: "erreur",
      message: "Quelques informations sont à corriger avant l'envoi.",
      champs,
    };
  }

  const demande = analyse.data;
  const empreinte = empreinteDeduplication(demande);

  // --- 4. Enregistrement ----------------------------------------------------
  const base = clientExploitation("demande_commerciale_publique");

  const ligne = {
    reference: genererReference(octets),
    establishment_name: demande.etablissement,
    legal_kind: demande.type,
    commune: demande.commune,
    approximate_size: typeof demande.effectif === "number" ? demande.effectif : null,
    contact_name: demande.contactNom,
    contact_role: demande.contactFonction,
    contact_email: demande.contactEmail,
    contact_phone: demande.contactTelephone === "" ? null : (demande.contactTelephone ?? null),
    message: demande.besoin,
    dedupe_digest: empreinte,
    source: "site",
  };

  const { data, error } = await base
    .from("commercial_requests")
    .insert(ligne)
    .select("reference")
    .single();

  if (error !== null) {
    // 23505 : l'empreinte existe déjà. Ce n'est pas un échec pour le
    // demandeur — sa demande est bien enregistrée. On lui redonne la
    // référence de la demande d'origine plutôt qu'un message d'erreur qui
    // l'inciterait à renvoyer une troisième fois.
    if (error.code === "23505") {
      const { data: existante } = await base
        .from("commercial_requests")
        .select("reference")
        .eq("dedupe_digest", empreinte)
        .single();

      if (existante !== null) {
        return { etat: "envoye", reference: existante.reference, dejaRecue: true };
      }
    }

    console.error(
      JSON.stringify({
        niveau: "erreur",
        contexte: "demande_commerciale",
        code: error.code ?? "inconnu",
      }),
    );

    return {
      etat: "erreur",
      message:
        "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant ; si le problème persiste, passez par la page de contact.",
    };
  }

  return { etat: "envoye", reference: data.reference };
}

function octets(taille: number): Uint8Array {
  return new Uint8Array(randomBytes(taille));
}

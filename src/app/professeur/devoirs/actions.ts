"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  archiverDevoir,
  creerDevoir,
  enregistrerRetour,
  majDevoir,
  marquerPapier,
  publierDevoir,
  publierRetour,
} from "@/lib/devoirs";
import { deposerPieceJointe } from "@/lib/documents";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";

import { type EtatDevoirAction } from "./etats";

/**
 * Les gestes du professeur sur un devoir — cahier V5, §2, §4 et §5.
 *
 * Chaque action commence par revérifier la session **et** l'appartenance du
 * cours : une action serveur est une route, atteignable directement, et
 * masquer un bouton ne protège rien. Le second filet est RLS, qui refuse
 * d'écrire sur un devoir d'un cours qu'on n'enseigne pas — un identifiant
 * changé à la main ne rend pas un refus, il rend zéro ligne modifiée.
 */

const REFUS: EtatDevoirAction = { etat: "erreur", message: "Action refusée." };

/** La session d'un professeur, avec son jeton. */
async function professeur() {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return null;
  if (!personne.roles.includes("professeur")) return null;

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return null;

  return { personne, jeton };
}

/** L'échéance saisie, ramenée à un instant. Vide veut dire « sans date ». */
function echeanceDe(date: string, heure: string): string | null {
  if (date.trim() === "") return null;
  const moment = heure.trim() === "" ? "23:59" : heure.trim();
  const instant = new Date(`${date}T${moment}:00`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

const SCHEMA_DEVOIR = z.object({
  titre: z.string().trim().min(1).max(160),
  consigne: z.string().trim().max(5000),
  date: z.string().trim().max(10),
  heure: z.string().trim().max(5),
  mode: z.enum(["numerique", "papier", "mixte", "aucune"]),
  remplacement: z.enum(["oui", "non"]),
  retard: z.enum(["accepter_avec_retard", "fermer"]),
});

/* -------------------------------------------------------------------------- */
/* Créer                                                                       */
/* -------------------------------------------------------------------------- */

export async function creerUnDevoir(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = SCHEMA_DEVOIR.extend({
    cours: z.string().uuid(),
    seance: z.string().uuid().nullable(),
  }).safeParse({
    cours: donnees.get("cours"),
    seance: donnees.get("seance") === "" ? null : donnees.get("seance"),
    titre: donnees.get("titre"),
    consigne: donnees.get("consigne") ?? "",
    date: donnees.get("date") ?? "",
    heure: donnees.get("heure") ?? "",
    mode: donnees.get("mode") ?? "numerique",
    remplacement: donnees.get("remplacement") ?? "oui",
    retard: donnees.get("retard") ?? "accepter_avec_retard",
  });

  if (!analyse.success) {
    return { etat: "erreur", message: "Vérifiez le titre et la classe : ils sont obligatoires." };
  }

  // Le cours doit être l'un des siens. RLS le redirait, mais le dire ici donne
  // une phrase utile plutôt qu'un échec muet.
  const cours = await coursDuProfesseur(session.jeton);
  const leCours = cours.find((unCours) => unCours.id === analyse.data.cours);
  if (leCours === undefined) return REFUS;

  // L etablissement vient de la session, pas du cours : un professeur
  // n appartient qu a un seul lycee, et le cours ne porte pas cette
  // information.
  const organisation = session.personne.organizationId;
  if (organisation === null || organisation === undefined) return REFUS;

  const identifiant = await creerDevoir({
    jeton: session.jeton,
    organisation,
    cours: analyse.data.cours,
    seance: analyse.data.seance,
    auteur: session.personne.profileId,
    titre: analyse.data.titre,
    consigne: analyse.data.consigne,
    echeance: echeanceDe(analyse.data.date, analyse.data.heure),
    mode: analyse.data.mode,
    remplacementAutorise: analyse.data.remplacement === "oui",
    politiqueRetard: analyse.data.retard,
  });

  if (identifiant === null) {
    return { etat: "erreur", message: "Le devoir n'a pas pu être créé." };
  }

  redirect(`/professeur/devoirs/${identifiant}`);
}

/* -------------------------------------------------------------------------- */
/* Modifier, publier, archiver                                                 */
/* -------------------------------------------------------------------------- */

export async function modifierUnDevoir(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = SCHEMA_DEVOIR.extend({ devoir: z.string().uuid() }).safeParse({
    devoir: donnees.get("devoir"),
    titre: donnees.get("titre"),
    consigne: donnees.get("consigne") ?? "",
    date: donnees.get("date") ?? "",
    heure: donnees.get("heure") ?? "",
    mode: donnees.get("mode") ?? "numerique",
    remplacement: donnees.get("remplacement") ?? "oui",
    retard: donnees.get("retard") ?? "accepter_avec_retard",
  });

  if (!analyse.success) return { etat: "erreur", message: "Un titre est nécessaire." };

  const fait = await majDevoir({
    jeton: session.jeton,
    devoir: analyse.data.devoir,
    titre: analyse.data.titre,
    consigne: analyse.data.consigne,
    echeance: echeanceDe(analyse.data.date, analyse.data.heure),
    mode: analyse.data.mode,
    remplacementAutorise: analyse.data.remplacement === "oui",
    politiqueRetard: analyse.data.retard,
  });

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/eleve/devoirs");

  return fait
    ? { etat: "ok", message: "Devoir modifié." }
    : { etat: "erreur", message: "La modification a échoué." };
}

export async function basculerPublication(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = z
    .object({ devoir: z.string().uuid(), publier: z.enum(["oui", "non"]) })
    .safeParse({ devoir: donnees.get("devoir"), publier: donnees.get("publier") });

  if (!analyse.success) return REFUS;

  const resultat = await publierDevoir({
    jeton: session.jeton,
    devoir: analyse.data.devoir,
    publier: analyse.data.publier === "oui",
  });

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/professeur/devoirs");
  revalidatePath("/eleve/devoirs");
  revalidatePath("/eleve");

  return resultat.ok
    ? {
        etat: "ok",
        message:
          analyse.data.publier === "oui"
            ? "Devoir publié : la classe le voit maintenant."
            : "Devoir remis en brouillon.",
      }
    : { etat: "erreur", message: resultat.message };
}

export async function basculerArchive(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = z
    .object({ devoir: z.string().uuid(), archiver: z.enum(["oui", "non"]) })
    .safeParse({ devoir: donnees.get("devoir"), archiver: donnees.get("archiver") });

  if (!analyse.success) return REFUS;

  const fait = await archiverDevoir(
    session.jeton,
    analyse.data.devoir,
    analyse.data.archiver === "oui",
  );

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/professeur/devoirs");
  revalidatePath("/eleve/devoirs");

  return fait
    ? {
        etat: "ok",
        message:
          analyse.data.archiver === "oui"
            ? "Devoir archivé : il sort des listes, les copies restent."
            : "Devoir sorti des archives.",
      }
    : { etat: "erreur", message: "L'archivage a échoué." };
}

/* -------------------------------------------------------------------------- */
/* Remise papier                                                               */
/* -------------------------------------------------------------------------- */

export async function constaterRemisePapier(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = z
    .object({
      devoir: z.string().uuid(),
      eleve: z.string().uuid(),
      etat: z.enum(["non_commence", "remis", "remis_en_retard"]),
    })
    .safeParse({
      devoir: donnees.get("devoir"),
      eleve: donnees.get("eleve"),
      etat: donnees.get("etatRemise"),
    });

  if (!analyse.success) return REFUS;

  const fait = await marquerPapier({
    professeur: session.personne.profileId,
    devoir: analyse.data.devoir,
    eleve: analyse.data.eleve,
    etat: analyse.data.etat,
  });

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/eleve/devoirs");

  return fait
    ? { etat: "ok", message: "État de remise enregistré." }
    : { etat: "erreur", message: "L'état n'a pas pu être enregistré." };
}

/* -------------------------------------------------------------------------- */
/* Correction                                                                  */
/* -------------------------------------------------------------------------- */

export async function enregistrerUneCorrection(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = z
    .object({
      devoir: z.string().uuid(),
      version: z.string().uuid(),
      organisation: z.string().uuid(),
      commentaire: z.string().trim().max(5000),
      publier: z.enum(["oui", "non"]),
    })
    .safeParse({
      devoir: donnees.get("devoir"),
      version: donnees.get("version"),
      organisation: donnees.get("organisation"),
      commentaire: donnees.get("commentaire") ?? "",
      publier: donnees.get("publier") ?? "non",
    });

  if (!analyse.success) return REFUS;

  // Le fichier corrigé est facultatif : un commentaire seul est une correction.
  let fichier: string | null = null;
  const depose = donnees.get("corrige");

  if (depose instanceof File && depose.size > 0) {
    const resultat = await deposerPieceJointe({
      jeton: session.jeton,
      organisation: analyse.data.organisation,
      proprietaire: session.personne.profileId,
      genre: "correction",
      rattachement: analyse.data.version,
      fichier: depose,
    });

    if (resultat.etat !== "ok") return { etat: "erreur", message: resultat.message };
    fichier = resultat.support.fileId;
  }

  if (analyse.data.commentaire === "" && fichier === null) {
    return {
      etat: "erreur",
      message: "Écrivez un commentaire, ou joignez un fichier corrigé.",
    };
  }

  const retour = await enregistrerRetour({
    jeton: session.jeton,
    organisation: analyse.data.organisation,
    version: analyse.data.version,
    auteur: session.personne.profileId,
    commentaire: analyse.data.commentaire,
    fichier,
  });

  if (retour === null) return { etat: "erreur", message: "La correction n'a pas pu être enregistrée." };

  if (analyse.data.publier === "oui") {
    const publiee = await publierRetour(session.jeton, retour, true);
    if (!publiee) {
      return { etat: "erreur", message: "La correction est enregistrée, mais non publiée." };
    }
  }

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/eleve/devoirs");
  revalidatePath("/eleve");

  return {
    etat: "ok",
    message:
      analyse.data.publier === "oui"
        ? "Correction publiée : l'élève la voit maintenant."
        : "Correction enregistrée en brouillon. L'élève ne la voit pas encore.",
  };
}

export async function retirerUneCorrection(
  _precedent: EtatDevoirAction,
  donnees: FormData,
): Promise<EtatDevoirAction> {
  const session = await professeur();
  if (session === null) return REFUS;

  const analyse = z
    .object({ devoir: z.string().uuid(), retour: z.string().uuid() })
    .safeParse({ devoir: donnees.get("devoir"), retour: donnees.get("retour") });

  if (!analyse.success) return REFUS;

  const fait = await publierRetour(session.jeton, analyse.data.retour, false);

  revalidatePath(`/professeur/devoirs/${analyse.data.devoir}`);
  revalidatePath("/eleve/devoirs");

  return fait
    ? { etat: "ok", message: "Correction retirée : l'élève ne la voit plus." }
    : { etat: "erreur", message: "Le retrait a échoué." };
}

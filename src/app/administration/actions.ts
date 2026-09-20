"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  changerEtatDemande,
  changerEtatEtablissement,
  creerAdministrateur,
  creerEtablissement,
  suspendreCompte,
} from "@/lib/administration";
import { ETATS } from "@/lib/demande-commerciale";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { estExploitant, sessionCourante } from "@/lib/session-serveur";

/**
 * Actions de l'exploitation.
 *
 * Chacune commence par revérifier la session. Une action serveur est une route
 * : elle est appelable directement, et le contrôle du gabarit ne la protège
 * pas. C'est pour cette raison que `exigerExploitant()` ouvre chaque fonction,
 * sans exception.
 */

async function exigerExploitant(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !estExploitant(personne)) {
    throw new Error("Action refusée.");
  }

  // Le second facteur est vérifié **ici**, au début de chaque geste, et non
  // seulement dans le gabarit de page. Une action serveur s'atteint
  // directement : la masquer derrière un écran ne la protège pas.
  //
  // Ces cinq actions créent des établissements, nomment des administrateurs et
  // désactivent des comptes. Ce sont exactement les gestes qu'un mot de passe
  // volé permettrait de détourner.
  if (!(await assuranceSuffisante(personne))) {
    throw new Error(REFUS_ASSURANCE);
  }

  return personne.profileId;
}

/* ------------------------------------------------------- Demandes -------- */

import type { EtatAction } from "./etats";

const etatsConnus = ETATS.map((element) => element.valeur) as [string, ...string[]];

export async function majDemande(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  await exigerExploitant();

  const analyse = z
    .object({
      id: z.string().uuid(),
      etat: z.enum(etatsConnus),
      note: z.string().trim().max(2000).optional(),
    })
    .safeParse({
      id: donnees.get("id"),
      etat: donnees.get("etat"),
      note: donnees.get("note") ?? "",
    });

  if (!analyse.success) return { etat: "erreur", message: "Saisie invalide." };

  const note = analyse.data.note === "" ? null : (analyse.data.note ?? null);
  const ok = await changerEtatDemande(analyse.data.id, analyse.data.etat as never, note);

  revalidatePath("/administration");
  return ok
    ? { etat: "ok", message: "Demande mise à jour." }
    : { etat: "erreur", message: "La mise à jour a échoué." };
}

/* -------------------------------------------------- Établissements ------- */

export async function ajouterEtablissement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const acteur = await exigerExploitant();

  const analyse = z
    .object({
      nom: z.string().trim().min(2).max(120),
      code: z
        .string()
        .trim()
        .min(4)
        .max(16)
        .regex(/^[A-Za-z0-9-]+$/, "Code invalide"),
      type: z.enum(["public", "prive", "autre"]),
      commune: z.string().trim().max(120).optional(),
    })
    .safeParse({
      nom: donnees.get("nom"),
      code: donnees.get("code"),
      type: donnees.get("type"),
      commune: donnees.get("commune") ?? "",
    });

  if (!analyse.success) {
    return {
      etat: "erreur",
      message: "Vérifiez le nom et le code : 4 à 16 caractères, lettres, chiffres ou tirets.",
    };
  }

  const resultat = await creerEtablissement({
    acteur,
    nom: analyse.data.nom,
    code: analyse.data.code.toUpperCase(),
    type: analyse.data.type,
    commune: analyse.data.commune === "" ? null : (analyse.data.commune ?? null),
  });

  revalidatePath("/administration/etablissements");

  return resultat.ok
    ? { etat: "ok", message: "Établissement créé, à l'état « préparation »." }
    : { etat: "erreur", message: resultat.message };
}

export async function majEtatEtablissement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const acteur = await exigerExploitant();

  const analyse = z
    .object({
      organisation: z.string().uuid(),
      etat: z.enum(["preparation", "actif", "suspendu", "archive"]),
      motif: z.string().trim().min(10).max(500),
    })
    .safeParse({
      organisation: donnees.get("organisation"),
      etat: donnees.get("etat"),
      motif: donnees.get("motif"),
    });

  if (!analyse.success) {
    return {
      etat: "erreur",
      message: "Un motif d'au moins dix caractères est nécessaire : il sera inscrit au journal.",
    };
  }

  const resultat = await changerEtatEtablissement({ acteur, ...analyse.data });
  revalidatePath("/administration/etablissements");

  return resultat.ok
    ? { etat: "ok", message: "État modifié et inscrit au journal." }
    : { etat: "erreur", message: resultat.message };
}

export async function ajouterAdministrateur(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const acteur = await exigerExploitant();

  const analyse = z
    .object({
      organisation: z.string().uuid(),
      code: z.string().trim().min(4).max(16),
      prenom: z.string().trim().min(1).max(60),
      nom: z.string().trim().min(1).max(60),
      email: z.string().trim().toLowerCase().email().max(180),
      identifiant: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9][a-z0-9._-]{1,38}$/, "Identifiant invalide"),
    })
    .safeParse({
      organisation: donnees.get("organisation"),
      code: donnees.get("code"),
      prenom: donnees.get("prenom"),
      nom: donnees.get("nom"),
      email: donnees.get("email"),
      identifiant: donnees.get("identifiant"),
    });

  if (!analyse.success) {
    return {
      etat: "erreur",
      message:
        "Vérifiez la saisie. L'identifiant est en minuscules, de 2 à 39 caractères, sans espace.",
    };
  }

  const resultat = await creerAdministrateur({ acteur, ...analyse.data });
  revalidatePath("/administration/etablissements");

  return resultat.ok
    ? {
        etat: "ok",
        message:
          "Administrateur créé. Notez ces accès maintenant : le mot de passe temporaire ne sera plus affiché.",
        acces: resultat.acces,
      }
    : { etat: "erreur", message: resultat.message };
}

export async function desactiverCompte(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const acteur = await exigerExploitant();

  const analyse = z
    .object({
      organisation: z.string().uuid(),
      profil: z.string().uuid(),
      motif: z.string().trim().min(10).max(500),
    })
    .safeParse({
      organisation: donnees.get("organisation"),
      profil: donnees.get("profil"),
      motif: donnees.get("motif"),
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Un motif d'au moins dix caractères est nécessaire." };
  }

  const resultat = await suspendreCompte({ acteur, ...analyse.data });
  revalidatePath("/administration/etablissements");

  return resultat.ok
    ? { etat: "ok", message: "Compte suspendu, sessions coupées, action journalisée." }
    : { etat: "erreur", message: resultat.message };
}

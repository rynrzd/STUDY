"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { devoir as lireDevoir, remettre } from "@/lib/devoirs";
import { deposerPieceJointe, retirerPieceJointe } from "@/lib/documents";
import { contexte } from "@/lib/etablissement";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

import { type EtatRemiseAction } from "./etats";

/**
 * La remise d'une copie — cahier V5, §3.
 *
 * L'ordre des trois gestes n'est pas négociable, et il découle d'une question :
 * **que se passe-t-il si le serveur s'arrête au milieu ?**
 *
 * 1. Le fichier est déposé et finalisé. S'il échoue, rien n'a changé.
 * 2. La copie est liée en base, en une transaction. Si elle échoue, le fichier
 *    déposé est retiré — sans quoi il resterait dans le stockage sans que rien
 *    ne le désigne, invisible et impossible à supprimer par un écran.
 * 3. L'ancienne version est laissée en place. On ne retire jamais une copie
 *    valide : l'élève garde la précédente tant que la nouvelle n'est pas
 *    enregistrée.
 *
 * La clé d'idempotence vient du formulaire. Elle protège du double clic, du
 * rechargement et d'un réseau qui rejoue la requête — trois situations où un
 * bouton désactivé dans le navigateur ne sert à rien.
 */

const REFUS: EtatRemiseAction = {
  etat: "erreur",
  message: "Action refusée.",
};

export async function remettreUneCopie(
  _precedent: EtatRemiseAction,
  donnees: FormData,
): Promise<EtatRemiseAction> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return REFUS;
  if (!personne.roles.includes("eleve")) return REFUS;

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return REFUS;

  const analyse = z
    .object({
      devoir: z.string().uuid(),
      idempotence: z.string().trim().min(8).max(64),
    })
    .safeParse({
      devoir: donnees.get("devoir"),
      idempotence: donnees.get("idempotence"),
    });

  if (!analyse.success) return REFUS;

  const leDevoir = await lireDevoir(jeton, analyse.data.devoir);
  if (leDevoir === null) return REFUS;

  if (leDevoir.mode !== "numerique" && leDevoir.mode !== "mixte") {
    return { etat: "erreur", message: "Ce devoir n'attend pas de fichier." };
  }

  // L'état est relu ici **et** revérifié par la base. Ce contrôle-ci sert à
  // donner une phrase utile ; celui de la base est ce qui refuse réellement.
  if (leDevoir.etat === "ferme") {
    return {
      etat: "erreur",
      message: "La remise est fermée : l'échéance est passée et ce devoir n'accepte pas les retards.",
    };
  }
  if (leDevoir.etat !== "publie" && leDevoir.etat !== "publie_en_retard") {
    return { etat: "erreur", message: "Ce devoir n'est pas ouvert aux remises." };
  }

  const fichier = donnees.get("copie");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { etat: "erreur", message: "Choisissez un fichier à remettre." };
  }

  const situation = await contexte(personne.profileId);
  const organisation = situation?.organizationId ?? personne.organizationId;
  if (organisation === null || organisation === undefined) return REFUS;

  const depot = await deposerPieceJointe({
    jeton,
    organisation,
    proprietaire: personne.profileId,
    genre: "copie",
    rattachement: analyse.data.devoir,
    fichier,
  });

  if (depot.etat !== "ok") {
    return { etat: "erreur", message: depot.message };
  }

  const resultat = await remettre({
    eleve: personne.profileId,
    devoir: analyse.data.devoir,
    fichier: depot.support.fileId,
    idempotence: analyse.data.idempotence,
  });

  if (!resultat.ok) {
    // La copie n'a pas été liée : le fichier déposé ne doit pas rester.
    await retirerPieceJointe(jeton, depot.support.fileId);
    return { etat: "erreur", message: resultat.message };
  }

  revalidatePath("/eleve/devoirs");
  revalidatePath(`/eleve/devoirs/${analyse.data.devoir}`);
  revalidatePath("/eleve");

  return {
    etat: "remis",
    reference: resultat.reference,
    remisLe: resultat.remisLe,
    enRetard: resultat.enRetard,
    numero: resultat.numero,
  };
}

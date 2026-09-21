"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signaler } from "@/lib/moderation";
import { marquerLue, toutMarquerLu } from "@/lib/nouveautes";
import { basculerFait, poserQuestion, repondre } from "@/lib/parcours-eleve";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * Les gestes de l'élève — cahier V5, §3.3 et §3.5.
 *
 * Trois gestes, et aucun ne désigne une classe : cocher un devoir, poser une
 * question sur une séance, répondre à un camarade. Le périmètre vient à chaque
 * fois de la ligne relue sous RLS, jamais du formulaire. Poster sur le cours
 * d'une autre classe ne renvoie donc pas « interdit » : la lecture préalable
 * ne rend rien, et l'écriture n'a pas lieu.
 */

import type { EtatEleve } from "./etats";

const REFUS: EtatEleve = {
  etat: "erreur",
  message: "Cette action n'a pas pu être effectuée.",
};

async function eleveConnecte(): Promise<{ jeton: string; moi: string } | null> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return null;

  const jeton = await jetonAccesDe(personne);
  return jeton === null ? null : { jeton, moi: personne.profileId };
}

/**
 * Coche ou décoche un devoir (§3.3).
 *
 * L'état est persistant : rechargé, reconnecté, il tient. C'est la seule
 * chose que le produit retienne d'un travail personnel — pas de date de
 * rendu estimée, pas de série de jours, pas de point.
 */
export async function marquerFait(_precedent: EtatEleve, donnees: FormData): Promise<EtatEleve> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z
    .object({ devoir: z.string().uuid(), fait: z.enum(["oui", "non"]) })
    .safeParse({ devoir: donnees.get("devoir"), fait: donnees.get("fait") });

  if (!analyse.success) return REFUS;

  const fait = await basculerFait({
    jeton: session.jeton,
    moi: session.moi,
    devoir: analyse.data.devoir,
    fait: analyse.data.fait === "oui",
  });

  if (!fait) return REFUS;

  revalidatePath("/eleve");
  revalidatePath("/eleve/devoirs");
  return {
    etat: "ok",
    message: analyse.data.fait === "oui" ? "Marqué comme fait." : "Remis à faire.",
  };
}

/** Pose une question sur une séance, depuis le bloc qui coince (§3.5). */
export async function demanderDeLAide(
  _precedent: EtatEleve,
  donnees: FormData,
): Promise<EtatEleve> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z
    .object({
      seance: z.string().uuid(),
      bloc: z.string().uuid().nullable(),
      question: z.string().trim().min(3).max(1000),
    })
    .safeParse({
      seance: donnees.get("seance"),
      bloc: donnees.get("bloc") === null || donnees.get("bloc") === "" ? null : donnees.get("bloc"),
      question: donnees.get("question"),
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Écrivez votre question en quelques mots." };
  }

  const resultat = await poserQuestion({
    jeton: session.jeton,
    moi: session.moi,
    seance: analyse.data.seance,
    bloc: analyse.data.bloc,
    question: analyse.data.question,
  });

  if (!resultat.ok) return { etat: "erreur", message: resultat.message };

  revalidatePath(`/eleve/cours/${analyse.data.seance}`);
  return { etat: "ok", message: "Votre question est posée à votre classe." };
}

/** Répond à la question d'un camarade du même cours (§3.5). */
export async function repondreAUnCamarade(
  _precedent: EtatEleve,
  donnees: FormData,
): Promise<EtatEleve> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z
    .object({
      fil: z.string().uuid(),
      seance: z.string().uuid(),
      texte: z.string().trim().min(1).max(2000),
    })
    .safeParse({
      fil: donnees.get("fil"),
      seance: donnees.get("seance"),
      texte: donnees.get("texte"),
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Écrivez votre réponse." };
  }

  const resultat = await repondre({
    jeton: session.jeton,
    moi: session.moi,
    fil: analyse.data.fil,
    texte: analyse.data.texte,
  });

  if (!resultat.ok) return { etat: "erreur", message: resultat.message };

  revalidatePath(`/eleve/cours/${analyse.data.seance}`);
  return { etat: "ok", message: "Votre réponse est publiée." };
}

/* -------------------------------------------------------------------------- */
/* Signaler un contenu d'entraide — §7                                         */
/* -------------------------------------------------------------------------- */

/**
 * Signale un fil ou une réponse.
 *
 * Aucun établissement ni aucun cours ne vient du formulaire : seuls
 * l'identifiant du contenu et le motif. La politique `reports_signaler` relit
 * le cours du contenu et refuse ce que l'appelant n'aurait pas le droit de
 * lire — signaler un message d'une autre classe n'est donc pas possible, même
 * en forgeant la requête.
 *
 * Le signalement **ne masque rien**. Ce que l'élève obtient, c'est qu'une
 * personne regarde ; l'écran ne lui promet pas autre chose.
 */
export async function signalerUnContenu(
  _precedent: EtatEleve,
  donnees: FormData,
): Promise<EtatEleve> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return REFUS;
  if (personne.organizationId === null) return REFUS;

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return REFUS;

  const analyse = z
    .object({
      genre: z.enum(["fil", "reponse"]),
      cible: z.string().uuid(),
      seance: z.string().uuid(),
      raison: z.enum(["harcelement", "contenu_inapproprie", "hors_sujet", "autre"]),
      detail: z.string().trim().max(1000),
    })
    .safeParse({
      genre: donnees.get("genre"),
      cible: donnees.get("cible"),
      seance: donnees.get("seance"),
      raison: donnees.get("raison"),
      detail: donnees.get("detail") ?? "",
    });

  if (!analyse.success) return REFUS;

  const resultat = await signaler({
    jeton,
    organisation: personne.organizationId,
    moi: personne.profileId,
    cible: { genre: analyse.data.genre, id: analyse.data.cible },
    raison: analyse.data.raison,
    detail: analyse.data.detail,
  });

  if (!resultat.ok) {
    // Avoir déjà signalé n'est pas une erreur de l'élève : on le lui dit
    // comme une information, pas comme un refus.
    return { etat: resultat.dejaSignale === true ? "ok" : "erreur", message: resultat.message };
  }

  revalidatePath(`/eleve/cours/${analyse.data.seance}`);

  return {
    etat: "ok",
    message:
      "Signalement transmis. Un responsable de l'établissement le regardera. Le message reste visible en attendant : rien n'est retiré sans décision.",
  };
}

/* -------------------------------------------------------------------------- */
/* Nouveautés — §9                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Marque une nouveauté lue, puis ouvre le devoir.
 *
 * Les deux gestes n'en font qu'un : on ne demande pas à quelqu'un de ranger ce
 * qu'il vient de lire. Le marquage est borné aux lignes de l'appelant par la
 * politique `nouveautes_marquer_lue` — un identifiant changé à la main ne rend
 * pas un refus, il ne touche aucune ligne.
 *
 * La redirection a lieu même si le marquage échoue : rater une coche ne doit
 * pas empêcher d'ouvrir son devoir.
 */
export async function lireUneNouveaute(
  _precedent: EtatEleve,
  donnees: FormData,
): Promise<EtatEleve> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z
    .object({ nouveaute: z.string().uuid(), devoir: z.string().uuid() })
    .safeParse({ nouveaute: donnees.get("nouveaute"), devoir: donnees.get("devoir") });

  if (!analyse.success) return REFUS;

  await marquerLue(session.jeton, analyse.data.nouveaute);
  revalidatePath("/eleve");

  redirect(`/eleve/devoirs/${analyse.data.devoir}`);
}

/** Marque toutes mes nouveautés lues — pour la rentrée, quand la liste a grossi. */
export async function toutLire(_precedent: EtatEleve, _donnees: FormData): Promise<EtatEleve> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const fait = await toutMarquerLu(session.jeton);
  revalidatePath("/eleve");

  return fait
    ? { etat: "ok", message: "Tout est marqué comme lu." }
    : { etat: "erreur", message: "Le marquage n'a pas abouti." };
}

"use server";

import { revalidatePath } from "next/cache";
import { changerEtatCompte } from "@/lib/acces";
import { annulerEffacement, apercuChangementClasse, changerClasse, demanderEffacement, departEleve, preinscrireEleve, type MouvementCours } from "@/lib/etablissement";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";

import type { EtatAdmin } from "../etats";

/**
 * Gestes de la fiche élève — cahier des charges, ch. 09.
 *
 * Le rôle et le second facteur sont revérifiés ici ; l'établissement, lui, est
 * recalculé en base à partir de l'adhésion de la personne. La date vient du
 * formulaire, mais la base refuse une date de plus d'un mois en arrière.
 */

async function exigerAdministrateur(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    throw new Error("Action refusée.");
  }
  if (!(await assuranceSuffisante(personne))) {
    throw new Error(REFUS_ASSURANCE);
  }
  return personne.profileId;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function champ(donnees: FormData, nom: string): string {
  const v = donnees.get(nom);
  return typeof v === "string" ? v.trim() : "";
}

/** Les cours qu'un changement de classe ferait perdre, gagner ou garder. */
export async function apercuDuChangement(eleve: string, classe: string): Promise<MouvementCours[] | null> {
  const acteur = await exigerAdministrateur();
  if (!UUID.test(eleve) || !UUID.test(classe)) return null;
  return apercuChangementClasse(acteur, eleve, classe);
}

export async function changerDeClasse(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const eleve = champ(donnees, "eleve");
  const classe = champ(donnees, "classe");
  const date = champ(donnees, "date");
  if (!UUID.test(eleve) || !UUID.test(classe)) return { etat: "erreur", message: "Choisissez la nouvelle classe." };
  if (date !== "" && !DATE.test(date)) return { etat: "erreur", message: "La date est illisible." };

  const r = await changerClasse(acteur, eleve, classe, date === "" ? null : date);
  if (!r.ok) return { etat: "erreur", message: r.message };

  revalidatePath(`/admin/eleves/${eleve}`);
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/classes");
  return {
    etat: "ok",
    message:
      r.issue === "deja"
        ? "L'élève est déjà dans cette classe."
        : r.issue === "corrigee"
          ? "Classe corrigée : l'attribution du jour a été remplacée."
          : date !== "" && date > new Date().toISOString().slice(0, 10)
            ? `Changement enregistré : il prendra effet le ${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`
            : "Changement de classe enregistré.",
  };
}

export async function enregistrerDepart(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const eleve = champ(donnees, "eleve");
  const date = champ(donnees, "date");
  const suspendre = champ(donnees, "suspendre") === "oui";
  if (!UUID.test(eleve)) return { etat: "erreur", message: "Élève introuvable." };
  if (date !== "" && !DATE.test(date)) return { etat: "erreur", message: "La date est illisible." };

  const r = await departEleve(acteur, eleve, date === "" ? null : date);
  if (r === null) return { etat: "erreur", message: "Le départ a été refusé. La date ne peut pas remonter à plus d'un mois." };

  let suite = "";
  if (suspendre) {
    const etat = await changerEtatCompte({ acteur, profil: eleve, actif: false, motif: "Départ de l'établissement" });
    suite = etat.ok ? " Le compte est désactivé." : " Le compte n'a pas pu être désactivé : faites-le depuis « Personnes ».";
  }

  revalidatePath(`/admin/eleves/${eleve}`);
  revalidatePath("/admin/utilisateurs");
  return { etat: "ok", message: `Départ enregistré : ${r.classes} inscription(s) et ${r.groupes} groupe(s) clos. Les copies et l'historique sont conservés.${suite}` };
}

/**
 * Choisir la classe de l'an prochain d'un élève (EL-08) : redoublement,
 * changement de filière. Remplace sa préinscription dans l'année préparée ;
 * rien ne change avant la bascule.
 */
export async function preinscrireAutrement(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eleve = String(donnees.get("eleve") ?? "");
  const classe = String(donnees.get("classe") ?? "");
  if (!uuid.test(eleve) || !uuid.test(classe)) return { etat: "erreur", message: "Choisissez une classe." };
  const r = await preinscrireEleve(acteur, eleve, classe);
  if (r === null) return { etat: "erreur", message: "Refusé : la classe doit appartenir à l'année préparée." };
  revalidatePath(`/admin/eleves/${eleve}`);
  return { etat: "ok", message: r === "deja" ? "C'était déjà sa classe de l'an prochain." : "Classe de l'an prochain enregistrée ; elle s'applique à la bascule." };
}

/**
 * SEC-18 — demande d'effacement d'un compte (élève ou professeur). Le compte
 * est fermé tout de suite ; l'effacement définitif suit l'arbitrage du
 * responsable de traitement. Une erreur se corrige avec « Annuler la demande ».
 */
export async function gererEffacement(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const profil = String(donnees.get("profil") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profil)) return { etat: "erreur", message: "Compte introuvable." };
  const chemin = String(donnees.get("retour") ?? "");
  const retour = /^\/admin\/(eleves|professeurs)\/[0-9a-f-]{36}$/.test(chemin) ? chemin : "/admin";
  if (donnees.get("geste") === "annuler") {
    const ok = await annulerEffacement(acteur, profil);
    revalidatePath(retour);
    revalidatePath("/admin");
    return ok ? { etat: "ok", message: "Demande annulée : le compte retrouve son état d'avant." } : { etat: "erreur", message: "Aucune demande en cours pour ce compte." };
  }
  const motif = String(donnees.get("motif") ?? "").trim();
  if (motif.length < 10) return { etat: "erreur", message: "Indiquez l'origine de la demande (au moins dix caractères) : elle est gardée au journal." };
  const r = await demanderEffacement(acteur, profil, motif);
  if (r === null) return { etat: "erreur", message: "Refusé. Un compte d'administration se retire par l'exploitant." };
  revalidatePath(retour);
  revalidatePath("/admin");
  return { etat: "ok", message: r === "deja" ? "Une demande est déjà en cours." : "Demande enregistrée : le compte est fermé dès maintenant." };
}

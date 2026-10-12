"use server";

import { revalidatePath } from "next/cache";
import { changerEtatCompte } from "@/lib/acces";
import { apercuChangementClasse, changerClasse, departEleve, type MouvementCours } from "@/lib/etablissement";
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

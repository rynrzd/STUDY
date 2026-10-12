"use server";

import { revalidatePath } from "next/cache";
import {
  affecterProfesseurGroupe,
  assurerAnnee,
  contexte,
  creerGroupe,
  type GenreGroupe,
  groupeAjouterEleves,
  groupeRetirerEleve,
} from "@/lib/etablissement";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";

import type { EtatAdmin } from "../etats";

/**
 * Gestes d'administration des groupes pédagogiques — cahier des charges, ch. 07.
 *
 * Mêmes garde-fous que les gestes de classe : le rôle et le second facteur sont
 * revérifiés côté serveur ; l'établissement et l'année ne viennent jamais du
 * formulaire, ils sont recalculés en base à partir de l'adhésion de la personne.
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

async function anneeCourante(acteur: string): Promise<string | null> {
  const situation = await contexte(acteur);
  if (situation === null) return null;
  return situation.academicYearId ?? (await assurerAnnee(acteur));
}

function texte(donnees: FormData, champ: string, maximum: number): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur.trim().slice(0, maximum) : "";
}

function identifiant(donnees: FormData, champ: string): string | null {
  const valeur = donnees.get(champ);
  if (typeof valeur !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur) ? valeur : null;
}

/** Les UUID valides d'un champ à cases multiples (les élèves cochés). */
function identifiants(donnees: FormData, champ: string): string[] {
  return donnees
    .getAll(champ)
    .filter((v): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

export async function creerUnGroupe(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const label = texte(donnees, "label", 80);
  const kindBrut = texte(donnees, "kind", 20);
  const kind: GenreGroupe = kindBrut === "sous_groupe" ? "sous_groupe" : "interclasses";

  if (label.length < 2) {
    return { etat: "erreur", message: "Donnez un nom de groupe, par exemple « Spé Maths A »." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const cree = await creerGroupe(acteur, annee, label, kind);
  if (cree === null) {
    return { etat: "erreur", message: "Le groupe n'a pas pu être créé." };
  }

  revalidatePath("/admin/groupes");
  revalidatePath("/admin");
  return { etat: "ok", message: `Groupe « ${label} » créé.` };
}

export async function ajouterDesEleves(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const eleves = identifiants(donnees, "eleve");

  if (groupe === null) {
    return { etat: "erreur", message: "Groupe introuvable." };
  }
  if (eleves.length === 0) {
    return { etat: "erreur", message: "Sélectionnez au moins un élève." };
  }

  const ajoutes = await groupeAjouterEleves(acteur, groupe, eleves);
  if (ajoutes === null) {
    return { etat: "erreur", message: "L'ajout a été refusé. Vérifiez que ces élèves appartiennent à votre établissement." };
  }

  revalidatePath(`/admin/groupes/${groupe}`);
  revalidatePath("/admin/groupes");
  const dejaLa = eleves.length - ajoutes;
  const message =
    ajoutes === 0
      ? "Ces élèves font déjà partie du groupe."
      : `${ajoutes} élève${ajoutes > 1 ? "s" : ""} ajouté${ajoutes > 1 ? "s" : ""}${dejaLa > 0 ? `, ${dejaLa} déjà présent${dejaLa > 1 ? "s" : ""}` : ""}.`;
  return { etat: "ok", message };
}

export async function retirerUnEleve(donnees: FormData): Promise<void> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const eleve = identifiant(donnees, "eleve");
  if (groupe === null || eleve === null) return;
  await groupeRetirerEleve(acteur, groupe, eleve);
  revalidatePath(`/admin/groupes/${groupe}`);
  revalidatePath("/admin/groupes");
}

export async function affecterUnProfesseurAuGroupe(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const professeur = identifiant(donnees, "professeur");
  const matiere = identifiant(donnees, "matiere");

  if (groupe === null || professeur === null || matiere === null) {
    return { etat: "erreur", message: "Choisissez un professeur et une matière." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const espace = await affecterProfesseurGroupe(acteur, professeur, groupe, matiere, annee);
  if (espace === null) {
    return { etat: "erreur", message: "L'affectation a été refusée. Vérifiez que le professeur et la matière sont de votre établissement." };
  }

  revalidatePath(`/admin/groupes/${groupe}`);
  return { etat: "ok", message: "Professeur affecté au groupe." };
}

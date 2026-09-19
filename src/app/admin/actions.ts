"use server";

import { revalidatePath } from "next/cache";
import {
  affecterProfesseur,
  assurerAnnee,
  classes as listerClasses,
  contexte,
  creerClasse,
  creerCompte,
  creerMatiere,
  inscrireEleve,
  membres as listerMembres,
} from "@/lib/etablissement";
import { proposerLogin } from "@/lib/import-rentree";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Gestes unitaires d’administration.
 *
 * L’import de rentrée, lui, vit dans `src/app/admin/import/` : il a ses
 * propres étapes, son propre état en base et son propre écran de
 * vérification. Ici on crée une classe, une matière, un compte — une ligne
 * à la fois, pour l’élève qui arrive en janvier.
 */

import type { EtatAdmin } from "./etats";

async function exigerAdministrateur(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    throw new Error("Action refusée.");
  }
  return personne.profileId;
}

/* -------------------------------------------------------------------------- */
/* Gestes unitaires — cahier V2, §14.2 à §14.4                                */
/*                                                                            */
/* Chaque action relit le rôle et le contexte de l'établissement côté serveur. */
/* Rien de ce qui arrive du formulaire ne désigne l'établissement : il est     */
/* recalculé en base à partir de l'adhésion de la personne connectée.          */
/* -------------------------------------------------------------------------- */

/** Le texte d'un champ, nettoyé et borné. Vide si absent. */
function texte(donnees: FormData, champ: string, maximum: number): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur.trim().slice(0, maximum) : "";
}

/** Un identifiant attendu au format UUID, ou `null`. */
function identifiant(donnees: FormData, champ: string): string | null {
  const valeur = donnees.get(champ);
  if (typeof valeur !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur)
    ? valeur
    : null;
}

/**
 * L'année scolaire courante de l'établissement, créée si elle manque.
 *
 * Une classe sans année n'a pas de sens : c'est l'année qui rend « Seconde 4 »
 * distincte d'une « Seconde 4 » de l'an dernier.
 */
async function anneeCourante(acteur: string): Promise<string | null> {
  const situation = await contexte(acteur);
  if (situation === null) return null;
  return situation.academicYearId ?? (await assurerAnnee(acteur));
}

export async function creerUneClasse(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const label = texte(donnees, "label", 80);

  if (label.length < 2) {
    return { etat: "erreur", message: "Donnez un nom de classe, par exemple « Seconde 4 »." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const cree = await creerClasse(acteur, annee, label);
  if (cree === null) {
    return { etat: "erreur", message: "La classe n'a pas pu être créée." };
  }

  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  return { etat: "ok", message: `Classe « ${label} » enregistrée.` };
}

export async function creerUneMatiere(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const label = texte(donnees, "label", 80);

  if (label.length < 2) {
    return { etat: "erreur", message: "Donnez un nom de matière, par exemple « Mathématiques »." };
  }

  const cree = await creerMatiere(acteur, label);
  if (cree === null) {
    return { etat: "erreur", message: "La matière n'a pas pu être créée." };
  }

  revalidatePath("/admin/classes");
  return { etat: "ok", message: `Matière « ${label} » enregistrée.` };
}

/**
 * Crée un compte élève ou professeur.
 *
 * L'identifiant de connexion est calculé, pas saisi : `prenom.nom`, avec un
 * suffixe en cas de collision. Le laisser saisir libèrerait la porte aux
 * identifiants fantaisistes qu'un élève ne retape pas correctement en janvier.
 */
export async function creerUnCompte(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();

  const prenom = texte(donnees, "prenom", 60);
  const nom = texte(donnees, "nom", 60);
  const role = texte(donnees, "role", 20);
  const classe = identifiant(donnees, "classe");
  const email = texte(donnees, "email", 120);

  if (prenom.length < 2 || nom.length < 2) {
    return { etat: "erreur", message: "Renseignez le prénom et le nom." };
  }

  if (role !== "eleve" && role !== "professeur") {
    return { etat: "erreur", message: "Choisissez un rôle." };
  }

  if (role === "eleve" && classe === null) {
    return { etat: "erreur", message: "Un élève doit être inscrit dans une classe." };
  }

  const domaine = process.env.STUDENT_ALIAS_DOMAIN;
  if (domaine === undefined || domaine === "") {
    return {
      etat: "erreur",
      message: "La création de comptes est momentanément impossible. Signalez-le à AvecStudy.",
    };
  }

  // Les identifiants déjà pris viennent de la base, pas d'un cache : deux
  // administrateurs qui créent « Martin Dupont » en même temps n'obtiennent pas
  // le même identifiant.
  const existants = await listerMembres(acteur);
  const pris = new Set(existants.map((membre) => membre.local_login));
  const login = proposerLogin(prenom, nom, pris);

  // Le libellé de la classe ne sert qu'à la fiche imprimable. Il est relu en
  // base à partir de l'identifiant choisi, jamais repris du formulaire : ce
  // qui est imprimé doit correspondre à ce qui a été enregistré.
  const classeLabel =
    classe === null
      ? null
      : ((await listerClasses(acteur)).find((ligne) => ligne.id === classe)?.label ?? null);

  const resultat = await creerCompte({
    acteur,
    prenom,
    nom,
    login,
    role,
    classe,
    classeLabel,
    email: role === "professeur" && email !== "" ? email : null,
    domaineAlias: domaine,
  });

  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin");

  if (resultat.etat === "existant") {
    return {
      etat: "erreur",
      message: "Un compte porte déjà cet identifiant. Vérifiez la liste des utilisateurs.",
    };
  }

  if (resultat.etat === "echec") {
    return { etat: "erreur", message: `${resultat.raison}.` };
  }

  return {
    etat: "ok",
    message: `Compte créé pour ${prenom} ${nom}.`,
    acces: resultat.acces,
  };
}

export async function affecterUnProfesseur(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();

  const professeur = identifiant(donnees, "professeur");
  const classe = identifiant(donnees, "classe");
  const matiere = identifiant(donnees, "matiere");

  if (professeur === null || classe === null || matiere === null) {
    return { etat: "erreur", message: "Choisissez un professeur, une classe et une matière." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const fait = await affecterProfesseur({ acteur, professeur, classe, matiere, annee });
  if (!fait) {
    return {
      etat: "erreur",
      message: "L'affectation a été refusée. Vérifiez que le professeur appartient à votre établissement.",
    };
  }

  revalidatePath("/admin/classes");
  return { etat: "ok", message: "Affectation enregistrée. Le cours apparaît dans le Studio du professeur." };
}

export async function inscrireUnEleve(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();

  const eleve = identifiant(donnees, "eleve");
  const classe = identifiant(donnees, "classe");

  if (eleve === null || classe === null) {
    return { etat: "erreur", message: "Choisissez un élève et une classe." };
  }

  const fait = await inscrireEleve(acteur, eleve, classe);
  if (!fait) {
    return { etat: "erreur", message: "L'inscription a été refusée." };
  }

  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/classes");
  return { etat: "ok", message: "Élève inscrit dans la classe." };
}

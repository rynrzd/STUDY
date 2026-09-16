"use server";

import { revalidatePath } from "next/cache";
import {
  affecterProfesseur,
  appliquerImport,
  assurerAnnee,
  classes as listerClasses,
  contexte,
  creerClasse,
  creerCompte,
  creerMatiere,
  empreinteApercu,
  inscrireEleve,
  membres as listerMembres,
} from "@/lib/etablissement";
import {
  analyser,
  colonnesManquantes,
  LIGNES_PAR_IMPORT,
  proposerLogin,
  reconnaitreColonnes,
} from "@/lib/import-rentree";
import { sessionCourante } from "@/lib/session-serveur";
import { FichierIllisible, lireTableur, TAILLE_MAXIMALE } from "@/lib/tableur";

/**
 * Import de rentrée : aperçu, puis confirmation.
 *
 * Le fichier est envoyé deux fois — une fois pour l'aperçu, une fois pour la
 * confirmation — et il n'est **jamais stocké entre les deux**. C'est un choix
 * de conception : garder un fichier d'élèves dans un espace temporaire le temps
 * qu'une personne se décide, c'est créer une copie de données scolaires dont
 * personne ne surveille la durée de vie.
 *
 * L'empreinte de l'aperçu lie les deux étapes : si le fichier a changé, la
 * confirmation est refusée.
 */

import type { EtatAdmin, EtatImport } from "./etats";

async function exigerAdministrateur(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    throw new Error("Action refusée.");
  }
  return personne.profileId;
}

async function lireFichier(donnees: FormData): Promise<{ nom: string; contenu: Buffer }> {
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    throw new FichierIllisible("Aucun fichier n'a été déposé.");
  }
  if (fichier.size > TAILLE_MAXIMALE) {
    throw new FichierIllisible("Le fichier dépasse 5 Mo.");
  }
  return { nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()) };
}

/* ---------------------------------------------------------- Étape 1 ------ */

export async function analyserFichier(
  _precedent: EtatImport,
  donnees: FormData,
): Promise<EtatImport> {
  const acteur = await exigerAdministrateur();

  let tableau;
  let nom: string;
  try {
    const fichier = await lireFichier(donnees);
    nom = fichier.nom;
    tableau = lireTableur(fichier.nom, fichier.contenu);
  } catch (erreur) {
    return {
      etape: "erreur",
      message:
        erreur instanceof FichierIllisible
          ? erreur.message
          : "Ce fichier n'a pas pu être lu. Déposez un .xlsx ou un .csv.",
    };
  }

  const correspondance = reconnaitreColonnes(tableau.entetes);
  const manquantes = colonnesManquantes(correspondance);

  if (manquantes.length > 0) {
    return {
      etape: "erreur",
      message:
        `Colonnes non reconnues : ${manquantes.join(", ")}. ` +
        `La première ligne du fichier doit nommer les colonnes — par exemple « Nom », « Prénom », « Classe ». ` +
        `Intitulés trouvés : ${tableau.entetes.filter((entete) => entete !== "").join(", ")}.`,
    };
  }

  const existants = (await listerMembres(acteur)).map((membre) => membre.local_login);
  const analyse = analyser(tableau, correspondance, existants);

  if (analyse.valides.length === 0) {
    return {
      etape: "erreur",
      message: "Aucune ligne exploitable dans ce fichier.",
      lignes: analyse.rejetees.slice(0, 50),
    };
  }

  if (analyse.valides.length > LIGNES_PAR_IMPORT) {
    return {
      etape: "erreur",
      message:
        `Ce fichier contient ${analyse.valides.length} élèves. ` +
        `Découpez-le en lots de ${LIGNES_PAR_IMPORT} au maximum : chaque élève reçoit un compte, ` +
        `et un lot trop grand risquerait d'être interrompu au milieu.`,
    };
  }

  return {
    etape: "apercu",
    resume: analyse.resume,
    lignes: analyse.lignes.slice(0, 400),
    classes: analyse.classes,
    empreinte: empreinteApercu(analyse.valides),
    message: nom,
  };
}

/* ---------------------------------------------------------- Étape 2 ------ */

export async function confirmerImport(
  _precedent: EtatImport,
  donnees: FormData,
): Promise<EtatImport> {
  const acteur = await exigerAdministrateur();
  const empreinteAttendue = String(donnees.get("empreinte") ?? "");

  const situation = await contexte(acteur);
  if (situation === null) {
    return { etape: "erreur", message: "Votre compte n'administre aucun établissement actif." };
  }

  let tableau;
  let nom: string;
  try {
    const fichier = await lireFichier(donnees);
    nom = fichier.nom;
    tableau = lireTableur(fichier.nom, fichier.contenu);
  } catch (erreur) {
    return {
      etape: "erreur",
      message: erreur instanceof FichierIllisible ? erreur.message : "Ce fichier n'a pas pu être lu.",
    };
  }

  const correspondance = reconnaitreColonnes(tableau.entetes);
  const existants = (await listerMembres(acteur)).map((membre) => membre.local_login);
  const analyse = analyser(tableau, correspondance, existants);

  if (empreinteApercu(analyse.valides) !== empreinteAttendue) {
    return {
      etape: "erreur",
      message:
        "Le fichier a changé depuis l'aperçu, ou des comptes ont été créés entre-temps. " +
        "Relancez l'analyse et vérifiez le nouvel aperçu avant de confirmer.",
    };
  }

  const domaine = process.env.STUDENT_ALIAS_DOMAIN;
  if (domaine === undefined || domaine === "") {
    return {
      etape: "erreur",
      message: "L'import est momentanément impossible. Signalez-le à votre interlocuteur AvecStudy.",
    };
  }

  const annee = situation.academicYearId ?? (await assurerAnnee(acteur));
  if (annee === null) {
    return { etape: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const resultat = await appliquerImport({
    acteur,
    annee,
    domaineAlias: domaine,
    lignes: analyse.valides,
    nomFichier: nom,
  });

  revalidatePath("/admin");

  return {
    etape: "termine",
    resume: {
      lues: analyse.resume.lues,
      valides: resultat.crees,
      rejetees: analyse.resume.rejetees + resultat.echecs.length,
      classes: analyse.resume.classes,
    },
    acces: resultat.acces,
    echecs: resultat.echecs,
    message:
      resultat.existants > 0
        ? `${resultat.existants} élève(s) étaient déjà enregistrés : ils n'ont pas été recréés.`
        : undefined,
  };
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

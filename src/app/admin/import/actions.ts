"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decouperCellule } from "@/lib/assistant-rentree";
import { assurerAnnee, contexte } from "@/lib/etablissement";
import {
  analyserLotProfesseurs,
  appliquerLotProfesseurs,
  corrigerLigneProfesseur,
} from "@/lib/lot-professeurs";
import {
  analyserLot,
  appliquerLot,
  corrigerLigne,
  definirClasse,
  type FichierDepose,
} from "@/lib/lot-rentree";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";
import { TAILLE_MAXIMALE } from "@/lib/tableur";

import type {
  EtatCorrection,
  EtatCreation,
  EtatCreationProfesseurs,
  EtatDepot,
} from "./etats";

/**
 * L'assistant de rentrée — cahier V5, §5.
 *
 * Trois moments, et l'ordre compte : déposer, vérifier, créer. Aucun compte
 * n'existe avant le troisième, et le troisième reste fermé tant que le
 * deuxième signale une erreur bloquante.
 *
 * L'établissement n'est jamais lu dans le formulaire. Il est recalculé à
 * chaque appel depuis la session, puis revérifié en base par
 * `study.etab_contexte`. Un administrateur qui changerait un identifiant de
 * lot dans l'adresse tombe sur « introuvable », pas sur le lot d'un autre
 * lycée.
 */

/** Nombre de fichiers acceptés d'un coup : un lycée dépose ses classes. */
const FICHIERS_MAXIMUM = 40;

async function exigerAdministrateur(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    throw new Error("Action refusée.");
  }

  // C'est l'action qui fabrique des élèves par centaines et imprime leurs
  // accès. Le second facteur y est exigé au même titre que chez l'exploitant,
  // et il est vérifié **ici** plutôt que dans l'écran : une action serveur
  // s'atteint directement, sans passer par le gabarit qui la masque.
  if (!(await assuranceSuffisante(personne))) {
    throw new Error(REFUS_ASSURANCE);
  }

  return personne.profileId;
}

/* -------------------------------------------------------------------------- */
/* 1. Déposer                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lit les fichiers déposés, enregistre le lot et emmène à la vérification.
 *
 * Les fichiers illisibles ne font pas échouer le dépôt : ils sont portés au
 * lot avec leur motif de rejet, visibles sur l'écran suivant. Un lycée qui
 * dépose douze fichiers dont un vieux .doc doit pouvoir traiter les onze
 * autres sans tout recommencer (§5.1).
 */
export async function deposerFichiers(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const acteur = await exigerAdministrateur();

  const situation = await contexte(acteur);
  if (situation === null) {
    return { etat: "erreur", message: "Votre établissement n'est pas encore ouvert." };
  }

  const bruts = donnees.getAll("fichiers").filter((entree): entree is File => entree instanceof File);
  const retenus = bruts.filter((fichier) => fichier.size > 0);

  if (retenus.length === 0) {
    return { etat: "erreur", message: "Choisissez au moins un fichier." };
  }
  if (retenus.length > FICHIERS_MAXIMUM) {
    return {
      etat: "erreur",
      message: `Déposez au plus ${FICHIERS_MAXIMUM} fichiers à la fois.`,
    };
  }

  // Le cumul est plafonné aussi : quarante fichiers de cinq mégaoctets
  // tiendraient la mémoire du serveur pendant toute la lecture.
  const cumul = retenus.reduce((total, fichier) => total + fichier.size, 0);
  if (cumul > TAILLE_MAXIMALE * 8) {
    return { etat: "erreur", message: "L'ensemble déposé est trop volumineux. Procédez en deux fois." };
  }

  const fichiers: FichierDepose[] = [];
  for (const fichier of retenus) {
    fichiers.push({ nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()) });
  }

  const annee = situation.academicYearId ?? (await assurerAnnee(acteur));
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const resultat = await analyserLot({
    acteur,
    organisation: situation.organizationId,
    annee,
    fichiers,
  });

  if ("erreur" in resultat) {
    return { etat: "erreur", message: resultat.erreur };
  }

  redirect(`/admin/import/${resultat.lot}`);
}

/* -------------------------------------------------------------------------- */
/* 2. Corriger                                                                 */
/* -------------------------------------------------------------------------- */

/** Fixe la classe d'un fichier dont la détection a échoué (§5.2). */
export async function fixerClasse(
  _precedent: EtatCorrection,
  donnees: FormData,
): Promise<EtatCorrection> {
  const acteur = await exigerAdministrateur();

  const job = String(donnees.get("job") ?? "");
  const classe = String(donnees.get("classe") ?? "").trim();
  const lot = String(donnees.get("lot") ?? "");

  if (classe === "") {
    return { etat: "erreur", message: "Indiquez le nom de la classe." };
  }

  const fait = await definirClasse({ acteur, job, classe });
  if (!fait) {
    return { etat: "erreur", message: "Ce fichier n'a pas pu être mis à jour." };
  }

  revalidatePath(`/admin/import/${lot}`);
  return { etat: "ok", message: `Classe fixée à « ${classe} ».` };
}

/** Corrige une ligne en attente, puis recalcule son sort (§5.5). */
export async function reparerLigne(
  _precedent: EtatCorrection,
  donnees: FormData,
): Promise<EtatCorrection> {
  const acteur = await exigerAdministrateur();

  const ligne = String(donnees.get("ligne") ?? "");
  const lot = String(donnees.get("lot") ?? "");
  const nom = String(donnees.get("nom") ?? "");
  const prenom = String(donnees.get("prenom") ?? "");
  const classe = String(donnees.get("classe") ?? "");

  if (nom.trim() === "" || prenom.trim() === "" || classe.trim() === "") {
    return { etat: "erreur", message: "Nom, prénom et classe sont obligatoires." };
  }

  const fait = await corrigerLigne({ acteur, ligne, nom, prenom, classe });
  if (!fait) {
    return { etat: "erreur", message: "Cette ligne n'a pas pu être corrigée." };
  }

  revalidatePath(`/admin/import/${lot}`);
  return { etat: "ok", message: "Ligne corrigée." };
}

/* -------------------------------------------------------------------------- */
/* 3. Créer                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Crée les comptes du lot.
 *
 * C'est le seul point du produit qui fabrique des élèves en masse. Il refuse
 * de s'exécuter deux fois : le lot passe à « appliqué » à la fin, et un second
 * envoi — double clic, page rechargée, retour arrière — ressort en erreur
 * plutôt qu'en huit cents doublons.
 */
export async function creerLesComptes(
  _precedent: EtatCreation,
  donnees: FormData,
): Promise<EtatCreation> {
  const acteur = await exigerAdministrateur();

  const lot = String(donnees.get("lot") ?? "");
  if (lot === "") {
    return { etat: "erreur", message: "Lot introuvable." };
  }

  const situation = await contexte(acteur);
  if (situation === null) {
    return { etat: "erreur", message: "Votre établissement n'est pas encore ouvert." };
  }

  const domaine = process.env.STUDENT_ALIAS_DOMAIN;
  if (domaine === undefined || domaine === "") {
    return {
      etat: "erreur",
      message: "La création est momentanément impossible. Signalez-le à votre interlocuteur AvecStudy.",
    };
  }

  const annee = situation.academicYearId ?? (await assurerAnnee(acteur));
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const rapport = await appliquerLot({
    acteur,
    organisation: situation.organizationId,
    annee,
    lot,
    domaineAlias: domaine,
  });

  if ("erreur" in rapport) {
    return { etat: "erreur", message: rapport.erreur };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/import/${lot}`);

  return {
    etat: "termine",
    cree: rapport.cree,
    existant: rapport.existant,
    reinscrit: rapport.reinscrit,
    erreurs: rapport.erreurs,
    acces: rapport.acces,
    echecs: rapport.echecs,
  };
}

/* -------------------------------------------------------------------------- */
/* Professeurs — cahier V5, §6                                                 */
/* -------------------------------------------------------------------------- */

/** Lit les fichiers de professeurs et emmène à leur vérification. */
export async function deposerProfesseurs(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const acteur = await exigerAdministrateur();

  const situation = await contexte(acteur);
  if (situation === null) {
    return { etat: "erreur", message: "Votre établissement n'est pas encore ouvert." };
  }

  const retenus = donnees
    .getAll("fichiers")
    .filter((entree): entree is File => entree instanceof File && entree.size > 0);

  if (retenus.length === 0) {
    return { etat: "erreur", message: "Choisissez au moins un fichier." };
  }
  if (retenus.length > FICHIERS_MAXIMUM) {
    return { etat: "erreur", message: `Déposez au plus ${FICHIERS_MAXIMUM} fichiers à la fois.` };
  }

  const cumul = retenus.reduce((total, fichier) => total + fichier.size, 0);
  if (cumul > TAILLE_MAXIMALE * 8) {
    return {
      etat: "erreur",
      message: "L'ensemble déposé est trop volumineux. Procédez en deux fois.",
    };
  }

  const fichiers: FichierDepose[] = [];
  for (const fichier of retenus) {
    fichiers.push({ nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()) });
  }

  const annee = situation.academicYearId ?? (await assurerAnnee(acteur));
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const resultat = await analyserLotProfesseurs({
    acteur,
    organisation: situation.organizationId,
    annee,
    fichiers,
  });

  if ("erreur" in resultat) {
    return { etat: "erreur", message: resultat.erreur };
  }

  redirect(`/admin/import/profs/${resultat.lot}`);
}

/**
 * Corrige une ligne de professeur.
 *
 * Les affectations arrivent en texte libre — « Maths : 2DE1, 2DE2 » par
 * ligne — parce que c'est la forme qu'un secrétariat relit le plus vite. Elles
 * repartent en triplets propres, qui sont la seule forme que la base accepte.
 */
export async function reparerLigneProfesseur(
  _precedent: EtatCorrection,
  donnees: FormData,
): Promise<EtatCorrection> {
  const acteur = await exigerAdministrateur();

  const ligne = String(donnees.get("ligne") ?? "");
  const lot = String(donnees.get("lot") ?? "");
  const nom = String(donnees.get("nom") ?? "");
  const prenom = String(donnees.get("prenom") ?? "");
  const brut = String(donnees.get("affectations") ?? "");

  const affectations = lireAffectations(brut);

  if (nom.trim() === "" || prenom.trim() === "") {
    return { etat: "erreur", message: "Nom et prénom sont obligatoires." };
  }
  if (affectations.length === 0) {
    return {
      etat: "erreur",
      message: "Indiquez au moins une affectation, sous la forme « Matière : classe, classe ».",
    };
  }

  const fait = await corrigerLigneProfesseur({ acteur, ligne, nom, prenom, affectations });
  if (!fait) {
    return { etat: "erreur", message: "Cette ligne n'a pas pu être corrigée." };
  }

  revalidatePath(`/admin/import/profs/${lot}`);
  return {
    etat: "ok",
    message: `${affectations.length} affectation${affectations.length > 1 ? "s" : ""} enregistrée${
      affectations.length > 1 ? "s" : ""
    }.`,
  };
}

/**
 * Lit « Mathématiques : 2DE1, 2DE2 » ligne par ligne.
 *
 * Une ligne sans deux-points n'est pas devinée : elle est ignorée. Deviner
 * quelle moitié est la matière reviendrait à décider en silence, ce que le
 * §5.2 interdit — et ici la conséquence serait un professeur affecté à une
 * classe qu'il n'a pas.
 */
function lireAffectations(brut: string): { matiere: string; classe: string }[] {
  const sortie: { matiere: string; classe: string }[] = [];

  for (const ligne of brut.split(/\r?\n/)) {
    const separateur = ligne.indexOf(":");
    if (separateur === -1) continue;

    const matiere = ligne.slice(0, separateur).trim();
    if (matiere === "") continue;

    for (const classe of decouperCellule(ligne.slice(separateur + 1))) {
      sortie.push({ matiere, classe });
    }
  }

  return sortie;
}

/** Crée les comptes professeurs du lot et pose leurs affectations. */
export async function creerLesProfesseurs(
  _precedent: EtatCreationProfesseurs,
  donnees: FormData,
): Promise<EtatCreationProfesseurs> {
  const acteur = await exigerAdministrateur();

  const lot = String(donnees.get("lot") ?? "");
  if (lot === "") {
    return { etat: "erreur", message: "Lot introuvable." };
  }

  const situation = await contexte(acteur);
  if (situation === null) {
    return { etat: "erreur", message: "Votre établissement n'est pas encore ouvert." };
  }

  const domaine = process.env.STUDENT_ALIAS_DOMAIN;
  if (domaine === undefined || domaine === "") {
    return {
      etat: "erreur",
      message:
        "La création est momentanément impossible. Signalez-le à votre interlocuteur AvecStudy.",
    };
  }

  const annee = situation.academicYearId ?? (await assurerAnnee(acteur));
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const rapport = await appliquerLotProfesseurs({
    acteur,
    annee,
    lot,
    domaineAlias: domaine,
  });

  if ("erreur" in rapport) {
    return { etat: "erreur", message: rapport.erreur };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/import/profs/${lot}`);

  return {
    etat: "termine",
    cree: rapport.cree,
    existant: rapport.existant,
    affectations: rapport.affectations,
    erreurs: rapport.erreurs,
    acces: rapport.acces,
    echecs: rapport.echecs,
  };
}

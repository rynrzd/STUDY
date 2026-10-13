"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decouperCellule, reconnaitreColonnes, type Champ, type Correspondance } from "@/lib/assistant-rentree";
import { assurerAnnee, contexte, importGroupes } from "@/lib/etablissement";
import { lireGroupes } from "@/lib/import-groupes";
import {
  analyserLotProfesseurs,
  appliquerLotProfesseurs,
  corrigerLigneProfesseur,
  renommerMatiereDuLot,
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
import { FichierIllisible, lireTableur, TAILLE_MAXIMALE } from "@/lib/tableur";

import type {
  EtatColonnes,
  EtatImportGroupes,
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
/* 0. Vérifier les colonnes (cahier des charges ch. 17, étape 2)               */
/* -------------------------------------------------------------------------- */

const CHAMPS_ELEVES: readonly Champ[] = ["nom", "prenom", "classe", "email", "identifiantExterne"];
const CHAMPS_PROFESSEURS: readonly Champ[] = ["nom", "prenom", "email", "matieres", "classes"];

/**
 * Correspondances choisies à l'écran, par nom de fichier. Le champ arrive en
 * JSON ; tout ce qui n'est pas un champ connu associé à un index entier est
 * écarté. Les index sont ensuite bornés au tableau lu (lot-rentree).
 */
function correspondancesChoisies(donnees: FormData, champs: readonly Champ[]): Map<string, Correspondance> {
  const sortie = new Map<string, Correspondance>();
  const brut = donnees.get("correspondances");
  if (typeof brut !== "string" || brut.length === 0 || brut.length > 20_000) return sortie;
  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return sortie;
  }
  if (lu === null || typeof lu !== "object" || Array.isArray(lu)) return sortie;
  for (const [nom, valeur] of Object.entries(lu as Record<string, unknown>)) {
    if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) continue;
    const c: Correspondance = {};
    for (const champ of champs) {
      const index = (valeur as Record<string, unknown>)[champ];
      if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < 200) c[champ] = index;
    }
    sortie.set(nom, c);
  }
  return sortie;
}

/**
 * Lit les colonnes des fichiers choisis, sans rien enregistrer (IMP-01) : ni
 * lot, ni ligne, ni fichier conservé. L'écran montre ce qui a été compris et
 * l'administrateur corrige avant l'analyse.
 */
export async function lireColonnes(cible: "eleves" | "professeurs", _precedent: EtatColonnes, donnees: FormData): Promise<EtatColonnes> {
  await exigerAdministrateur();
  const retenus = donnees.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (retenus.length === 0) return { etat: "erreur", message: "Choisissez au moins un fichier." };
  if (retenus.length > FICHIERS_MAXIMUM) return { etat: "erreur", message: `Déposez au plus ${FICHIERS_MAXIMUM} fichiers à la fois.` };
  if (retenus.reduce((n, f) => n + f.size, 0) > TAILLE_MAXIMALE * 8) {
    return { etat: "erreur", message: "L'ensemble déposé est trop volumineux. Procédez en deux fois." };
  }

  const champs = cible === "eleves" ? CHAMPS_ELEVES : CHAMPS_PROFESSEURS;
  const fichiers = [];
  for (const fichier of retenus) {
    if (fichier.size > TAILLE_MAXIMALE) {
      fichiers.push({ nom: fichier.name, colonnes: [], echantillon: [], lignes: 0, erreur: "Ce fichier est trop volumineux." });
      continue;
    }
    try {
      const tableau = lireTableur(fichier.name, Buffer.from(await fichier.arrayBuffer()));
      fichiers.push({
        nom: fichier.name,
        colonnes: reconnaitreColonnes(tableau, champs).map((c) => ({ ...c, entete: c.entete.slice(0, 60) })),
        echantillon: tableau.lignes.slice(0, 3).map((l) => tableau.entetes.map((_, i) => (l[i] ?? "").slice(0, 40))),
        lignes: tableau.lignes.length,
        erreur: null,
      });
    } catch (erreur) {
      fichiers.push({
        nom: fichier.name,
        colonnes: [],
        echantillon: [],
        lignes: 0,
        erreur: erreur instanceof FichierIllisible ? erreur.message : "Ce fichier n'a pas pu être lu. Déposez un .xlsx ou un .csv.",
      });
    }
  }
  return { etat: "ok", fichiers };
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

  const choisies = correspondancesChoisies(donnees, CHAMPS_ELEVES);
  const fichiers: FichierDepose[] = [];
  for (const fichier of retenus) {
    fichiers.push({ nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()), correspondance: choisies.get(fichier.name) });
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
    confirmerConflits: donnees.get("confirmer_conflits") === "oui",
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
    ecartes: rapport.ecartes,
    restantes: rapport.restantes,
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

  const choisies = correspondancesChoisies(donnees, CHAMPS_PROFESSEURS);
  const fichiers: FichierDepose[] = [];
  for (const fichier of retenus) {
    fichiers.push({ nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()), correspondance: choisies.get(fichier.name) });
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

/* -------------------------------------------------------------------------- */
/* Groupes (cahier des charges ch. 17, IMP-05)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Import de groupes depuis un fichier. « Analyser » ne crée rien (IMP-01) ;
 * « Appliquer » relit le même fichier et n'écrit que ce qui a été coché :
 * appartenances, enseignements, ou les deux (validation séparée). Rejouable
 * sans doublon ; l'établissement est recalculé en base.
 */
export async function importerGroupes(_precedent: EtatImportGroupes, donnees: FormData): Promise<EtatImportGroupes> {
  const acteur = await exigerAdministrateur();
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { etat: "erreur", message: "Choisissez un fichier." };
  if (fichier.size > TAILLE_MAXIMALE) return { etat: "erreur", message: "Ce fichier est trop volumineux." };

  let tableau;
  try {
    tableau = lireTableur(fichier.name, Buffer.from(await fichier.arrayBuffer()));
  } catch (erreur) {
    return { etat: "erreur", message: erreur instanceof FichierIllisible ? erreur.message : "Ce fichier n'a pas pu être lu. Déposez un .xlsx ou un .csv." };
  }
  const lu = lireGroupes(tableau);
  if (lu.erreur !== null) return { etat: "erreur", message: lu.erreur };
  if (lu.lignes.length === 0) return { etat: "erreur", message: "Le fichier ne contient aucune ligne." };

  const appliquer = donnees.get("mode") === "appliquer";
  const appartenances = donnees.get("appartenances") === "oui";
  const enseignements = donnees.get("enseignements") === "oui";
  if (appliquer && !appartenances && !enseignements) return { etat: "erreur", message: "Cochez ce qu'il faut créer : les élèves dans les groupes, les enseignements, ou les deux." };

  const resultat = await importGroupes(acteur, lu.lignes, { appliquer, appartenances, enseignements });
  if (resultat === null) return { etat: "erreur", message: "L'import n'a pas pu être traité. Réessayez ; rien n'a été créé à moitié pour une ligne." };
  if (appliquer) {
    revalidatePath("/admin/groupes");
    revalidatePath("/admin");
  }
  return { etat: "ok", resultat };
}

/** IMP-17 : utiliser une matière déjà créée à la place de celle du fichier, sur choix explicite. */
export async function utiliserMatiereExistante(_precedent: EtatCorrection, donnees: FormData): Promise<EtatCorrection> {
  const acteur = await exigerAdministrateur();
  const lot = String(donnees.get("lot") ?? "");
  const de = String(donnees.get("de") ?? "");
  const vers = String(donnees.get("vers") ?? "");
  const n = await renommerMatiereDuLot({ acteur, lot, de, vers });
  if (n === null) return { etat: "erreur", message: "Le remplacement n'a pas pu être fait." };
  revalidatePath(`/admin/import/profs/${lot}`);
  return { etat: "ok", message: `« ${de} » remplacée par « ${vers} » sur ${n} ligne${n > 1 ? "s" : ""}.` };
}

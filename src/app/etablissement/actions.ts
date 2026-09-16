"use server";

import { revalidatePath } from "next/cache";
import {
  appliquerImport,
  assurerAnnee,
  contexte,
  empreinteApercu,
  membres as listerMembres,
} from "@/lib/etablissement";
import {
  analyser,
  colonnesManquantes,
  LIGNES_PAR_IMPORT,
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

import type { EtatImport } from "./etats";

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

  revalidatePath("/etablissement");

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

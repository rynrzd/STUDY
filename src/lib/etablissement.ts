import "server-only";

import { createHash } from "node:crypto";
import { genererAliasTechnique, genererMotDePasseTemporaire } from "./identite.ts";
import type { LigneImport } from "./import-rentree.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Administration d'établissement — section 5.4 du cahier de finition.
 *
 * L'établissement n'est jamais pris dans un paramètre : il est recalculé en
 * base à partir de l'adhésion de la personne connectée, par
 * `study.etab_contexte`. Un administrateur ne peut donc pas agir sur un autre
 * lycée, même en forgeant une requête.
 */

export interface ContexteEtablissement {
  readonly organizationId: string;
  readonly organisation: string;
  readonly publicCode: string;
  readonly etat: string;
  readonly academicYearId: string | null;
  readonly anneeLabel: string | null;
}

export async function contexte(acteur: string): Promise<ContexteEtablissement | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_contexte", { p_acteur: acteur });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.contexte", code: error.code }));
    return null;
  }

  const ligne = Array.isArray(data) ? data[0] : null;
  if (ligne === null || ligne === undefined) return null;

  return {
    organizationId: ligne.organization_id,
    organisation: ligne.organisation,
    publicCode: ligne.public_code,
    etat: ligne.etat,
    academicYearId: ligne.academic_year_id,
    anneeLabel: ligne.annee_label,
  };
}

export interface ClasseEtablissement {
  readonly id: string;
  readonly label: string;
  readonly class_code: string;
  readonly effectif: number;
}

export async function classes(acteur: string): Promise<ClasseEtablissement[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_classes", { p_acteur: acteur });
  if (error !== null) return [];
  return (data ?? []) as unknown as ClasseEtablissement[];
}

export interface MembreEtab {
  readonly profile_id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly local_login: string;
  readonly roles: string[];
  readonly account_state: string;
  readonly classe: string | null;
}

export async function membres(acteur: string): Promise<MembreEtab[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_membres", { p_acteur: acteur, p_limite: 2000 });
  if (error !== null) return [];
  return (data ?? []) as unknown as MembreEtab[];
}

/** Année scolaire courante, créée si elle manque. */
export async function assurerAnnee(acteur: string): Promise<string | null> {
  const maintenant = new Date();
  // Une année scolaire commence en septembre : avant septembre, on est encore
  // dans celle qui a commencé l'année civile précédente.
  const debut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;

  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_assurer_annee", {
    p_acteur: acteur,
    p_label: `${debut}-${debut + 1}`,
    p_debut: `${debut}-09-01`,
    p_fin: `${debut + 1}-07-15`,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.annee", code: error.code }));
    return null;
  }
  return String(data);
}

/* -------------------------------------------------------------------------- */
/* Application d'un import                                                     */
/* -------------------------------------------------------------------------- */

export interface AccesEleve {
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string;
  readonly login: string;
  readonly motDePasseTemporaire: string;
}

export interface ResultatImport {
  readonly crees: number;
  readonly existants: number;
  readonly echecs: { readonly ligne: number; readonly raison: string }[];
  readonly acces: AccesEleve[];
}

/**
 * Crée les comptes élèves d'un import déjà vérifié.
 *
 * Pour chaque ligne : un compte chez le fournisseur d'identité, puis les lignes
 * en base. En cas d'échec de la base, le compte fournisseur est supprimé — sans
 * quoi l'alias resterait pris et la ligne ne pourrait plus jamais être
 * réimportée.
 *
 * Les mots de passe temporaires sont renvoyés **une seule fois**, pour la fiche
 * imprimable. Rien ne les conserve de notre côté.
 */
export async function appliquerImport(options: {
  acteur: string;
  annee: string;
  domaineAlias: string;
  lignes: readonly LigneImport[];
  nomFichier: string;
}): Promise<ResultatImport> {
  const client = clientExploitation("administration_des_comptes");

  let crees = 0;
  let existants = 0;
  const echecs: { ligne: number; raison: string }[] = [];
  const acces: AccesEleve[] = [];

  for (const ligne of options.lignes) {
    const motDePasse = genererMotDePasseTemporaire(16);
    const alias = genererAliasTechnique(options.domaineAlias);

    const creation = await client.auth.admin.createUser({
      email: alias,
      password: motDePasse,
      email_confirm: true,
    });

    if (creation.error !== null || creation.data.user === null) {
      echecs.push({ ligne: ligne.numero, raison: "Compte de connexion non créé" });
      continue;
    }

    const profileId = creation.data.user.id;

    const { data, error } = await client.rpc("etab_importer_eleve", {
      p_acteur: options.acteur,
      p_annee: options.annee,
      p_profile: profileId,
      p_prenom: ligne.prenom,
      p_nom: ligne.nom,
      p_login: ligne.login,
      p_alias: alias,
      p_classe_label: ligne.classe,
      p_identifiant_externe: ligne.identifiantExterne,
    });

    if (error !== null) {
      await client.auth.admin.deleteUser(profileId).catch(() => undefined);
      echecs.push({
        ligne: ligne.numero,
        raison: error.code === "23505" ? "Identifiant déjà utilisé" : "Écriture refusée",
      });
      continue;
    }

    if (data === "existant") {
      await client.auth.admin.deleteUser(profileId).catch(() => undefined);
      existants += 1;
      continue;
    }

    crees += 1;
    acces.push({
      prenom: ligne.prenom,
      nom: ligne.nom,
      classe: ligne.classe,
      login: ligne.login,
      motDePasseTemporaire: motDePasse,
    });
  }

  // La trace ne doit pas faire échouer un import déjà appliqué : si elle ne
  // part pas, on le signale dans le journal technique et on rend la main.
  const { error: erreurJournal } = await client.rpc("etab_journaliser_import", {
    p_acteur: options.acteur,
    p_crees: crees,
    p_existants: existants,
    p_rejetes: echecs.length,
    p_fichier: options.nomFichier,
  });

  if (erreurJournal !== null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "etab.journal_import", code: erreurJournal.code }),
    );
  }

  return { crees, existants, echecs, acces };
}

/**
 * Empreinte de l'aperçu confirmé.
 *
 * Elle lie la confirmation à ce qui a été montré. Si le fichier a changé entre
 * l'aperçu et la confirmation — un onglet resté ouvert, un fichier corrigé
 * entre-temps — l'empreinte ne correspond plus et l'import est refusé plutôt
 * qu'appliqué sur des données que personne n'a relues.
 */
export function empreinteApercu(lignes: readonly LigneImport[]): string {
  const contenu = lignes
    .map((ligne) => `${ligne.numero}|${ligne.login}|${ligne.prenom}|${ligne.nom}|${ligne.classe}`)
    .join("\n");
  return createHash("sha256").update(contenu).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Gestes unitaires — cahier V2, §14.2 a §14.4                                */
/*                                                                            */
/* L'import de rentree est le bon geste pour huit cents eleves en septembre.   */
/* Il ne l'est pas pour l'eleve qui arrive en janvier, ni pour le remplacant   */
/* nomme un mardi matin. D'ou ces fonctions, qui creent une ligne a la fois.   */
/* -------------------------------------------------------------------------- */

export interface Matiere {
  readonly id: string;
  readonly label: string;
  readonly subject_code: string;
}

export async function matieres(acteur: string): Promise<Matiere[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_matieres", { p_acteur: acteur });
  if (error !== null) return [];
  return (data ?? []) as unknown as Matiere[];
}

export interface Affectation {
  readonly teaching_space_id: string;
  readonly class_id: string;
  readonly classe: string;
  readonly matiere: string;
  readonly professeur_id: string | null;
  readonly prenom: string | null;
  readonly nom: string | null;
}

export async function affectations(acteur: string): Promise<Affectation[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_affectations", { p_acteur: acteur });
  if (error !== null) return [];
  return (data ?? []) as unknown as Affectation[];
}

/** Cree une classe. Renvoie son identifiant, ou `null` si la base a refuse. */
export async function creerClasse(
  acteur: string,
  annee: string,
  label: string,
): Promise<string | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_creer_classe", {
    p_acteur: acteur,
    p_annee: annee,
    p_label: label,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.creer_classe", code: error.code }));
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function creerMatiere(acteur: string, label: string): Promise<string | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_creer_matiere", {
    p_acteur: acteur,
    p_label: label,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.creer_matiere", code: error.code }));
    return null;
  }
  return typeof data === "string" ? data : null;
}

export interface AccesCree {
  readonly prenom: string;
  readonly nom: string;
  readonly role: "eleve" | "professeur";
  readonly classe: string | null;
  readonly login: string;
  readonly motDePasseTemporaire: string;
}

export type ResultatCreationCompte =
  | { readonly etat: "cree"; readonly acces: AccesCree }
  | { readonly etat: "existant" }
  | { readonly etat: "echec"; readonly raison: string };

/**
 * Cree un compte eleve ou professeur.
 *
 * Meme sequence que l'import, et pour la meme raison : le compte chez le
 * fournisseur d'identite d'abord, les lignes en base ensuite, et suppression du
 * compte fournisseur si la base refuse — sans quoi l'alias resterait pris et
 * l'identifiant deviendrait inutilisable a jamais.
 *
 * Le mot de passe temporaire n'est renvoye qu'ici, une seule fois, pour la
 * fiche imprimable. Rien ne le conserve.
 */
export async function creerCompte(options: {
  acteur: string;
  prenom: string;
  nom: string;
  login: string;
  role: "eleve" | "professeur";
  classe: string | null;
  classeLabel: string | null;
  email: string | null;
  domaineAlias: string;
}): Promise<ResultatCreationCompte> {
  const client = clientExploitation("administration_des_comptes");
  const motDePasse = genererMotDePasseTemporaire(16);
  const alias = genererAliasTechnique(options.domaineAlias);

  const creation = await client.auth.admin.createUser({
    email: alias,
    password: motDePasse,
    email_confirm: true,
  });

  if (creation.error !== null || creation.data.user === null) {
    return { etat: "echec", raison: "Compte de connexion non cree" };
  }

  const profileId = creation.data.user.id;

  const { data, error } = await client.rpc("etab_creer_membre", {
    p_acteur: options.acteur,
    p_profile: profileId,
    p_prenom: options.prenom,
    p_nom: options.nom,
    p_login: options.login,
    p_alias: alias,
    p_role: options.role,
    p_classe: options.classe,
    p_email: options.email,
  });

  if (error !== null) {
    await client.auth.admin.deleteUser(profileId).catch(() => undefined);
    return {
      etat: "echec",
      raison: error.code === "23505" ? "Identifiant deja utilise" : "Ecriture refusee",
    };
  }

  if (data === "existant") {
    await client.auth.admin.deleteUser(profileId).catch(() => undefined);
    return { etat: "existant" };
  }

  return {
    etat: "cree",
    acces: {
      prenom: options.prenom,
      nom: options.nom,
      role: options.role,
      classe: options.classeLabel,
      login: options.login,
      motDePasseTemporaire: motDePasse,
    },
  };
}

/** Affecte un professeur a une classe pour une matiere. */
export async function affecterProfesseur(options: {
  acteur: string;
  professeur: string;
  classe: string;
  matiere: string;
  annee: string;
}): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client.rpc("etab_affecter_professeur", {
    p_acteur: options.acteur,
    p_professeur: options.professeur,
    p_classe: options.classe,
    p_matiere: options.matiere,
    p_annee: options.annee,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.affecter", code: error.code }));
    return false;
  }
  return true;
}

/** Inscrit un eleve existant dans une classe (changement de classe en cours d'annee). */
export async function inscrireEleve(
  acteur: string,
  eleve: string,
  classe: string,
): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client.rpc("etab_inscrire_eleve", {
    p_acteur: acteur,
    p_eleve: eleve,
    p_classe: classe,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.inscrire", code: error.code }));
    return false;
  }
  return true;
}

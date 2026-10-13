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

/* -------------------------------------------------------------------------- */
/* Conservation du journal d'audit (0064, risque R-07)                         */
/* -------------------------------------------------------------------------- */

export const DUREES_CONSERVATION = [12, 36, 60] as const;
export type DureeConservation = (typeof DUREES_CONSERVATION)[number];

/** La durée de conservation du journal de l'établissement, en mois, ou `null` si la base a refusé. */
export async function conservationJournal(acteur: string): Promise<DureeConservation | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_conservation_journal", { p_acteur: acteur });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.conservation_journal", code: error.code }));
    return null;
  }
  return DUREES_CONSERVATION.find((d) => d === data) ?? null;
}

/** Fixe la durée ; l'établissement est recalculé en base depuis l'adhésion de l'acteur. */
export async function fixerConservationJournal(acteur: string, mois: DureeConservation): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client.rpc("etab_fixer_conservation_journal", { p_acteur: acteur, p_mois: mois });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.fixer_conservation_journal", code: error.code }));
    return false;
  }
  return true;
}

/**
 * Purge du journal à échéance, appelée par la tâche planifiée. La base garde
 * le dernier mot : une ligne encore due ne peut pas être effacée, même ici.
 */
export async function purgerJournalAudit(): Promise<number | null> {
  const { data, error } = await clientExploitation("tache_planifiee").rpc("purger_journal_audit");
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "purge_journal", code: error.code }));
    return null;
  }
  return typeof data === "number" ? data : null;
}

/* -------------------------------------------------------------------------- */
/* Groupes pédagogiques (0065, cahier des charges ch. 07)                      */
/* -------------------------------------------------------------------------- */

export type GenreGroupe = "sous_groupe" | "interclasses";

export interface GroupeEtab {
  readonly id: string;
  readonly label: string;
  readonly kind: GenreGroupe;
  readonly academic_year_id: string;
  readonly annee: string;
  readonly effectif: number;
  readonly cours: number;
}

export interface MembreGroupe {
  readonly profile_id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string | null;
}

export interface CoursGroupe {
  readonly teaching_space_id: string;
  readonly matiere: string;
  readonly professeur_id: string | null;
  readonly prenom: string | null;
  readonly nom: string | null;
}

function journaliserGroupe(contexte: string, code: string | undefined) {
  console.error(JSON.stringify({ niveau: "erreur", contexte: `etab.${contexte}`, code: code ?? "inconnu" }));
}

export async function groupes(acteur: string): Promise<GroupeEtab[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_groupes", { p_acteur: acteur });
  if (error !== null) {
    journaliserGroupe("groupes", error.code);
    return [];
  }
  return (data ?? []) as unknown as GroupeEtab[];
}

export async function groupeMembres(acteur: string, groupe: string): Promise<MembreGroupe[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_groupe_membres", { p_acteur: acteur, p_groupe: groupe });
  if (error !== null) {
    journaliserGroupe("groupe_membres", error.code);
    return [];
  }
  return (data ?? []) as unknown as MembreGroupe[];
}

export async function groupeCours(acteur: string, groupe: string): Promise<CoursGroupe[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_groupe_cours", { p_acteur: acteur, p_groupe: groupe });
  if (error !== null) {
    journaliserGroupe("groupe_cours", error.code);
    return [];
  }
  return (data ?? []) as unknown as CoursGroupe[];
}

/** Crée un groupe. Idempotent par code normalisé ; renvoie son identifiant ou `null`. */
export async function creerGroupe(acteur: string, annee: string, label: string, kind: GenreGroupe): Promise<string | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_creer_groupe", { p_acteur: acteur, p_annee: annee, p_label: label, p_kind: kind });
  if (error !== null) {
    journaliserGroupe("creer_groupe", error.code);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/** Ajoute des élèves à un groupe. Renvoie le nombre réellement ajoutés, ou `null` en cas d'échec. */
export async function groupeAjouterEleves(acteur: string, groupe: string, eleves: readonly string[]): Promise<number | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_groupe_ajouter_eleves", { p_acteur: acteur, p_groupe: groupe, p_eleves: eleves });
  if (error !== null) {
    journaliserGroupe("groupe_ajouter_eleves", error.code);
    return null;
  }
  return typeof data === "number" ? data : null;
}

/** Retire un élève d'un groupe (clôture datée, historique conservé). */
export async function groupeRetirerEleve(acteur: string, groupe: string, eleve: string): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client.rpc("etab_groupe_retirer_eleve", { p_acteur: acteur, p_groupe: groupe, p_eleve: eleve });
  if (error !== null) {
    journaliserGroupe("groupe_retirer_eleve", error.code);
    return false;
  }
  return true;
}

/** Affecte un professeur à un groupe pour une matière ; crée l'espace au besoin. */
export async function affecterProfesseurGroupe(acteur: string, professeur: string, groupe: string, matiere: string, annee: string): Promise<string | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_affecter_professeur_groupe", {
    p_acteur: acteur,
    p_professeur: professeur,
    p_groupe: groupe,
    p_matiere: matiere,
    p_annee: annee,
  });
  if (error !== null) {
    journaliserGroupe("affecter_professeur_groupe", error.code);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/* -------------------------------------------------------------------------- */
/* Affectations multiples (0067, cahier des charges ch. 08)                    */
/* -------------------------------------------------------------------------- */

export type RoleAffectation = "titulaire" | "remplacant" | "co_intervenant";

export interface LigneAffectation {
  readonly genre: "classe" | "groupe";
  readonly cible: string;
  readonly matiere: string;
  readonly role?: RoleAffectation;
  /** AAAA-MM-JJ ; vide : aujourd'hui. */
  readonly debut?: string;
  /** AAAA-MM-JJ, dernier jour inclus ; obligatoire pour un remplacement. */
  readonly fin?: string;
}

export interface IssueAffectation {
  readonly rang: number;
  readonly resultat: "creee" | "existante" | "refusee";
  readonly raison: string | null;
}

/** Affecte un professeur à plusieurs couples cible × matière ; `null` si la demande entière est refusée. */
export async function affecterPlusieurs(acteur: string, professeur: string, lignes: readonly LigneAffectation[]): Promise<IssueAffectation[] | null> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("etab_affecter_professeur_plusieurs", {
    p_acteur: acteur,
    p_professeur: professeur,
    p_lignes: lignes,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.affecter_plusieurs", code: error.code }));
    return null;
  }
  return ((data ?? []) as { rang: number; resultat: IssueAffectation["resultat"]; raison: string | null }[]).map((l) => ({
    rang: l.rang,
    resultat: l.resultat,
    raison: l.raison,
  }));
}

/* -------------------------------------------------------------------------- */
/* Fiche élève (0068, cahier des charges ch. 09)                               */
/* -------------------------------------------------------------------------- */

export interface FicheEleve {
  readonly identite: { readonly prenom: string; readonly nom: string; readonly identifiant: string; readonly etat_compte: string; readonly actif: boolean };
  readonly classe: { readonly id: string; readonly label: string; readonly annee: string; readonly depuis: string } | null;
  readonly classe_a_venir: { readonly label: string; readonly depuis: string } | null;
  readonly groupes: readonly { readonly id: string; readonly label: string; readonly kind: string; readonly debut: string; readonly fin: string | null; readonly actif: boolean }[];
  readonly inscriptions: readonly { readonly classe: string; readonly annee: string; readonly debut: string; readonly fin: string | null; readonly principale: boolean }[];
  readonly cours: readonly { readonly matiere: string; readonly cible: string; readonly genre: "classe" | "groupe"; readonly professeurs: string | null }[];
}

export interface MouvementCours {
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly mouvement: "perdu" | "gagne" | "garde";
}

function journaliserEleve(contexte: string, code: string | undefined) {
  console.error(JSON.stringify({ niveau: "erreur", contexte: `etab.${contexte}`, code: code ?? "inconnu" }));
}

/** La fiche d'un élève de l'établissement ; `null` s'il n'en fait pas partie ou si la lecture échoue. */
export async function ficheEleve(acteur: string, eleve: string): Promise<FicheEleve | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_fiche_eleve", { p_acteur: acteur, p_eleve: eleve });
  if (error !== null) {
    journaliserEleve("fiche_eleve", error.code);
    return null;
  }
  return (data ?? null) as FicheEleve | null;
}

export async function apercuChangementClasse(acteur: string, eleve: string, classe: string): Promise<MouvementCours[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_apercu_changement_classe", {
    p_acteur: acteur,
    p_eleve: eleve,
    p_classe: classe,
  });
  if (error !== null) {
    journaliserEleve("apercu_changement", error.code);
    return null;
  }
  return (data ?? []) as MouvementCours[];
}

/** Change la classe d'un élève à une date. Renvoie l'issue, ou un message de refus. */
export async function changerClasse(
  acteur: string,
  eleve: string,
  classe: string,
  date: string | null,
): Promise<{ readonly ok: true; readonly issue: "deplacee" | "corrigee" | "deja" } | { readonly ok: false; readonly message: string }> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_changer_classe", {
    p_acteur: acteur,
    p_eleve: eleve,
    p_classe: classe,
    p_date: date,
  });
  if (error !== null) {
    journaliserEleve("changer_classe", error.code);
    const m = error.message ?? "";
    return {
      ok: false,
      message: m.includes("autre annee")
        ? "Cette classe appartient à une autre année : le passage d'une année à l'autre se fait dans « Années scolaires »."
        : m.includes("trop ancienne")
          ? "La date ne peut pas remonter à plus d'un mois."
          : "Le changement a été refusé. Vérifiez que la classe et l'élève sont de votre établissement.",
    };
  }
  return { ok: true, issue: data as "deplacee" | "corrigee" | "deja" };
}

/** Départ de l'établissement : clôt classe et groupes à la date. `null` si refusé. */
export async function departEleve(acteur: string, eleve: string, date: string | null): Promise<{ classes: number; groupes: number } | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_depart_eleve", {
    p_acteur: acteur,
    p_eleve: eleve,
    p_date: date,
  });
  if (error !== null) {
    journaliserEleve("depart_eleve", error.code);
    return null;
  }
  return data as { classes: number; groupes: number };
}

/* -------------------------------------------------------------------------- */
/* Rôles et dates des affectations (0069, cahier des charges ch. 08)           */
/* -------------------------------------------------------------------------- */

export interface AffectationProf {
  readonly affectation: string;
  readonly teaching_space_id: string;
  readonly profile_id: string;
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly role: RoleAffectation;
  readonly debut: string;
  readonly fin: string | null;
}

/** Affectations en cours et à venir, classes et groupes ; `null` si la lecture échoue. */
export async function affectationsProfesseurs(acteur: string): Promise<AffectationProf[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_affectations_professeurs", { p_acteur: acteur });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.affectations_professeurs", code: error.code }));
    return null;
  }
  return (data ?? []) as AffectationProf[];
}

/** Termine une affectation à une date (vide : aujourd'hui). */
export async function terminerAffectation(acteur: string, affectation: string, date: string | null): Promise<"terminee" | "retiree" | "deja" | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_terminer_affectation", {
    p_acteur: acteur,
    p_affectation: affectation,
    p_date: date,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.terminer_affectation", code: error.code }));
    return null;
  }
  return data as "terminee" | "retiree" | "deja";
}

/* -------------------------------------------------------------------------- */
/* Recherche paginée des comptes (0072)                                        */
/* -------------------------------------------------------------------------- */

export interface FiltreMembres {
  readonly texte?: string;
  readonly role?: "eleve" | "professeur";
  readonly classe?: string;
  readonly etat?: "a_activer";
  readonly limite?: number;
  readonly decalage?: number;
}

/** Une page de comptes et le total exact ; `null` si la lecture échoue. */
export async function rechercherMembres(acteur: string, filtre: FiltreMembres): Promise<{ lignes: MembreEtab[]; total: number } | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_membres_recherche", {
    p_acteur: acteur,
    p_texte: filtre.texte && filtre.texte.trim() !== "" ? filtre.texte.trim() : null,
    p_role: filtre.role ?? null,
    p_classe: filtre.classe && filtre.classe !== "" ? filtre.classe : null,
    p_etat: filtre.etat ?? null,
    p_limite: filtre.limite ?? 50,
    p_decalage: filtre.decalage ?? 0,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.membres_recherche", code: error.code }));
    return null;
  }
  const lignes = (data ?? []) as (MembreEtab & { total: number })[];
  return { lignes, total: lignes[0]?.total ?? 0 };
}

/**
 * Tous les comptes d'un filtre, page par page (au plus 5 000). Pour les listes
 * courtes par nature — les professeurs — qu'un plafond global de 2 000 comptes
 * tous rôles confondus pouvait tronquer en silence.
 */
export async function tousLesMembres(acteur: string, filtre: Omit<FiltreMembres, "limite" | "decalage">): Promise<MembreEtab[]> {
  const tous: MembreEtab[] = [];
  for (let decalage = 0; decalage < 5000; decalage += 200) {
    const page = await rechercherMembres(acteur, { ...filtre, limite: 200, decalage });
    if (page === null) break;
    tous.push(...page.lignes);
    if (tous.length >= page.total || page.lignes.length === 0) break;
  }
  return tous;
}

export interface ComptesMembres {
  readonly tous: number;
  readonly eleves: number;
  readonly professeurs: number;
  readonly a_activer: number;
}

/** Compteurs exacts, en base, sur toute la population ; `null` si la lecture échoue. */
export async function comptesMembres(acteur: string, texte?: string, classe?: string): Promise<ComptesMembres | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_membres_comptes", {
    p_acteur: acteur,
    p_texte: texte && texte.trim() !== "" ? texte.trim() : null,
    p_classe: classe && classe !== "" ? classe : null,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.membres_comptes", code: error.code }));
    return null;
  }
  return ((data ?? []) as ComptesMembres[])[0] ?? null;
}

/** Les identifiants déjà pris qui commencent par `racine`, dans tout l'établissement. */
export async function loginsPris(acteur: string, racine: string): Promise<string[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_logins_pris", { p_acteur: acteur, p_racine: racine });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.logins_pris", code: error.code }));
    return null;
  }
  return (data ?? []) as string[];
}

/* -------------------------------------------------------------------------- */
/* Professeur principal, années archivées (0075)                              */
/* -------------------------------------------------------------------------- */

export interface ProfesseurPrincipal {
  readonly classe: string;
  readonly profil: string;
  readonly prenom: string;
  readonly nom: string;
}

/** Le professeur principal de chaque classe en cours ; `null` : lecture refusée. */
export async function professeursPrincipaux(acteur: string): Promise<ProfesseurPrincipal[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_professeurs_principaux", { p_acteur: acteur });
  if (error !== null) return null;
  return (data ?? []) as ProfesseurPrincipal[];
}

/** Désigne (ou retire, avec `null`) le professeur principal d'une classe en cours. */
export async function designerProfesseurPrincipal(acteur: string, classe: string, professeur: string | null): Promise<"designe" | "retire" | "inchange" | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_designer_professeur_principal", {
    p_acteur: acteur,
    p_classe: classe,
    p_professeur: professeur,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.professeur_principal", code: error.code }));
    return null;
  }
  return data as "designe" | "retire" | "inchange";
}

export interface AnneeArchivee {
  readonly annee: { id: string; label: string; debut: string; fin: string; archivee_le: string };
  readonly classes: readonly { id: string; label: string; effectif: number; professeur_principal: string | null }[];
  readonly groupes: readonly { id: string; label: string; kind: string; effectif: number }[];
  readonly cours: readonly { matiere: string; cible: string; genre: "classe" | "groupe"; professeurs: string | null; seances_publiees: number; devoirs: number }[];
}

/** Relevé en lecture seule d'une année archivée ; `null` si refusée ou non archivée. */
export async function anneeArchivee(acteur: string, annee: string): Promise<AnneeArchivee | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_annee_archivee", { p_acteur: acteur, p_annee: annee });
  if (error !== null) return null;
  return data as AnneeArchivee;
}

/* -------------------------------------------------------------------------- */
/* Contrôle avant ouverture, fiche classe (0077)                              */
/* -------------------------------------------------------------------------- */

export interface PointDeControle {
  readonly n: number;
  readonly exemples: readonly { id: string; nom: string }[];
}

export interface ControleOuverture {
  readonly eleves_sans_classe: PointDeControle;
  readonly professeurs_sans_cours: PointDeControle;
  readonly cours_sans_professeur: PointDeControle;
  readonly classes_sans_pp: PointDeControle;
  readonly groupes_vides: PointDeControle;
  readonly matieres_non_enseignees: PointDeControle;
}

/** Ce qui reste à régler avant d'ouvrir aux élèves (ONB-05) ; `null` : indisponible. */
export async function controleOuverture(acteur: string): Promise<ControleOuverture | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_controle_ouverture", { p_acteur: acteur });
  if (error !== null) return null;
  return data as ControleOuverture;
}

export interface FicheClasse {
  readonly classe: { id: string; label: string; annee: string; archivee: boolean };
  readonly professeur_principal: { id: string; nom: string } | null;
  readonly eleves: readonly { id: string; prenom: string; nom: string; identifiant: string; etat_compte: string; depuis: string }[];
  readonly cours: readonly { espace: string; matiere: string; professeurs: string | null }[];
  readonly groupes: readonly { id: string; label: string; kind: string; eleves_de_la_classe: number }[];
}

/** Une classe en un écran (CL-03) ; `null` si elle n'est pas de cet établissement. */
export async function ficheClasse(acteur: string, classe: string): Promise<FicheClasse | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_fiche_classe", { p_acteur: acteur, p_classe: classe });
  if (error !== null) return null;
  return data as FicheClasse;
}

/* -------------------------------------------------------------------------- */
/* Filtres des groupes, vue d'ensemble des enseignements (0078)               */
/* -------------------------------------------------------------------------- */

export interface DetailGroupe {
  readonly groupe: string;
  readonly matieres: readonly string[];
  readonly professeurs: readonly string[];
  readonly classes_sources: readonly string[];
}

/** Matières, professeurs et classes d'origine de chaque groupe en cours (GR-01). */
export async function groupesDetails(acteur: string): Promise<Map<string, DetailGroupe>> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_groupes_details", { p_acteur: acteur });
  if (error !== null) return new Map();
  return new Map(((data ?? []) as DetailGroupe[]).map((d) => [d.groupe, d]));
}

export interface Enseignement {
  readonly espace: string;
  readonly genre: "classe" | "groupe";
  readonly cible: string;
  readonly cible_label: string;
  readonly matiere: string;
  readonly matiere_label: string;
  readonly intervenants: readonly { nom: string; role: string }[];
}

/** Chaque enseignement en cours, avec ses intervenants (ENS-02) ; `null` : indisponible. */
export async function matriceEnseignements(acteur: string): Promise<Enseignement[] | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_matrice_enseignements", { p_acteur: acteur });
  if (error !== null) return null;
  return (data ?? []) as Enseignement[];
}

/* -------------------------------------------------------------------------- */
/* Import de groupes (0079)                                                   */
/* -------------------------------------------------------------------------- */

export interface ResultatImportGroupes {
  readonly applique: boolean;
  readonly resume: {
    readonly lignes: number;
    readonly groupes_nouveaux: number;
    readonly groupes_existants: number;
    readonly appartenances_nouvelles: number;
    readonly deja_membres: number;
    readonly eleves_inconnus: number;
    readonly eleves_ambigus: number;
    readonly enseignements_nouveaux: number;
    readonly enseignements_existants: number;
    readonly enseignements_rejetes: number;
  };
  readonly lignes: readonly { rang: number; groupe: string; eleve: string | null; enseignement: string | null; raison: string | null }[];
}

/** Aperçu (rien n'est écrit) ou application d'un import de groupes. */
export async function importGroupes(
  acteur: string,
  lignes: readonly { groupe: string; type?: string; eleve?: string; matiere?: string; professeur?: string }[],
  options: { appliquer: boolean; appartenances: boolean; enseignements: boolean },
): Promise<ResultatImportGroupes | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_import_groupes", {
    p_acteur: acteur,
    p_lignes: lignes,
    p_appliquer: options.appliquer,
    p_appartenances: options.appartenances,
    p_enseignements: options.enseignements,
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etab.import_groupes", code: error.code }));
    return null;
  }
  return data as ResultatImportGroupes;
}

/* -------------------------------------------------------------------------- */
/* Fiche professeur, contrôle complété, rapprochement d'import (0080)         */
/* -------------------------------------------------------------------------- */

export interface FicheProfesseur {
  readonly identite: { prenom: string; nom: string; identifiant: string; etat_compte: string; actif: boolean; roles: readonly string[]; courriel: string | null };
  readonly affectations: readonly {
    id: string; espace: string; matiere: string; cible: string; genre: "classe" | "groupe"; cible_id: string; annee: string;
    role: string; debut: string; fin: string | null; etat: "en_cours" | "a_venir" | "termine" | "archive";
  }[];
  readonly principal_de: readonly { id: string; label: string }[];
}

/** La fiche d'un professeur de l'établissement (PROF-07) ; `null` sinon. */
export async function ficheProfesseur(acteur: string, professeur: string): Promise<FicheProfesseur | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_fiche_professeur", { p_acteur: acteur, p_prof: professeur });
  if (error !== null) return null;
  return data as FicheProfesseur;
}

export interface ControleComplement {
  readonly comptes_suspendus: PointDeControle;
  readonly publications_non_autorisees: PointDeControle;
}

/** Comptes suspendus et séances d'un professeur qui n'enseigne plus le cours (ONB-05). */
export async function controleComplement(acteur: string): Promise<ControleComplement | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_controle_complement", { p_acteur: acteur });
  if (error !== null) return null;
  return data as ControleComplement;
}

export type StatutRapprochement = "nouveau" | "existant" | "reinscription" | "conflit";

/** Sort de chaque ligne valide d'un lot avant application (IMP-02, IMP-04) ; `null` : indisponible. */
export async function rapprochementLot(acteur: string, lot: string): Promise<Map<string, { statut: StatutRapprochement; classeActuelle: string | null }> | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_lot_rapprochement", { p_acteur: acteur, p_lot: lot });
  if (error !== null) return null;
  return new Map(((data ?? []) as { ligne: string; statut: StatutRapprochement; classe_actuelle: string | null }[]).map((r) => [r.ligne, { statut: r.statut, classeActuelle: r.classe_actuelle }]));
}

/* -------------------------------------------------------------------------- */
/* Description d'un groupe (0081, GR-02)                                      */
/* -------------------------------------------------------------------------- */

export async function groupeDescription(acteur: string, groupe: string): Promise<string | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc("etab_groupe_description", { p_acteur: acteur, p_groupe: groupe });
  if (error !== null) return null;
  return (data as string | null) ?? null;
}

/** Écrit (ou retire, si vide) la description ; `false` si refusé. */
export async function groupeDecrire(acteur: string, groupe: string, texte: string): Promise<boolean> {
  const { error } = await clientExploitation("administration_des_comptes").rpc("etab_groupe_decrire", { p_acteur: acteur, p_groupe: groupe, p_description: texte });
  if (error !== null) {
    journaliserGroupe("groupe_decrire", error.code);
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Administration complétée (0082)                                            */
/* -------------------------------------------------------------------------- */

const appel = (fonction: string, args: Record<string, unknown>) => clientExploitation("administration_des_comptes").rpc(fonction, args);

/** Coordinateur d'un groupe (GR-12) ; `null` si aucun. */
export async function coordinateurGroupe(acteur: string, groupe: string): Promise<{ id: string; nom: string } | null> {
  const { data, error } = await appel("etab_coordinateur", { p_acteur: acteur, p_groupe: groupe });
  if (error !== null) return null;
  const l = ((data ?? []) as { profil: string; nom: string }[])[0];
  return l ? { id: l.profil, nom: l.nom } : null;
}

export async function designerCoordinateur(acteur: string, groupe: string, professeur: string | null): Promise<boolean> {
  const { error } = await appel("etab_designer_coordinateur", { p_acteur: acteur, p_groupe: groupe, p_professeur: professeur });
  return error === null;
}

export interface LigneExportGroupe {
  readonly groupe: string; readonly type: string; readonly annee: string; readonly identifiant: string;
  readonly nom: string; readonly prenom: string; readonly classe: string | null; readonly depuis: string;
}
export async function exportGroupes(acteur: string): Promise<LigneExportGroupe[] | null> {
  const { data, error } = await appel("etab_export_groupes", { p_acteur: acteur });
  return error === null ? ((data ?? []) as LigneExportGroupe[]) : null;
}

/** Effectif d'une classe à une date (CL-09) ; `null` : refusé. */
export async function effectifClasse(acteur: string, classe: string, date: string): Promise<number | null> {
  const { data, error } = await appel("etab_effectif_classe", { p_acteur: acteur, p_classe: classe, p_date: date });
  return error === null ? (data as number) : null;
}

/** Préinscription individuelle dans l'année préparée (EL-08). */
export async function preinscrireEleve(acteur: string, eleve: string, classe: string): Promise<"preinscrit" | "modifie" | "deja" | null> {
  const { data, error } = await appel("etab_preinscrire_eleve", { p_acteur: acteur, p_eleve: eleve, p_classe: classe });
  return error === null ? (data as "preinscrit" | "modifie" | "deja") : null;
}

export interface CoursAReconduire {
  readonly espace: string; readonly classe: string; readonly classe_label: string; readonly matiere: string;
  readonly professeurs: readonly { id: string; nom: string; role: string }[]; readonly suggestion: string | null; readonly deja: boolean;
}
export async function coursAReconduire(acteur: string, cible: string): Promise<CoursAReconduire[] | null> {
  const { data, error } = await appel("etab_cours_a_reconduire", { p_acteur: acteur, p_cible: cible });
  return error === null ? ((data ?? []) as CoursAReconduire[]) : null;
}
export async function reconduireCours(acteur: string, cible: string, lignes: readonly { espace: string; classe: string; exclus: readonly string[] }[]): Promise<{ cours: number; refusees: number } | null> {
  const { data, error } = await appel("etab_reconduire_cours", { p_acteur: acteur, p_cible: cible, p_lignes: lignes });
  return error === null ? (data as { cours: number; refusees: number }) : null;
}

export interface ComparaisonAnnee {
  readonly annee: string; readonly label: string; readonly courante: boolean; readonly archivee: boolean;
  readonly classes: number; readonly eleves: number; readonly groupes: number; readonly cours: number; readonly cours_sans_professeur: number;
}
export async function comparaisonAnnees(acteur: string): Promise<ComparaisonAnnee[] | null> {
  const { data, error } = await appel("etab_comparaison_annees", { p_acteur: acteur });
  return error === null ? ((data ?? []) as ComparaisonAnnee[]) : null;
}

/** Trace d'un export nominatif (SEC-19). Un échec de journal empêche l'export. */
export async function journaliserExport(acteur: string, type: string, lignes: number): Promise<boolean> {
  const { error } = await appel("etab_journaliser_export", { p_acteur: acteur, p_type: type, p_lignes: lignes });
  return error === null;
}

export async function activiteInhabituelle(acteur: string): Promise<{ alerte: string; nombre: number; depuis: string }[] | null> {
  const { data, error } = await appel("etab_activite_inhabituelle", { p_acteur: acteur });
  return error === null ? ((data ?? []) as { alerte: string; nombre: number; depuis: string }[]) : null;
}

export async function limitesEtablissement(acteur: string): Promise<{ groupes_max: number; groupes: number; lignes_import_max: number } | null> {
  const { data, error } = await appel("etab_limites", { p_acteur: acteur });
  if (error !== null) return null;
  return ((data ?? []) as { groupes_max: number; groupes: number; lignes_import_max: number }[])[0] ?? null;
}

/**
 * L'année préparée (non courante, non archivée) et ses classes, pour une
 * préinscription individuelle (EL-08). L'établissement est recalculé depuis
 * l'acteur ; `null` s'il n'y a pas d'année préparée.
 */
export async function anneePreparee(acteur: string): Promise<{ label: string; classes: { id: string; label: string }[] } | null> {
  const situation = await contexte(acteur);
  if (situation === null) return null;
  const client = clientExploitation("administration_des_comptes");
  const { data: annee } = await client
    .from("academic_years")
    .select("id, label")
    .eq("organization_id", situation.organizationId)
    .eq("is_current", false)
    .is("archived_at", null)
    .order("starts_on")
    .limit(1)
    .maybeSingle();
  if (annee === null) return null;
  const { data: liste } = await client
    .from("classes")
    .select("id, label")
    .eq("academic_year_id", (annee as { id: string }).id)
    .is("archived_at", null)
    .order("label");
  return { label: (annee as { label: string }).label, classes: (liste ?? []) as { id: string; label: string }[] };
}

/** SEC-18 : demande d'effacement (compte fermé, journalisé, réversible). */
export async function demanderEffacement(acteur: string, profil: string, motif: string): Promise<"demandee" | "deja" | null> {
  const { data, error } = await appel("etab_demander_effacement", { p_acteur: acteur, p_profil: profil, p_motif: motif });
  return error === null ? (data as "demandee" | "deja") : null;
}

export async function annulerEffacement(acteur: string, profil: string): Promise<boolean> {
  const { data, error } = await appel("etab_annuler_effacement", { p_acteur: acteur, p_profil: profil });
  return error === null && data === true;
}

export async function effacementsEnAttente(acteur: string): Promise<{ profil: string; prenom: string; nom: string; depuis: string | null }[]> {
  const { data, error } = await appel("etab_effacements_en_attente", { p_acteur: acteur });
  return error === null ? ((data ?? []) as { profil: string; prenom: string; nom: string; depuis: string | null }[]) : [];
}

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

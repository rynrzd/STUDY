import "server-only";

import {
  analyserFichierProfesseurs,
  construirePlanProfesseurs,
  fichierProfesseursRejete,
  type Affectation,
  type ColonneReconnue,
  type Correspondance,
  type FichierProfesseurs,
  type PlanProfesseurs,
} from "./assistant-rentree.ts";
import { proposerLogin } from "./import-rentree.ts";
import { genererAliasTechnique, genererMotDePasseTemporaire } from "./identite.ts";
import type { AccesCree, FichierDepose } from "./lot-rentree.ts";
import { FichierIllisible, lireTableur, TAILLE_MAXIMALE } from "./tableur.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Le lot de professeurs — cahier V5, §6.
 *
 * Même forme que le lot d'élèves : on lit, on met en attente, on relit, puis
 * seulement on crée. Ce qui change, c'est la nature de ce qui est créé. Un
 * élève, c'est un compte et une inscription. Un professeur, c'est **un** compte
 * et autant d'affectations qu'il enseigne de couples matière–classe — jamais un
 * compte par classe, jamais une chaîne « maths en 2DE1 et 2DE2 » rangée dans un
 * champ que personne ne saura relire.
 */

interface PayloadProfesseur {
  readonly nom: string;
  readonly prenom: string;
  readonly email: string | null;
  readonly affectations: readonly Affectation[];
  readonly fichier: string;
}

const PURGE_JOURS = 30;

/* -------------------------------------------------------------------------- */
/* Analyse                                                                     */
/* -------------------------------------------------------------------------- */

export async function analyserLotProfesseurs(options: {
  acteur: string;
  organisation: string;
  annee: string;
  fichiers: readonly FichierDepose[];
}): Promise<{ lot: string; plan: PlanProfesseurs } | { erreur: string }> {
  if (options.fichiers.length === 0) {
    return { erreur: "Déposez au moins un fichier." };
  }

  const analyses: FichierProfesseurs[] = [];

  for (const fichier of options.fichiers) {
    if (fichier.contenu.length > TAILLE_MAXIMALE) {
      analyses.push(
        fichierProfesseursRejete(
          fichier.nom,
          fichier.contenu.length,
          `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE / (1024 * 1024))} Mo.`,
        ),
      );
      continue;
    }

    try {
      const tableau = lireTableur(fichier.nom, fichier.contenu);
      analyses.push(
        analyserFichierProfesseurs({ nom: fichier.nom, octets: fichier.contenu.length, tableau }),
      );
    } catch (erreur) {
      analyses.push(
        fichierProfesseursRejete(
          fichier.nom,
          fichier.contenu.length,
          erreur instanceof FichierIllisible
            ? erreur.message
            : "Ce fichier n'a pas pu être lu. Déposez un .xlsx ou un .csv.",
        ),
      );
    }
  }

  const plan = construirePlanProfesseurs(analyses);
  const client = clientExploitation("administration_des_comptes");

  const { data: lotCree, error } = await client.rpc("lot_ouvrir", {
    p_acteur: options.acteur,
    p_annee: options.annee,
    p_kind: "enseignants",
  });

  if (error !== null || typeof lotCree !== "string") {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "lot.ouvrir_profs", code: error?.code }),
    );
    return { erreur: "Le lot n'a pas pu être ouvert." };
  }

  const purge = new Date(Date.now() + PURGE_JOURS * 86_400_000).toISOString();

  for (const analyse of analyses) {
    const { data: job } = await client
      .from("import_jobs")
      .insert({
        organization_id: options.organisation,
        academic_year_id: options.annee,
        kind: "enseignants",
        state: analyse.erreur === null ? "apercu_pret" : "echoue",
        created_by: options.acteur,
        batch_id: lotCree,
        file_name: analyse.nom,
        mapping: {
          correspondance: analyse.correspondance,
          colonnes: analyse.colonnes,
          erreur: analyse.erreur,
        },
        rows_total: analyse.lignes.length,
        purge_after: purge,
      })
      .select("id")
      .single();

    const jobId = (job as { id: string } | null)?.id ?? null;
    if (jobId === null) continue;
    if (analyse.lignes.length === 0) continue;

    await client.from("import_rows").insert(
      analyse.lignes.map((ligne) => ({
        organization_id: options.organisation,
        import_job_id: jobId,
        row_number: ligne.numero,
        payload: {
          nom: ligne.nom,
          prenom: ligne.prenom,
          email: ligne.email,
          affectations: ligne.affectations,
          fichier: ligne.fichier,
        } satisfies PayloadProfesseur,
        state: ligne.anomalies.some((a) => a.gravite === "bloquante") ? "rejete" : "valide",
        issue_code: ligne.anomalies[0]?.code ?? null,
        issue_detail: ligne.anomalies.map((a) => a.message).join(" ") || null,
      })),
    );
  }

  return { lot: lotCree, plan };
}

/* -------------------------------------------------------------------------- */
/* Relecture                                                                   */
/* -------------------------------------------------------------------------- */

export interface FichierProfesseursDuLot {
  readonly jobId: string;
  readonly nom: string;
  readonly colonnes: readonly ColonneReconnue[];
  readonly correspondance: Correspondance;
  readonly erreur: string | null;
  readonly lignes: number;
}

export interface LigneProfesseurDuLot {
  readonly id: string;
  readonly numero: number;
  readonly fichier: string;
  readonly nom: string;
  readonly prenom: string;
  readonly email: string | null;
  readonly affectations: readonly Affectation[];
  readonly valide: boolean;
  readonly probleme: string | null;
}

export interface LotProfesseurs {
  readonly id: string;
  readonly etat: string;
  readonly fichiers: readonly FichierProfesseursDuLot[];
  readonly lignes: readonly LigneProfesseurDuLot[];
  /** Une entrée par personne : c'est le compte qui sera créé. */
  readonly personnes: readonly {
    readonly cle: string;
    readonly nom: string;
    readonly prenom: string;
    readonly email: string | null;
    readonly affectations: readonly Affectation[];
  }[];
  readonly compte: {
    readonly fichiersLus: number;
    readonly fichiersRejetes: number;
    readonly lignesLues: number;
    readonly professeurs: number;
    readonly affectations: number;
    readonly bloquantes: number;
  };
  readonly blocages: readonly string[];
  readonly rapport: Record<string, number> | null;
}

export async function lireLotProfesseurs(
  acteur: string,
  lot: string,
): Promise<LotProfesseurs | null> {
  const client = clientExploitation("administration_des_comptes");

  const { data: enTete } = await client
    .from("import_batches")
    .select("id, state, kind, organization_id, rapport")
    .eq("id", lot)
    .maybeSingle();

  const entree = enTete as
    | { id: string; state: string; kind: string; organization_id: string; rapport: unknown }
    | null;

  if (entree === null || entree.kind !== "enseignants") return null;

  const { data: contexte } = await client.rpc("etab_contexte", { p_acteur: acteur });
  const organisation = (Array.isArray(contexte) ? contexte[0] : null)?.organization_id ?? null;
  if (organisation === null || organisation !== entree.organization_id) return null;

  const { data: jobs } = await client
    .from("import_jobs")
    .select("id, file_name, mapping, rows_total")
    .eq("batch_id", lot)
    .order("file_name");

  const fichiers: FichierProfesseursDuLot[] = (
    (jobs ?? []) as unknown as {
      id: string;
      file_name: string;
      mapping: {
        correspondance?: Correspondance;
        colonnes?: ColonneReconnue[];
        erreur?: string | null;
      } | null;
      rows_total: number;
    }[]
  ).map((job) => ({
    jobId: job.id,
    nom: job.file_name ?? "(sans nom)",
    colonnes: job.mapping?.colonnes ?? [],
    correspondance: job.mapping?.correspondance ?? {},
    erreur: job.mapping?.erreur ?? null,
    lignes: job.rows_total,
  }));

  const { data: rows } = await client
    .from("import_rows")
    .select("id, row_number, payload, state, issue_detail")
    .in("import_job_id", fichiers.map((fichier) => fichier.jobId))
    .order("row_number")
    .limit(2000);

  const lignes: LigneProfesseurDuLot[] = (
    (rows ?? []) as unknown as {
      id: string;
      row_number: number;
      payload: PayloadProfesseur;
      state: string;
      issue_detail: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    numero: row.row_number,
    fichier: row.payload.fichier,
    nom: row.payload.nom,
    prenom: row.payload.prenom,
    email: row.payload.email,
    affectations: row.payload.affectations ?? [],
    valide: row.state === "valide",
    probleme: row.issue_detail,
  }));

  const personnes = regrouper(lignes.filter((ligne) => ligne.valide));
  const bloquantes = lignes.filter((ligne) => !ligne.valide).length;

  const blocages: string[] = [];
  for (const fichier of fichiers) {
    if (fichier.erreur !== null) continue;
    const manquants: string[] = [];
    if (fichier.correspondance.nom === undefined) manquants.push("le nom");
    if (fichier.correspondance.prenom === undefined) manquants.push("le prénom");
    if (fichier.correspondance.matieres === undefined) manquants.push("les matières");
    if (fichier.correspondance.classes === undefined) manquants.push("les classes");
    if (manquants.length > 0) {
      blocages.push(`${fichier.nom} : ${manquants.join(", ")} n'ont pas été reconnus.`);
    }
  }
  if (bloquantes > 0) {
    blocages.push(
      `${bloquantes} ligne${bloquantes > 1 ? "s" : ""} à corriger avant de créer les comptes.`,
    );
  }
  if (lignes.length === 0) blocages.push("Aucun professeur n'a été lu.");

  return {
    id: entree.id,
    etat: entree.state,
    fichiers,
    lignes,
    personnes,
    compte: {
      fichiersLus: fichiers.filter((fichier) => fichier.erreur === null).length,
      fichiersRejetes: fichiers.filter((fichier) => fichier.erreur !== null).length,
      lignesLues: lignes.length,
      professeurs: personnes.length,
      affectations: personnes.reduce((total, personne) => total + personne.affectations.length, 0),
      bloquantes,
    },
    blocages,
    rapport: (entree.rapport as Record<string, number> | null) ?? null,
  };
}

/**
 * Réunit les lignes d'une même personne.
 *
 * C'est le §6.2 : cinq lignes pour Mme Dupont font un compte et cinq jeux
 * d'affectations. Le rapprochement suit l'adresse professionnelle quand elle
 * existe, le nom et le prénom sinon.
 */
function regrouper(lignes: readonly LigneProfesseurDuLot[]) {
  const par = new Map<
    string,
    { cle: string; nom: string; prenom: string; email: string | null; affectations: Map<string, Affectation> }
  >();

  for (const ligne of lignes) {
    const cle =
      ligne.email !== null
        ? `email:${ligne.email.toLowerCase()}`
        : `nom:${ligne.nom.trim().toLowerCase()}|${ligne.prenom.trim().toLowerCase()}`;

    let entree = par.get(cle);
    if (entree === undefined) {
      entree = {
        cle,
        nom: ligne.nom,
        prenom: ligne.prenom,
        email: ligne.email,
        affectations: new Map(),
      };
      par.set(cle, entree);
    }

    for (const affectation of ligne.affectations) {
      entree.affectations.set(
        `${affectation.matiere.toLowerCase()}|${affectation.classe.toLowerCase()}`,
        affectation,
      );
    }
  }

  return [...par.values()].map((entree) => ({
    cle: entree.cle,
    nom: entree.nom,
    prenom: entree.prenom,
    email: entree.email,
    affectations: [...entree.affectations.values()],
  }));
}

/* -------------------------------------------------------------------------- */
/* Correction                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Corrige une ligne de professeur en attente.
 *
 * Les matières et les classes sont réécrites entièrement : c'est plus simple à
 * relire qu'une liste où l'on coche, et cela permet de supprimer d'un coup les
 * affectations proposées par croisement qui n'ont pas lieu d'être.
 */
export async function corrigerLigneProfesseur(options: {
  acteur: string;
  ligne: string;
  nom: string;
  prenom: string;
  affectations: readonly Affectation[];
}): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");

  const { data } = await client
    .from("import_rows")
    .select("id, payload, organization_id")
    .eq("id", options.ligne)
    .maybeSingle();

  const row = data as { id: string; payload: PayloadProfesseur; organization_id: string } | null;
  if (row === null) return false;

  const { data: contexte } = await client.rpc("etab_contexte", { p_acteur: options.acteur });
  const organisation = (Array.isArray(contexte) ? contexte[0] : null)?.organization_id ?? null;
  if (organisation === null || organisation !== row.organization_id) return false;

  const nom = options.nom.trim();
  const prenom = options.prenom.trim();
  const affectations = options.affectations
    .map((a) => ({ matiere: a.matiere.trim(), classe: a.classe.trim() }))
    .filter((a) => a.matiere !== "" && a.classe !== "");

  const complet = nom !== "" && prenom !== "" && affectations.length > 0;

  const { error } = await client
    .from("import_rows")
    .update({
      payload: { ...row.payload, nom, prenom, affectations },
      state: complet ? "valide" : "rejete",
      issue_detail: complet
        ? null
        : "Nom, prénom et au moins une affectation matière–classe sont obligatoires.",
      corrige: true,
    })
    .eq("id", options.ligne);

  return error === null;
}

/* -------------------------------------------------------------------------- */
/* Application                                                                 */
/* -------------------------------------------------------------------------- */

export interface RapportProfesseurs {
  readonly cree: number;
  readonly existant: number;
  readonly affectations: number;
  readonly erreurs: number;
  readonly acces: readonly AccesCree[];
  readonly echecs: readonly { ligne: number; raison: string }[];
}

/**
 * Crée les comptes professeurs et pose leurs affectations.
 *
 * Deux étapes distinctes par personne, et l'ordre compte : le compte d'abord,
 * les affectations ensuite. Un professeur déjà présent — réimport, ou collègue
 * arrivé par un autre fichier — garde son compte et reçoit seulement les
 * affectations qui lui manquaient.
 *
 * Une affectation refusée ne fait pas tomber le reste : elle est comptée comme
 * échec, nommée dans le rapport, et le professeur garde les autres.
 */
export async function appliquerLotProfesseurs(options: {
  acteur: string;
  annee: string;
  lot: string;
  domaineAlias: string;
}): Promise<RapportProfesseurs | { erreur: string }> {
  const complet = await lireLotProfesseurs(options.acteur, options.lot);
  if (complet === null) return { erreur: "Ce lot est introuvable." };
  if (complet.etat === "applique") return { erreur: "Ce lot a déjà été appliqué." };
  if (complet.blocages.length > 0) {
    return { erreur: "Des erreurs restent à corriger avant de créer les comptes." };
  }

  const client = clientExploitation("administration_des_comptes");

  const { data: membres } = await client.rpc("etab_membres", {
    p_acteur: options.acteur,
    p_limite: 5000,
  });
  const pris = new Set(
    ((membres ?? []) as { local_login: string }[]).map((membre) => membre.local_login),
  );

  let cree = 0;
  let existant = 0;
  let affectations = 0;
  const acces: AccesCree[] = [];
  const echecs: { ligne: number; raison: string }[] = [];

  for (const personne of complet.personnes) {
    const login = proposerLogin(personne.prenom, personne.nom, pris);
    pris.add(login);

    const motDePasse = genererMotDePasseTemporaire(16);
    const alias = genererAliasTechnique(options.domaineAlias);

    const creation = await client.auth.admin.createUser({
      email: alias,
      password: motDePasse,
      email_confirm: true,
    });

    if (creation.error !== null || creation.data.user === null) {
      echecs.push({ ligne: 0, raison: `${personne.prenom} ${personne.nom} : compte non créé` });
      continue;
    }

    const profileId = creation.data.user.id;

    const { data: resultat, error } = await client.rpc("etab_creer_membre", {
      p_acteur: options.acteur,
      p_profile: profileId,
      p_prenom: personne.prenom,
      p_nom: personne.nom,
      p_login: login,
      p_alias: alias,
      p_role: "professeur",
      p_classe: null,
      p_email: personne.email,
    });

    if (error !== null) {
      await client.auth.admin.deleteUser(profileId).catch(() => undefined);
      echecs.push({ ligne: 0, raison: `${personne.prenom} ${personne.nom} : écriture refusée` });
      continue;
    }

    let identifiant = profileId;

    if (resultat === "existant") {
      // Le compte fournisseur ouvert à l'instant ne sert à rien : sans cette
      // suppression, l'alias resterait pris pour toujours.
      await client.auth.admin.deleteUser(profileId).catch(() => undefined);
      existant += 1;

      const { data: connu } = await client.rpc("etab_profil_par_login", {
        p_acteur: options.acteur,
        p_login: login,
      });
      if (typeof connu !== "string") {
        echecs.push({
          ligne: 0,
          raison: `${personne.prenom} ${personne.nom} : compte existant introuvable`,
        });
        continue;
      }
      identifiant = connu;
    } else {
      cree += 1;
      acces.push({
        prenom: personne.prenom,
        nom: personne.nom,
        classe: "Professeur",
        login,
        motDePasseTemporaire: motDePasse,
      });
    }

    for (const affectation of personne.affectations) {
      const { error: refus } = await client.rpc("lot_affecter_professeur", {
        p_acteur: options.acteur,
        p_annee: options.annee,
        p_professeur: identifiant,
        p_matiere_label: affectation.matiere,
        p_classe_label: affectation.classe,
      });

      if (refus !== null) {
        echecs.push({
          ligne: 0,
          raison: `${personne.prenom} ${personne.nom} : ${affectation.matiere} en ${affectation.classe} refusée`,
        });
        continue;
      }
      affectations += 1;
    }
  }

  await client.rpc("lot_clore", {
    p_acteur: options.acteur,
    p_lot: options.lot,
    p_rapport: { cree, existant, affectations, erreur: echecs.length },
  });

  return { cree, existant, affectations, erreurs: echecs.length, acces, echecs };
}

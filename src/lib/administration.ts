import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { genererAliasTechnique, genererMotDePasseTemporaire } from "./identite.ts";
import { clientExploitation } from "./supabase-serveur.ts";
import type { Etat } from "./demande-commerciale.ts";

/**
 * Administration AvecStudy — section 5.3 du cahier de finition.
 *
 * Consulter les demandes, créer et suspendre un établissement, créer son
 * administrateur, gérer le statut commercial, consulter le journal d'audit,
 * désactiver un compte.
 *
 * Toutes les écritures passent par les fonctions `study.admin_*`, qui
 * revérifient l'habilitation de l'acteur côté base. Le contrôle de la page
 * (« cette personne est-elle exploitante ? ») ne suffit pas : si une route
 * oubliait ce contrôle, la base refuserait quand même.
 */

/* -------------------------------------------------------------------------- */
/* Demandes commerciales                                                       */
/* -------------------------------------------------------------------------- */

export interface DemandeCommerciale {
  readonly id: string;
  readonly reference: string;
  readonly establishment_name: string;
  readonly legal_kind: string;
  readonly commune: string | null;
  readonly approximate_size: number | null;
  readonly contact_name: string;
  readonly contact_role: string | null;
  readonly contact_email: string;
  readonly contact_phone: string | null;
  readonly message: string | null;
  readonly state: Etat;
  readonly internal_note: string | null;
  readonly created_at: string;
  readonly last_contact_at: string;
}

export async function listerDemandes(etat?: Etat): Promise<DemandeCommerciale[]> {
  const client = clientExploitation("administration_des_comptes");
  let requete = client
    .from("commercial_requests")
    .select(
      "id, reference, establishment_name, legal_kind, commune, approximate_size, " +
        "contact_name, contact_role, contact_email, contact_phone, message, state, " +
        "internal_note, created_at, last_contact_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (etat !== undefined) requete = requete.eq("state", etat);

  const { data, error } = await requete;
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "demandes.liste", code: error.code }));
    return [];
  }
  return (data ?? []) as unknown as DemandeCommerciale[];
}

export async function compterDemandesParEtat(): Promise<Record<string, number>> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.from("commercial_requests").select("state").limit(1000);
  if (error !== null) return {};

  const comptes: Record<string, number> = {};
  for (const ligne of data ?? []) {
    const etat = String((ligne as { state: string }).state);
    comptes[etat] = (comptes[etat] ?? 0) + 1;
  }
  return comptes;
}

export async function changerEtatDemande(
  id: string,
  etat: Etat,
  note: string | null,
): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client
    .from("commercial_requests")
    .update({ state: etat, internal_note: note })
    .eq("id", id);

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "demandes.etat", code: error.code }));
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Établissements                                                              */
/* -------------------------------------------------------------------------- */

export interface Etablissement {
  readonly id: string;
  readonly name: string;
  readonly public_code: string;
  readonly slug: string;
  readonly legal_kind: string;
  readonly commune: string | null;
  readonly state: string;
  readonly created_at: string;
}

export async function listerEtablissements(): Promise<Etablissement[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client
    .from("organizations")
    .select("id, name, public_code, slug, legal_kind, commune, state, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etablissements.liste", code: error.code }));
    return [];
  }
  return (data ?? []) as unknown as Etablissement[];
}

export async function creerEtablissement(options: {
  acteur: string;
  nom: string;
  code: string;
  type: "public" | "prive" | "autre";
  commune: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const client = clientExploitation("administration_des_comptes");

  const { data, error } = await client.rpc("admin_creer_etablissement", {
    p_acteur: options.acteur,
    p_nom: options.nom,
    p_code: options.code,
    p_slug: enSlug(options.nom),
    p_type: options.type,
    p_commune: options.commune,
  });

  if (error !== null) {
    return { ok: false, message: messageErreur(error.code, "établissement") };
  }
  return { ok: true, id: String(data) };
}

export async function changerEtatEtablissement(options: {
  acteur: string;
  organisation: string;
  etat: "preparation" | "actif" | "suspendu" | "archive";
  motif: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = clientExploitation("administration_des_comptes");

  const { error } = await client.rpc("admin_changer_etat_etablissement", {
    p_acteur: options.acteur,
    p_organisation: options.organisation,
    p_etat: options.etat,
    p_motif: options.motif,
  });

  if (error !== null) return { ok: false, message: messageErreur(error.code, "établissement") };
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Administrateur d'établissement                                              */
/* -------------------------------------------------------------------------- */

export interface AccesCree {
  readonly identifiant: string;
  readonly motDePasseTemporaire: string;
  readonly code: string;
}

/**
 * Crée l'administrateur d'un établissement.
 *
 * L'ordre est celui du bootstrap : compte chez le fournisseur d'abord, lignes
 * en base ensuite, et retrait du compte fournisseur si la base refuse. Une
 * ligne sans moyen de connexion, ou un compte de connexion sans ligne, sont
 * deux façons différentes de laisser un accès orphelin.
 *
 * Le mot de passe temporaire est **renvoyé une seule fois**, pour être imprimé
 * ou dicté. Il n'est stocké nulle part de notre côté : le fournisseur n'en
 * garde qu'une empreinte, et nous rien du tout.
 */
export async function creerAdministrateur(options: {
  acteur: string;
  organisation: string;
  code: string;
  prenom: string;
  nom: string;
  email: string;
  identifiant: string;
}): Promise<{ ok: true; acces: AccesCree } | { ok: false; message: string }> {
  const client = clientExploitation("administration_des_comptes");
  const motDePasse = genererMotDePasseTemporaire(20);

  // Un administrateur est un adulte : il a une adresse professionnelle, qui
  // sert d'identité technique. Pas d'alias opaque ici — l'alias est réservé
  // aux élèves, qui n'ont pas d'adresse.
  const identiteTechnique = options.email.trim().toLowerCase();

  const creation = await client.auth.admin.createUser({
    email: identiteTechnique,
    password: motDePasse,
    email_confirm: true,
  });

  if (creation.error !== null || creation.data.user === null) {
    return {
      ok: false,
      message:
        creation.error?.code === "email_exists"
          ? "Cette adresse est déjà utilisée par un compte."
          : "Le compte n'a pas pu être créé chez le fournisseur d'identité.",
    };
  }

  const profileId = creation.data.user.id;

  const { error } = await client.rpc("admin_creer_administrateur", {
    p_acteur: options.acteur,
    p_organisation: options.organisation,
    p_profile: profileId,
    p_prenom: options.prenom,
    p_nom: options.nom,
    p_email: identiteTechnique,
    p_identifiant: options.identifiant,
    p_alias: identiteTechnique,
  });

  if (error !== null) {
    // Retour arrière : sans ça, l'adresse resterait prise et l'administrateur
    // ne pourrait jamais être recréé.
    await client.auth.admin.deleteUser(profileId).catch(() => undefined);
    return { ok: false, message: messageErreur(error.code, "administrateur") };
  }

  return {
    ok: true,
    acces: {
      identifiant: options.identifiant.trim().toLowerCase(),
      motDePasseTemporaire: motDePasse,
      code: options.code,
    },
  };
}

export async function suspendreCompte(options: {
  acteur: string;
  organisation: string;
  profil: string;
  motif: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = clientExploitation("administration_des_comptes");
  const { error } = await client.rpc("admin_suspendre_compte", {
    p_acteur: options.acteur,
    p_organisation: options.organisation,
    p_profile: options.profil,
    p_motif: options.motif,
  });
  if (error !== null) return { ok: false, message: messageErreur(error.code, "compte") };
  return { ok: true };
}

export interface MembreEtablissement {
  readonly profile_id: string;
  readonly local_login: string;
  readonly roles: string[];
  readonly account_state: string;
  readonly state: string;
}

export async function listerMembres(organisation: string): Promise<MembreEtablissement[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client
    .from("organization_memberships")
    .select("profile_id, local_login, roles, account_state, state")
    .eq("organization_id", organisation)
    .order("local_login")
    .limit(500);

  if (error !== null) return [];
  return (data ?? []) as unknown as MembreEtablissement[];
}

/* -------------------------------------------------------------------------- */
/* Journal d'audit                                                             */
/* -------------------------------------------------------------------------- */

export interface EvenementAudit {
  readonly id: number;
  readonly organisation: string | null;
  readonly acteur: string | null;
  readonly actor_kind: string;
  readonly action: string;
  readonly object_kind: string | null;
  readonly reason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

export async function listerJournal(acteur: string, limite = 100): Promise<EvenementAudit[]> {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("admin_journal", {
    p_acteur: acteur,
    p_limite: limite,
  });

  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "journal.liste", code: error.code }));
    return [];
  }
  return (data ?? []) as unknown as EvenementAudit[];
}

/* -------------------------------------------------------------------------- */

/** Code établissement lisible, sans caractère ambigu. */
export function proposerCode(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  const suffixe = randomBytes(2).toString("hex").toUpperCase();
  return `${base === "" ? "LYCEE" : base}-${suffixe}`;
}

/** Alias technique pour un élève. Exporté ici pour l'import de rentrée. */
export function aliasEleve(domaine: string): string {
  return genererAliasTechnique(domaine);
}

/** Identifiant de profil, quand le fournisseur n'en fournit pas encore. */
export function nouvelIdentifiantProfil(): string {
  return randomUUID();
}

function enSlug(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  // Le suffixe évite la collision entre deux « lycee-jean-moulin ».
  return `${base === "" ? "etablissement" : base}-${randomBytes(2).toString("hex")}`;
}

function messageErreur(code: string | undefined, quoi: string): string {
  if (code === "23505") return `Ce ${quoi} existe déjà avec cet identifiant ou ce code.`;
  if (code === "P0001") return "Opération refusée : habilitation ou motif insuffisant.";
  console.error(JSON.stringify({ niveau: "erreur", contexte: `administration.${quoi}`, code: code ?? "inconnu" }));
  return "L'opération n'a pas pu être enregistrée.";
}

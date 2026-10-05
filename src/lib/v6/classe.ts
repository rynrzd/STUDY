import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Ma classe — E10, E11, E12, E13, E18, E25. Toutes les lectures sous le
 * jeton de la personne ; un identifiant de classe venu de l'URL ne donne
 * rien par lui-même (RLS et fonctions vérifient l'appartenance).
 */

export interface Classe {
  readonly id: string;
  readonly libelle: string;
  readonly professeurPrincipal: string | null;
}

export async function classe(jeton: string, id: string): Promise<Classe | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const { data, error } = await clientUtilisateur(jeton).from("classes").select("id, label, professeur_principal").eq("id", id).maybeSingle();
  if (error !== null || data === null) return null;
  const c = data as { id: string; label: string; professeur_principal: string | null };
  return { id: c.id, libelle: c.label, professeurPrincipal: c.professeur_principal };
}

export interface Membre {
  readonly profileId: string;
  readonly affichage: string;
  readonly initiales: string;
  readonly role: "eleve" | "delegue" | "professeur" | "professeur_principal";
  readonly etatCompte: string | null;
}

export async function membres(jeton: string, classeId: string): Promise<Membre[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("membres_classe", { p_classe: classeId });
  if (error !== null) return null;
  return ((data ?? []) as { profile_id: string; affichage: string; initiales: string; role: Membre["role"]; etat_compte: string | null }[]).map(
    (m) => ({ profileId: m.profile_id, affichage: m.affichage, initiales: m.initiales, role: m.role, etatCompte: m.etat_compte }),
  );
}

export interface Droits {
  readonly membre: boolean;
  readonly eleve: boolean;
  readonly delegue: boolean;
  readonly enseignant: boolean;
  readonly principal: boolean;
  readonly responsable: boolean;
}

/** Les droits réels sur la classe, relus en base (jamais déduits de l'URL ou du cookie). */
export async function droits(jeton: string, classeId: string): Promise<Droits> {
  const client = clientUtilisateur(jeton);
  const appel = async (fn: string) => {
    const { data } = await client.rpc(fn, { classe: classeId });
    return data === true;
  };
  const [membre, eleve, delegue, enseignant, principal, responsable] = await Promise.all([
    appel("membre_classe"),
    appel("est_inscrit_classe"),
    appel("est_delegue"),
    appel("enseigne_classe"),
    appel("est_professeur_principal"),
    appel("responsable_classe"),
  ]);
  return { membre, eleve, delegue, enseignant, principal, responsable };
}

export async function demandesATraiter(jeton: string, classeId: string) {
  const { data, error } = await clientUtilisateur(jeton).rpc("classe_demandes_a_traiter", { p_classe: classeId });
  if (error !== null) return [];
  return (data ?? []) as { id: string; profile_id: string; prenom: string; nom: string; demandee_le: string }[];
}

export async function codesDeClasse(jeton: string, classeId: string) {
  const { data } = await clientUtilisateur(jeton)
    .from("class_join_codes")
    .select("id, expires_at, revoked_at, created_at")
    .eq("class_id", classeId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as { id: string; expires_at: string; revoked_at: string | null; created_at: string }[];
}

export async function invitationsDeClasse(jeton: string, classeId: string) {
  const { data, error } = await clientUtilisateur(jeton).rpc("invitations_de_classe", { p_classe: classeId });
  if (error !== null) return null;
  return (data ?? []) as { profile_id: string; prenom: string; nom: string; etat_compte: string; invitation: string; expire_le: string | null }[];
}

export async function delegues(jeton: string, classeId: string) {
  const { data } = await clientUtilisateur(jeton)
    .from("delegate_terms")
    .select("id, profile_id, titre, starts_on, ends_on, revoked_at")
    .eq("class_id", classeId)
    .is("revoked_at", null)
    .gte("ends_on", new Date().toISOString().slice(0, 10));
  return (data ?? []) as { id: string; profile_id: string; titre: string; starts_on: string; ends_on: string; revoked_at: string | null }[];
}

export interface Consultation {
  readonly id: string;
  readonly titre: string;
  readonly etat: string;
  readonly ouvreLe: string | null;
  readonly fermeLe: string | null;
  readonly version: number;
}

export async function consultations(jeton: string, classeId: string): Promise<Consultation[]> {
  const { data } = await clientUtilisateur(jeton)
    .from("consultations")
    .select("id, titre, etat, ouvre_le, ferme_le, version")
    .eq("class_id", classeId)
    .order("created_at", { ascending: false })
    .limit(12);
  return ((data ?? []) as { id: string; titre: string; etat: string; ouvre_le: string | null; ferme_le: string | null; version: number }[]).map((c) => ({
    id: c.id,
    titre: c.titre,
    etat: c.etat,
    ouvreLe: c.ouvre_le,
    fermeLe: c.ferme_le,
    version: c.version,
  }));
}

export interface Decision {
  readonly id: string;
  readonly titre: string;
  readonly explication: string | null;
  readonly statut: string;
  readonly motif: string | null;
  readonly responsable: string | null;
  readonly suiviLe: string | null;
  readonly publiee: boolean;
  readonly version: number;
  readonly majLe: string;
}

export async function decisions(jeton: string, classeId: string): Promise<Decision[]> {
  const { data } = await clientUtilisateur(jeton)
    .from("decisions")
    .select("id, titre, explication, statut, motif, responsable, suivi_le, publiee, version, updated_at")
    .eq("class_id", classeId)
    .order("updated_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as {
    id: string;
    titre: string;
    explication: string | null;
    statut: string;
    motif: string | null;
    responsable: string | null;
    suivi_le: string | null;
    publiee: boolean;
    version: number;
    updated_at: string;
  }[]).map((d) => ({
    id: d.id,
    titre: d.titre,
    explication: d.explication,
    statut: d.statut,
    motif: d.motif,
    responsable: d.responsable,
    suiviLe: d.suivi_le,
    publiee: d.publiee,
    version: d.version,
    majLe: d.updated_at,
  }));
}

export const STATUTS_DECISION: Record<string, { libelle: string; ton: "neutre" | "rose" | "succes" | "attention" | "erreur" }> = {
  proposee: { libelle: "Proposée", ton: "neutre" },
  discutee: { libelle: "Discutée", ton: "neutre" },
  transmise: { libelle: "Transmise", ton: "rose" },
  repondue: { libelle: "Réponse reçue", ton: "rose" },
  en_cours: { libelle: "En cours", ton: "attention" },
  faite: { libelle: "Faite", ton: "succes" },
  refusee: { libelle: "Non retenue", ton: "erreur" },
};

export const TRANSITIONS_DECISION: Record<string, readonly string[]> = {
  proposee: ["discutee", "transmise", "refusee"],
  discutee: ["transmise", "refusee"],
  transmise: ["repondue", "refusee"],
  repondue: ["en_cours", "faite", "refusee"],
  en_cours: ["faite", "refusee"],
};

export async function bibliotheque(jeton: string, classeId: string) {
  const { data } = await clientUtilisateur(jeton)
    .from("bibliotheque")
    .select("id, titre, corps, kind, statut, auteur_id, validee_le, version, created_at, teaching_space_id, source_message_id, source_fiche_id")
    .eq("class_id", classeId)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as {
    id: string;
    titre: string;
    corps: string;
    kind: string;
    statut: string;
    auteur_id: string;
    validee_le: string | null;
    version: number;
    created_at: string;
    teaching_space_id: string | null;
    source_message_id: string | null;
    source_fiche_id: string | null;
  }[];
}

export async function nomsAffichables(jeton: string, ids: readonly string[]): Promise<Map<string, { affichage: string; initiales: string; adulte: boolean }>> {
  const uniques = [...new Set(ids)].filter(Boolean).slice(0, 200);
  if (uniques.length === 0) return new Map();
  const { data } = await clientUtilisateur(jeton).rpc("noms_affichables", { p_ids: uniques });
  return new Map(
    ((data ?? []) as { id: string; affichage: string; initiales: string; adulte: boolean }[]).map((n) => [n.id, { affichage: n.affichage, initiales: n.initiales, adulte: n.adulte }]),
  );
}

import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Le parcours de l'élève — cahier V5, §3.
 *
 * Tout passe par le jeton de la personne : c'est RLS qui décide, et aucune de
 * ces fonctions n'accepte d'identifiant de classe ou d'élève venu du
 * navigateur. Un élève qui forgerait une requête n'obtient pas un refus, il
 * obtient zéro ligne.
 *
 * Ce module ne fabrique rien : pas de durée estimée, pas de score, pas de
 * série de jours. Le §3.3 l'interdit explicitement, et c'est aussi ce qui
 * distingue un cahier de textes d'un jeu.
 */

/* -------------------------------------------------------------------------- */
/* §3.1 — la classe active                                                     */
/* -------------------------------------------------------------------------- */

/**
 * La classe où l'élève est inscrit aujourd'hui.
 *
 * `null` quand il n'y en a pas — un compte créé sans inscription, ou une
 * inscription close. L'écran doit alors le dire, pas tomber (§3.1).
 */
export async function classeActive(jeton: string): Promise<string | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("class_enrollments")
    .select("classes(label)")
    .is("ends_on", null)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null || data === null) return null;
  return (data as unknown as { classes: { label: string } | null }).classes?.label ?? null;
}

/* -------------------------------------------------------------------------- */
/* §3.3 — « à faire », et la case qui tient                                    */
/* -------------------------------------------------------------------------- */

/**
 * Les devoirs que l'élève a cochés.
 *
 * Une case personnelle, invisible au professeur : ce n'est pas une remise de
 * copie, et la montrer transformerait une note pour soi en évaluation. La
 * politique `travaux_faits_eleve` tient cette règle en base.
 */
export async function travauxFaits(jeton: string): Promise<Set<string>> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("travaux_faits")
    .select("assignment_id")
    .limit(500);

  if (error !== null) return new Set();
  return new Set(((data ?? []) as { assignment_id: string }[]).map((l) => l.assignment_id));
}

/**
 * Coche ou décoche un devoir.
 *
 * L'établissement n'est pas pris en paramètre : il est relu sur le devoir
 * lui-même, que RLS n'a laissé voir que s'il appartient au périmètre de
 * l'élève. Cocher le devoir d'une autre classe n'échoue donc pas au dernier
 * moment — la lecture qui précède ne rend déjà rien.
 */
export async function basculerFait(options: {
  jeton: string;
  moi: string;
  devoir: string;
  fait: boolean;
}): Promise<boolean> {
  const client = clientUtilisateur(options.jeton);

  const { data, error } = await client
    .from("assignments")
    .select("id, organization_id")
    .eq("id", options.devoir)
    .eq("state", "publiee")
    .maybeSingle();

  if (error !== null || data === null) return false;
  const ligne = data as { id: string; organization_id: string };

  if (!options.fait) {
    const { error: refus } = await client
      .from("travaux_faits")
      .delete()
      .eq("assignment_id", ligne.id);
    return refus === null;
  }

  const { error: refus } = await client.from("travaux_faits").upsert(
    {
      organization_id: ligne.organization_id,
      assignment_id: ligne.id,
      profile_id: options.moi,
    },
    { onConflict: "assignment_id,profile_id", ignoreDuplicates: true },
  );

  return refus === null;
}

/* -------------------------------------------------------------------------- */
/* §3.4 — depuis ta dernière visite                                            */
/* -------------------------------------------------------------------------- */

export interface Nouveaute {
  readonly genre: "seance" | "correction" | "devoir" | "reponse";
  readonly titre: string;
  readonly contexte: string;
  readonly seance: string | null;
  readonly survenuLe: string;
}

/**
 * Ce qui a changé depuis le passage précédent.
 *
 * L'appel enregistre le passage **et** rend la borne : les deux vont ensemble,
 * et la borne ne glisse qu'après une vraie absence, sinon recharger l'accueil
 * viderait le bloc. Une première venue ne résume rien — c'est exact, et
 * préférable à un résumé de toute l'année.
 */
export async function nouveautes(jeton: string): Promise<Nouveaute[]> {
  const client = clientUtilisateur(jeton);

  const { data: borne, error } = await client.rpc("eleve_visite");
  if (error !== null || typeof borne !== "string") return [];

  const { data, error: refus } = await client.rpc("eleve_nouveautes", {
    p_depuis: borne,
    p_limite: 12,
  });

  if (refus !== null) return [];

  return (
    (data ?? []) as {
      genre: Nouveaute["genre"];
      titre: string;
      contexte: string;
      seance: string | null;
      survenu_le: string;
    }[]
  ).map((ligne) => ({
    genre: ligne.genre,
    titre: ligne.titre,
    contexte: ligne.contexte,
    seance: ligne.seance,
    survenuLe: ligne.survenu_le,
  }));
}

/* -------------------------------------------------------------------------- */
/* §3.5 — « je n'ai pas compris »                                              */
/* -------------------------------------------------------------------------- */

export interface ReponseFil {
  readonly id: string;
  readonly texte: string;
  readonly auteur: string;
  readonly utile: boolean;
  readonly createdAt: string;
}

export interface FilEntraide {
  readonly id: string;
  readonly question: string;
  readonly auteur: string;
  readonly auteurId: string;
  readonly resolu: boolean;
  readonly createdAt: string;
  readonly reponses: readonly ReponseFil[];
}

interface LigneFil {
  id: string;
  question: string;
  auteur_id: string;
  resolu_le: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
  reponses_entraide: {
    id: string;
    texte: string;
    utile: boolean;
    created_at: string;
    masque_le: string | null;
    profiles: { first_name: string; last_name: string } | null;
  }[];
}

/**
 * Les questions posées sur une séance.
 *
 * Le périmètre est le cours, jamais l'établissement : une question de Seconde 1
 * ne se lit pas en Seconde 2, et la politique `fils_lecture` le tient. Il n'y a
 * pas de fil « général » — un fil est toujours accroché à une séance, et c'est
 * ce qui sépare l'entraide scolaire d'un salon de discussion (§3.5).
 */
export async function filsDeLaSeance(jeton: string, seance: string): Promise<FilEntraide[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("fils_entraide")
    .select(
      "id, question, auteur_id, resolu_le, created_at, profiles(first_name, last_name), " +
        "reponses_entraide(id, texte, utile, created_at, masque_le, profiles(first_name, last_name))",
    )
    .eq("lesson_id", seance)
    .is("masque_le", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error !== null) return [];

  return ((data ?? []) as unknown as LigneFil[]).map((fil) => ({
    id: fil.id,
    question: fil.question,
    auteur: nomCourt(fil.profiles),
    auteurId: fil.auteur_id,
    resolu: fil.resolu_le !== null,
    createdAt: fil.created_at,
    reponses: (fil.reponses_entraide ?? [])
      .filter((reponse) => reponse.masque_le === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reponse) => ({
        id: reponse.id,
        texte: reponse.texte,
        auteur: nomCourt(reponse.profiles),
        utile: reponse.utile,
        createdAt: reponse.created_at,
      })),
  }));
}

/** « Rayan B. » — le prénom et l'initiale suffisent entre camarades de classe. */
function nomCourt(profil: { first_name: string; last_name: string } | null): string {
  if (profil === null) return "Un camarade";
  const initiale = profil.last_name.trim().charAt(0);
  return initiale === "" ? profil.first_name : `${profil.first_name} ${initiale.toUpperCase()}.`;
}

/**
 * Pose une question sur une séance.
 *
 * L'espace d'enseignement et l'établissement sont relus sur la séance, que RLS
 * n'a laissé voir que si l'élève y assiste. Les passer depuis le formulaire
 * aurait permis d'accrocher une question à un cours qu'on ne suit pas.
 */
export async function poserQuestion(options: {
  jeton: string;
  moi: string;
  seance: string;
  bloc: string | null;
  question: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const texte = options.question.trim();
  if (texte.length < 3) {
    return { ok: false, message: "Écrivez votre question en quelques mots." };
  }
  if (texte.length > 1000) {
    return { ok: false, message: "Votre question est trop longue." };
  }

  const client = clientUtilisateur(options.jeton);

  const { data, error } = await client
    .from("lessons")
    .select("id, organization_id, teaching_space_id")
    .eq("id", options.seance)
    .eq("state", "publiee")
    .maybeSingle();

  if (error !== null || data === null) {
    return { ok: false, message: "Cette séance n'est pas ouverte aux questions." };
  }
  const seance = data as { id: string; organization_id: string; teaching_space_id: string };

  const { error: refus } = await client.from("fils_entraide").insert({
    organization_id: seance.organization_id,
    teaching_space_id: seance.teaching_space_id,
    lesson_id: seance.id,
    block_id: options.bloc,
    auteur_id: options.moi,
    question: texte,
  });

  if (refus !== null) {
    return { ok: false, message: "Votre question n'a pas pu être enregistrée." };
  }
  return { ok: true };
}

/** Répond à une question d'un camarade du même cours. */
export async function repondre(options: {
  jeton: string;
  moi: string;
  fil: string;
  texte: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const texte = options.texte.trim();
  if (texte.length < 1) {
    return { ok: false, message: "Écrivez votre réponse." };
  }
  if (texte.length > 2000) {
    return { ok: false, message: "Votre réponse est trop longue." };
  }

  const client = clientUtilisateur(options.jeton);

  const { data, error } = await client
    .from("fils_entraide")
    .select("id, organization_id")
    .eq("id", options.fil)
    .is("masque_le", null)
    .maybeSingle();

  if (error !== null || data === null) {
    return { ok: false, message: "Ce fil n'est plus ouvert." };
  }
  const fil = data as { id: string; organization_id: string };

  const { error: refus } = await client.from("reponses_entraide").insert({
    organization_id: fil.organization_id,
    fil_id: fil.id,
    auteur_id: options.moi,
    texte,
  });

  if (refus !== null) {
    return { ok: false, message: "Votre réponse n'a pas pu être enregistrée." };
  }
  return { ok: true };
}

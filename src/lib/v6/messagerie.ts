import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Messagerie de classe — dossier Study V6, §9 ; E09.
 *
 * Lectures sous le jeton de la personne : RLS relit l'appartenance à chaque
 * requête. C'est ce qui rend un retrait effectif même dans un onglet resté
 * ouvert : la relecture suivante ne rend plus rien, et l'interface le dit.
 * Le temps réel est une relecture régulière de cette même API (aucun canal
 * public, aucun contenu poussé hors droits actuels).
 */

export interface SalonResume {
  readonly id: string;
  readonly kind: "general" | "matiere" | "projet";
  readonly label: string;
  readonly mode: "discussion" | "questions" | "annonces";
  readonly classId: string | null;
  readonly teachingSpaceId: string | null;
  readonly projectId: string | null;
  readonly classe: string | null;
  readonly dernierMessage: string | null;
  readonly nonLus: number;
}

export async function mesSalons(jeton: string): Promise<SalonResume[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("mes_salons");
  if (error !== null) return null;
  return ((data ?? []) as {
    id: string;
    kind: SalonResume["kind"];
    label: string;
    mode: SalonResume["mode"];
    class_id: string | null;
    teaching_space_id: string | null;
    project_id: string | null;
    classe: string | null;
    dernier_message: string | null;
    non_lus: number;
  }[]).map((s) => ({
    id: s.id,
    kind: s.kind,
    label: s.label,
    mode: s.mode,
    classId: s.class_id,
    teachingSpaceId: s.teaching_space_id,
    projectId: s.project_id,
    classe: s.classe,
    dernierMessage: s.dernier_message,
    nonLus: s.non_lus,
  }));
}

export interface MessageVu {
  readonly id: string;
  readonly auteur: string;
  readonly auteurNom: string;
  readonly auteurInitiales: string;
  readonly auteurAdulte: boolean;
  readonly parentId: string | null;
  readonly kind: "message" | "question" | "annonce";
  readonly corps: string;
  readonly leconId: string | null;
  readonly exercice: string | null;
  readonly demandeAccuse: boolean;
  readonly version: number;
  readonly creeLe: string;
  readonly modifieLe: string | null;
  readonly supprime: boolean;
  readonly masque: boolean;
  readonly epingle: boolean;
  readonly memeQuestion: number;
  readonly moiAussi: boolean;
  readonly reponses: number;
  readonly accuses: number | null;
  readonly moi: boolean;
}

export interface PageMessages {
  readonly accessible: boolean;
  readonly messages: readonly MessageVu[];
  readonly suivant: string | null;
  readonly animateur: boolean;
  readonly mode: SalonResume["mode"] | null;
}

const TAILLE = 50;

interface LigneMessage {
  id: string;
  author_id: string;
  parent_id: string | null;
  kind: MessageVu["kind"];
  body: string;
  lesson_id: string | null;
  exercise_ref: string | null;
  demande_accuse: boolean;
  version: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  hidden_at: string | null;
  pinned_at: string | null;
}

/**
 * Une page de 50 messages, du plus récent au plus ancien, par curseur
 * `(created_at, id)` — jamais par décalage d'une liste qui bouge.
 * `fil` : les réponses d'un message, dans l'ordre chronologique.
 */
export async function pageMessages(
  jeton: string,
  moi: string,
  salon: string,
  options: { avant?: string | null; apres?: string | null; fil?: string | null; epingles?: boolean } = {},
): Promise<PageMessages> {
  const client = clientUtilisateur(jeton);
  const [lisible, animateur, infos] = await Promise.all([
    client.rpc("salon_lisible", { salon }),
    client.rpc("salon_animateur", { salon }),
    client.from("salons").select("mode").eq("id", salon).maybeSingle(),
  ]);
  if (lisible.data !== true) return { accessible: false, messages: [], suivant: null, animateur: false, mode: null };

  let requete = client
    .from("messages_salon")
    .select("id, author_id, parent_id, kind, body, lesson_id, exercise_ref, demande_accuse, version, created_at, edited_at, deleted_at, hidden_at, pinned_at")
    .eq("salon_id", salon);

  if (options.fil) {
    requete = requete.or(`id.eq.${options.fil},parent_id.eq.${options.fil}`).order("created_at", { ascending: true }).limit(200);
  } else if (options.epingles) {
    requete = requete.not("pinned_at", "is", null).order("pinned_at", { ascending: false }).limit(3);
  } else {
    requete = requete.is("parent_id", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(TAILLE + 1);
    const curseur = options.avant ? decoderCurseur(options.avant) : null;
    if (curseur) {
      requete = requete.or(`created_at.lt.${curseur.date},and(created_at.eq.${curseur.date},id.lt.${curseur.id})`);
    }
    if (options.apres) requete = requete.gt("created_at", options.apres);
  }

  const { data, error } = await requete;
  if (error !== null) return { accessible: true, messages: [], suivant: null, animateur: animateur.data === true, mode: null };
  let lignes = (data ?? []) as LigneMessage[];
  let suivant: string | null = null;
  if (!options.fil && !options.epingles && lignes.length > TAILLE) {
    lignes = lignes.slice(0, TAILLE);
    const dernier = lignes[lignes.length - 1]!;
    suivant = encoderCurseur(dernier.created_at, dernier.id);
  }

  const ids = lignes.map((l) => l.id);
  const auteurs = [...new Set(lignes.map((l) => l.author_id))];
  const [compteurs, noms] = await Promise.all([
    ids.length > 0 ? client.rpc("salon_compteurs", { p_messages: ids }) : Promise.resolve({ data: [] }),
    auteurs.length > 0 ? client.rpc("noms_affichables", { p_ids: auteurs }) : Promise.resolve({ data: [] }),
  ]);
  const parId = new Map(
    ((compteurs.data ?? []) as { message_id: string; meme_question: number; moi_aussi: boolean; reponses: number; accuses: number | null }[]).map(
      (c) => [c.message_id, c],
    ),
  );
  const parAuteur = new Map(((noms.data ?? []) as { id: string; affichage: string; initiales: string; adulte: boolean }[]).map((n) => [n.id, n]));

  return {
    accessible: true,
    animateur: animateur.data === true,
    mode: (infos.data as { mode: SalonResume["mode"] } | null)?.mode ?? null,
    suivant,
    messages: lignes.map((l) => {
      const c = parId.get(l.id);
      const a = parAuteur.get(l.author_id);
      return {
        id: l.id,
        auteur: l.author_id,
        auteurNom: a?.affichage ?? "Ancien membre",
        auteurInitiales: a?.initiales ?? "?",
        auteurAdulte: a?.adulte ?? false,
        parentId: l.parent_id,
        kind: l.kind,
        corps: l.deleted_at ? "" : l.body,
        leconId: l.lesson_id,
        exercice: l.exercise_ref,
        demandeAccuse: l.demande_accuse,
        version: l.version,
        creeLe: l.created_at,
        modifieLe: l.edited_at,
        supprime: l.deleted_at !== null,
        masque: l.hidden_at !== null,
        epingle: l.pinned_at !== null,
        memeQuestion: c?.meme_question ?? 0,
        moiAussi: c?.moi_aussi ?? false,
        reponses: c?.reponses ?? 0,
        accuses: c?.accuses ?? null,
        moi: l.author_id === moi,
      };
    }),
  };
}

function encoderCurseur(date: string, id: string): string {
  return Buffer.from(JSON.stringify([date, id]), "utf8").toString("base64url");
}

function decoderCurseur(brut: string): { date: string; id: string } | null {
  try {
    const [date, id] = JSON.parse(Buffer.from(brut, "base64url").toString("utf8")) as [string, string];
    if (Number.isNaN(Date.parse(date)) || !/^[0-9a-f-]{36}$/iu.test(id)) return null;
    return { date: new Date(date).toISOString(), id };
  } catch {
    return null;
  }
}

export async function marquerLu(jeton: string, moi: string, salon: string): Promise<void> {
  await clientUtilisateur(jeton)
    .from("lectures_salon")
    .upsert({ salon_id: salon, profile_id: moi, lu_jusqu_a: new Date().toISOString() }, { onConflict: "salon_id,profile_id" });
}

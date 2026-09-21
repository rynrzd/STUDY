import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Nouveautés internes — cahier V5, §9.
 *
 * **Pas de courriel, pas de notification poussée.** Une liste que l'on
 * consulte, dans l'application, quand on l'ouvre. Ce n'est pas une limite
 * technique : un élève n'a pas à recevoir un message le soir pour un devoir
 * dont l'échéance est dans huit jours, et un établissement n'a pas à répondre
 * des courriels qu'un logiciel a envoyés à des mineurs.
 *
 * **Une nouveauté lue ne revient pas.** C'est ce qui distingue cette liste du
 * bloc « depuis ta dernière visite », qui, lui, dérive l'activité du cours
 * d'une borne de temps et n'a pas d'état de lecture. Les deux coexistent et
 * leurs genres sont disjoints : rien n'apparaît deux fois.
 *
 * **Le dépôt est un rattrapage, pas un déclencheur.** `nouveautes_rattraper`
 * relit ce qui est publié et dépose ce qui manque ; l'index unique
 * `(personne, genre, objet)` fait que rejouer n'ajoute rien. Instrumenter les
 * sept points d'écriture aurait donné le même résultat le jour où on les
 * instrumente tous — et un trou silencieux le jour où l'on en oublie un.
 */

export type GenreNouveaute =
  | "devoir_publie"
  | "echeance_proche"
  | "correction_publiee"
  | "retour_individuel"
  | "devoir_modifie";

export interface Nouveaute {
  readonly id: string;
  readonly genre: GenreNouveaute;
  /** L'identifiant du devoir concerné : tous les genres en visent un. */
  readonly devoir: string;
  readonly titre: string;
  readonly echeance: string | null;
  readonly survenuLe: string;
  readonly lue: boolean;
}

function journaliser(contexte: string, code: string | undefined): void {
  if (code === "42501" || code === "PGRST116") return;
  console.error(JSON.stringify({ niveau: "erreur", contexte, code: code ?? "inconnu" }));
}

/**
 * Mes nouveautés, non lues d'abord.
 *
 * Le rattrapage est fait ici, à la lecture, et son échec n'empêche pas
 * l'affichage : mieux vaut une liste incomplète qu'un écran d'accueil vide
 * parce qu'un calcul d'échéance a échoué.
 */
export async function mesNouveautes(jeton: string, limite = 12): Promise<Nouveaute[]> {
  const client = clientUtilisateur(jeton);

  const { error: refusRattrapage } = await client.rpc("nouveautes_rattraper");
  if (refusRattrapage !== null) journaliser("nouveautes.rattraper", refusRattrapage.code);

  const { data, error } = await client.rpc("mes_nouveautes", { p_limite: limite });
  if (error !== null) {
    journaliser("nouveautes.lire", error.code);
    return [];
  }

  return (
    (data ?? []) as {
      id: string;
      genre: GenreNouveaute;
      objet: string;
      contexte: { titre?: unknown; echeance?: unknown } | null;
      survenu_le: string;
      lu_le: string | null;
    }[]
  ).map((ligne) => ({
    id: ligne.id,
    genre: ligne.genre,
    devoir: ligne.objet,
    titre: typeof ligne.contexte?.titre === "string" ? ligne.contexte.titre : "Un devoir",
    echeance: typeof ligne.contexte?.echeance === "string" ? ligne.contexte.echeance : null,
    survenuLe: ligne.survenu_le,
    lue: ligne.lu_le !== null,
  }));
}

/**
 * Marque une nouveauté lue.
 *
 * Aucun identifiant de personne n'est passé : la politique `nouveautes_marquer_lue`
 * borne la mise à jour aux lignes de l'appelant. Une requête forgée avec
 * l'identifiant de quelqu'un d'autre ne rend pas un refus, elle ne touche
 * aucune ligne.
 */
export async function marquerLue(jeton: string, nouveaute: string): Promise<boolean> {
  const { error } = await clientUtilisateur(jeton)
    .from("nouveautes")
    .update({ lu_le: new Date().toISOString() })
    .eq("id", nouveaute)
    .is("lu_le", null);

  if (error !== null) {
    journaliser("nouveautes.marquer", error.code);
    return false;
  }
  return true;
}

/** Marque toutes mes nouveautés lues. */
export async function toutMarquerLu(jeton: string): Promise<boolean> {
  const { error } = await clientUtilisateur(jeton)
    .from("nouveautes")
    .update({ lu_le: new Date().toISOString() })
    .is("lu_le", null);

  if (error !== null) {
    journaliser("nouveautes.tout-marquer", error.code);
    return false;
  }
  return true;
}

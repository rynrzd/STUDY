import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Groupes d'entraide — cahier V2, §13.
 *
 * Ce que le produit propose, et ce qu'il ne propose pas, tient à une phrase :
 * un groupe est **rattaché à un cours**. Il n'y a pas de messagerie libre entre
 * comptes, pas d'annuaire d'élèves, pas de « trouver des camarades ». On
 * travaille à plusieurs sur le cours de maths de sa classe, et c'est tout.
 *
 * Toutes les lectures passent par le jeton de la personne : la composition d'un
 * groupe d'une autre classe ne revient pas vide par politesse, elle revient
 * vide parce que RLS ne la montre pas.
 *
 * La taille maximale (2 à 6) est tenue par un déclencheur en base, pas par
 * l'écran : un groupe complet le reste même si deux personnes cliquent en même
 * temps.
 */

export interface Groupe {
  readonly id: string;
  readonly label: string;
  readonly cours: string;
  readonly maxMembres: number;
  readonly ferme: boolean;
  readonly membres: { readonly id: string; readonly prenom: string; readonly nom: string }[];
  /** La personne connectée en fait-elle partie ? */
  readonly jEnSuis: boolean;
  readonly complet: boolean;
}

interface LigneGroupe {
  id: string;
  label: string;
  teaching_space_id: string;
  max_members: number;
  closed_at: string | null;
}

interface LigneMembre {
  workgroup_id: string;
  profile_id: string;
}

/**
 * Les groupes visibles dans un cours.
 *
 * `moi` sert à marquer ceux dont on fait partie. Il vient de la session, jamais
 * du navigateur.
 */
export async function groupesDuCours(
  jeton: string,
  cours: string,
  moi: string,
): Promise<Groupe[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("workgroups")
    .select("id, label, teaching_space_id, max_members, closed_at")
    .eq("teaching_space_id", cours)
    .is("closed_at", null)
    .order("created_at")
    .limit(60);

  if (error !== null) return [];

  const groupes = (data ?? []) as unknown as LigneGroupe[];
  if (groupes.length === 0) return [];

  // Même écueil qu'ailleurs : `workgroup_members.profile_id` référence
  // `organization_memberships`, pas `profiles`. PostgREST refuse le
  // rapprochement, et les noms des membres ne s'affichaient jamais. On relit
  // donc les profils à part.
  const { data: lignesMembres } = await client
    .from("workgroup_members")
    .select("workgroup_id, profile_id")
    .in(
      "workgroup_id",
      groupes.map((groupe) => groupe.id),
    )
    .is("left_at", null)
    .limit(400);

  const membresBruts = (lignesMembres ?? []) as unknown as LigneMembre[];

  // Un seul aller-retour pour tous les noms de la page.
  const { data: profils } = await client
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [...new Set(membresBruts.map((ligne) => ligne.profile_id))]);

  const noms = new Map(
    ((profils ?? []) as { id: string; first_name: string; last_name: string }[]).map((profil) => [
      profil.id,
      profil,
    ]),
  );

  const parGroupe = new Map<string, Groupe["membres"]>();
  for (const ligne of membresBruts) {
    const liste = parGroupe.get(ligne.workgroup_id) ?? [];
    const profil = noms.get(ligne.profile_id);
    liste.push({
      id: ligne.profile_id,
      prenom: profil?.first_name ?? "",
      nom: profil?.last_name ?? "",
    });
    parGroupe.set(ligne.workgroup_id, liste);
  }

  return groupes.map((groupe) => {
    const membres = parGroupe.get(groupe.id) ?? [];
    return {
      id: groupe.id,
      label: groupe.label,
      cours: groupe.teaching_space_id,
      maxMembres: groupe.max_members,
      ferme: groupe.closed_at !== null,
      membres,
      jEnSuis: membres.some((membre) => membre.id === moi),
      complet: membres.length >= groupe.max_members,
    };
  });
}

/**
 * Les groupes dont la personne fait partie, tous cours confondus.
 *
 * Sert au tableau de bord : « où suis-je attendu ? » est une question plus
 * utile que « quels groupes existent ? ».
 */
export async function mesGroupes(jeton: string, moi: string): Promise<Groupe[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("workgroup_members")
    .select("workgroup_id")
    .eq("profile_id", moi)
    .is("left_at", null)
    .limit(60);

  if (error !== null) return [];

  const identifiants = ((data ?? []) as unknown as { workgroup_id: string }[]).map(
    (ligne) => ligne.workgroup_id,
  );
  if (identifiants.length === 0) return [];

  const { data: lignes } = await client
    .from("workgroups")
    .select("id, label, teaching_space_id, max_members, closed_at")
    .in("id", identifiants)
    .is("closed_at", null)
    .limit(60);

  return ((lignes ?? []) as unknown as LigneGroupe[]).map((groupe) => ({
    id: groupe.id,
    label: groupe.label,
    cours: groupe.teaching_space_id,
    maxMembres: groupe.max_members,
    ferme: groupe.closed_at !== null,
    membres: [],
    jEnSuis: true,
    complet: false,
  }));
}

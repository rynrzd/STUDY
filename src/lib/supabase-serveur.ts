import "server-only";

import { createClient } from "@supabase/supabase-js";
import { lireGroupe } from "./config.ts";

/**
 * Accès Supabase côté serveur — deux clients, deux usages, jamais confondus.
 *
 * `clientUtilisateur(jeton)` parle à PostgREST avec le jeton d'accès de la
 * personne connectée. Les politiques RLS s'appliquent : `study.current_user_id()`
 * lit le `sub` du jeton. C'est le client à utiliser pour toute donnée scolaire.
 *
 * `clientExploitation()` utilise la clé privilégiée, qui **contourne RLS**.
 * Elle ne sert qu'aux cas où il n'y a pas d'utilisateur à représenter :
 *
 *   - le dépôt d'une demande commerciale par un visiteur anonyme ;
 *   - l'amorçage du compte propriétaire ;
 *   - les opérations d'administration des comptes chez le fournisseur.
 *
 * Toute autre utilisation est un contournement d'autorisation. C'est écrit ici
 * parce que la différence ne se voit pas à l'appel : les deux clients ont la
 * même interface, et seule la clé change.
 *
 * `server-only` fait échouer la compilation si un composant client importe ce
 * fichier : la clé privilégiée ne peut pas partir dans le bundle par accident.
 *
 * Prérequis côté Supabase : le schéma `study` doit être déclaré dans
 * « Exposed schemas » (Settings → API). Sans cela, PostgREST répond 404 sur
 * toutes les tables. Voir docs/05-branchement-supabase.md.
 */

const SCHEMA = "study";

/** Client agissant au nom d'une personne : RLS s'applique. */
export function clientUtilisateur(jetonAcces: string) {
  const config = lireGroupe("donnees");
  return createClient(config.SUPABASE_URL!, config.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: SCHEMA },
    global: { headers: { Authorization: `Bearer ${jetonAcces}` } },
  });
}

/**
 * Client privilégié : RLS est contournée.
 *
 * Le paramètre `motif` n'est pas décoratif : il oblige l'appelant à écrire
 * pourquoi il lui faut ce niveau d'accès. Une revue de code repère alors un
 * usage abusif en cherchant les appels — `grep clientExploitation` suffit —
 * sans avoir à relire toute la fonction. Il n'est volontairement pas
 * journalisé : une ligne par requête noierait les journaux sans rien apprendre.
 */
export function clientExploitation(motif: MotifPrivilegie) {
  void motif;
  const config = lireGroupe("donnees");
  return createClient(config.SUPABASE_URL!, config.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: SCHEMA },
  });
}

/** Les seuls motifs admis pour contourner RLS. */
export type MotifPrivilegie =
  | "demande_commerciale_publique"
  | "amorcage_proprietaire"
  | "administration_des_comptes"
  | "stockage_des_supports"
  | "tache_planifiee";

/**
 * Client d'authentification : parle à l'API Auth du fournisseur, pas aux
 * tables. Il utilise la clé publiable, celle prévue pour un navigateur — c'est
 * suffisant pour vérifier un mot de passe, et cela évite qu'un échec de
 * connexion passe par la clé privilégiée.
 */
export function clientAuthentification() {
  const config = lireGroupe("donnees");
  return createClient(config.SUPABASE_URL!, config.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * La base est-elle joignable avec la configuration présente ?
 *
 * Utilisé par les écrans qui doivent annoncer une indisponibilité franche
 * plutôt que d'afficher un formulaire qui échouera à la validation.
 */
export function baseConfiguree(source: Record<string, string | undefined> = process.env): boolean {
  return (
    typeof source.SUPABASE_URL === "string" &&
    typeof source.SUPABASE_PUBLISHABLE_KEY === "string" &&
    typeof source.SUPABASE_SECRET_KEY === "string" &&
    source.SUPABASE_URL.length > 0 &&
    source.SUPABASE_PUBLISHABLE_KEY.length > 0 &&
    source.SUPABASE_SECRET_KEY.length > 0
  );
}

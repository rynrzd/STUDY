import "server-only";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  estAdministrateur,
  estEleve,
  estEnseignant,
  estExploitant,
  jetonAccesDe,
  sessionCourante,
  type Personne,
} from "../session-serveur.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";
import { versConnexion } from "./redirection.ts";

/**
 * Le contexte de l'application connectée — dossier Study V6, §2.1 et §6.1.
 *
 * Tout ce qui décide d'un droit est relu en base à chaque requête : la
 * session, puis les affectations vérifiées (`study.mes_contextes`). La classe
 * active vient d'un cookie de préférence, **validé** contre ces affectations :
 * un identifiant de classe qui n'en fait pas partie est ignoré, il ne donne
 * rien. Le sélecteur de contexte ne propose donc jamais un rôle que la
 * personne n'a pas.
 */

export const COOKIE_CLASSE = "study_classe";

export interface ContexteClasse {
  readonly classe: string;
  readonly libelle: string;
  readonly annee: string;
  readonly role: "eleve" | "delegue" | "professeur";
}

export interface ContexteApp {
  readonly personne: Personne;
  readonly jeton: string;
  readonly contextes: readonly ContexteClasse[];
  readonly classeActive: ContexteClasse | null;
  readonly roles: {
    readonly eleve: boolean;
    readonly professeur: boolean;
    readonly admin: boolean;
    readonly exploitant: boolean;
  };
  readonly nonLus: { readonly notifications: number; readonly messages: number };
  readonly chemin: string;
}

/** Le chemin demandé, posé par le proxy, pour revenir au même endroit après connexion. */
export async function cheminCourant(): Promise<string> {
  const entetes = await headers();
  return entetes.get("x-study-chemin") ?? "/app";
}

/**
 * Exige une session utilisable et un jeton du fournisseur ; sinon renvoie vers
 * la connexion avec la suite du parcours. Mémorisé pour la requête : la
 * coque et la page le partagent sans relire la base deux fois.
 */
export const contexteApp = cache(async (): Promise<ContexteApp> => {
  const chemin = await cheminCourant();
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion(chemin, "expiree"));
  if (personne.activationRequise) redirect("/activation");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion(chemin, "expiree"));

  const client = clientUtilisateur(jeton);
  const [contextesLus, notifications, salons] = await Promise.all([
    client.rpc("mes_contextes"),
    client.from("nouveautes").select("id", { count: "exact", head: true }).is("lu_le", null),
    client.rpc("mes_salons"),
  ]);

  const contextes = ((contextesLus.data ?? []) as { classe: string; libelle: string; annee: string; role: ContexteClasse["role"] }[]).map(
    (c) => ({ classe: c.classe, libelle: c.libelle, annee: c.annee, role: c.role }),
  );

  const prefere = (await cookies()).get(COOKIE_CLASSE)?.value ?? null;
  const classeActive = contextes.find((c) => c.classe === prefere) ?? contextes[0] ?? null;

  const messages = ((salons.data ?? []) as { non_lus: number }[]).reduce((n, s) => n + (s.non_lus ?? 0), 0);

  return {
    personne,
    jeton,
    contextes,
    classeActive,
    roles: {
      eleve: estEleve(personne),
      professeur: estEnseignant(personne),
      admin: estAdministrateur(personne) && !estExploitant(personne),
      exploitant: estExploitant(personne),
    },
    nonLus: { notifications: notifications.count ?? 0, messages },
    chemin,
  };
});

/** Identifiant opaque d'une requête, pour le support : jamais de donnée personnelle. */
export function idRequete(): string {
  return randomUUID();
}

export function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase();
}

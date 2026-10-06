import "server-only";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { baseConfiguree, clientExploitation } from "../supabase-serveur.ts";
import {
  COOKIE_MEMOIRE,
  COOKIE_PARCOURS,
  DUREE_MEMOIRE_SECONDES,
  decoderContexte,
  encoderContexte,
  normaliserCode,
  politiqueApresConnexion,
  type ContexteEtablissement,
} from "./contexte-etablissement.ts";

/**
 * Contexte établissement côté serveur — voir `contexte-etablissement.ts`
 * pour la politique. Les cookies sont HttpOnly : le script de la page ne les
 * lit pas, et ils ne portent rien de secret.
 */

const BASE = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

/** Le parcours en cours prime sur la mémoire de l'appareil. */
export async function lireContexteEtablissement(): Promise<ContexteEtablissement | null> {
  const magasin = await cookies();
  return decoderContexte(magasin.get(COOKIE_PARCOURS)?.value) ?? decoderContexte(magasin.get(COOKIE_MEMOIRE)?.value);
}

/** Pose le contexte pour la durée du parcours (cookie de session de navigateur). */
export async function poserParcours(c: ContexteEtablissement): Promise<void> {
  (await cookies()).set(COOKIE_PARCOURS, encoderContexte(c), BASE);
}

/** « Changer » : on oublie tout, parcours et mémoire. */
export async function oublierContexte(): Promise<void> {
  const magasin = await cookies();
  magasin.set(COOKIE_PARCOURS, "", { ...BASE, maxAge: 0 });
  magasin.set(COOKIE_MEMOIRE, "", { ...BASE, maxAge: 0 });
}

/** Après une connexion réussie : mémoriser (appareil personnel) ou effacer (partagé). */
export async function appliquerPolitique(c: ContexteEtablissement | null, appareil: "personnel" | "partage"): Promise<void> {
  const magasin = await cookies();
  const politique = politiqueApresConnexion(appareil);
  if (politique.effacerParcours) magasin.set(COOKIE_PARCOURS, "", { ...BASE, maxAge: 0 });
  if (politique.memoriser && c !== null) {
    magasin.set(COOKIE_MEMOIRE, encoderContexte(c), { ...BASE, maxAge: DUREE_MEMOIRE_SECONDES });
  } else {
    magasin.set(COOKIE_MEMOIRE, "", { ...BASE, maxAge: 0 });
  }
}

/** Empreinte de l'adresse réseau : sert à limiter les essais, jamais conservée en clair. */
export async function empreinteReseau(sel: string): Promise<string> {
  const entetes = await headers();
  const ip = (entetes.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  return `\\x${createHash("sha256").update(`${sel}:${ip}`).digest("hex")}`;
}

export type ResultatDecouverte =
  | { readonly etat: "trouve"; readonly contexte: ContexteEtablissement }
  | { readonly etat: "inconnu" | "trop_essais" | "indisponible" | "format" };

/** Nom d'un établissement à partir de son code public. Rien d'autre n'est lu. */
export async function decouvrirEtablissement(brut: string): Promise<ResultatDecouverte> {
  const code = normaliserCode(brut);
  if (code === null) return { etat: "format" };
  if (!baseConfiguree()) return { etat: "indisponible" };
  const { data, error } = await clientExploitation("decouverte_etablissement").rpc("etablissement_decouvrir", {
    p_code: code,
    p_empreinte: await empreinteReseau("study-decouverte"),
  });
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "decouverte_etablissement", code: error.code }));
    return { etat: "indisponible" };
  }
  const ligne = ((data ?? []) as { etat: string; code: string | null; nom: string | null }[])[0];
  if (ligne?.etat === "trouve" && ligne.code && ligne.nom) return { etat: "trouve", contexte: { code: ligne.code, nom: ligne.nom } };
  if (ligne?.etat === "trop_essais") return { etat: "trop_essais" };
  return { etat: "inconnu" };
}

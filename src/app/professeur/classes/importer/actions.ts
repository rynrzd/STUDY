"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { aplatir } from "@/lib/assistant-rentree";
import { lireGroupe } from "@/lib/config";
import { lireListeEleves, type EleveImporte } from "@/lib/liste-classe";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientExploitation, clientUtilisateur } from "@/lib/supabase-serveur";
import { FichierIllisible } from "@/lib/tableur";

export interface EtatImportClasse { readonly etat?: "erreur" | "apercu" | "termine"; readonly message?: string; readonly eleves?: readonly EleveImporte[]; readonly resultats?: readonly { prenom: string; nom: string; login: string; deja: boolean }[] }

async function contexte() {
  const personne = await sessionCourante();
  if (!personne || !personne.roles.includes("professeur")) throw new Error("Action refusée.");
  const jeton = await jetonAccesDe(personne);
  if (!jeton) throw new Error("Session expirée.");
  return { jeton };
}

export async function analyserListe(_precedent: EtatImportClasse, donnees: FormData): Promise<EtatImportClasse> {
  await contexte();
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { etat: "erreur", message: "Choisis un fichier PDF, CSV ou XLSX." };
  try {
    const eleves = await lireListeEleves(fichier.name, Buffer.from(await fichier.arrayBuffer()));
    return { etat: "apercu", message: `${eleves.length} élève${eleves.length > 1 ? "s" : ""} reconnu${eleves.length > 1 ? "s" : ""}. Vérifie les noms avant de confirmer.`, eleves };
  } catch (erreur) {
    return { etat: "erreur", message: erreur instanceof FichierIllisible ? erreur.message : "Le fichier n’a pas pu être lu." };
  }
}

const ligne = z.object({ prenom: z.string().trim().min(1).max(80), nom: z.string().trim().min(1).max(80), externe: z.string().regex(/^[a-f0-9]{64}$/), ligne: z.number().int().positive() });

function proposerLogin(prenom: string, nom: string, externe: string): string {
  const base = `${aplatir(prenom).replace(/ /g, ".")}.${aplatir(nom).replace(/ /g, ".")}`.replace(/[^a-z0-9._-]/g, "").slice(0, 30) || "eleve";
  return `${base}-${externe.slice(0, 6)}`.slice(0, 39);
}

export async function appliquerListe(_precedent: EtatImportClasse, donnees: FormData): Promise<EtatImportClasse> {
  const { jeton } = await contexte();
  const classe = String(donnees.get("classe") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(classe)) return { etat: "erreur", message: "Classe invalide." };
  let candidats: z.infer<typeof ligne>[];
  try { candidats = z.array(ligne).min(1).max(5000).parse(JSON.parse(String(donnees.get("eleves") ?? "[]"))); }
  catch { return { etat: "erreur", message: "La liste à confirmer est invalide. Relance l’analyse du fichier." }; }
  let domaine: string;
  try { domaine = lireGroupe("alias").STUDENT_ALIAS_DOMAIN!; }
  catch { return { etat: "erreur", message: "L’import est indisponible : le domaine technique des comptes élèves n’est pas configuré." }; }
  const utilisateur = clientUtilisateur(jeton);
  const admin = clientExploitation("administration_des_comptes");
  const resultats: { prenom: string; nom: string; login: string; deja: boolean }[] = [];
  for (const candidat of candidats) {
    const { data: trouve, error: erreurRecherche } = await utilisateur.rpc("classe_autonome_retrouver_eleve", { p_classe: classe, p_externe: candidat.externe });
    if (erreurRecherche) return { etat: "erreur", message: "La classe n’est pas accessible ou l’import a été interrompu." };
    const existant = ((trouve ?? []) as { profile_id: string; login: string }[])[0];
    if (existant) {
      const { error } = await utilisateur.rpc("classe_autonome_ajouter_eleve", { p_classe: classe, p_profile: existant.profile_id, p_prenom: candidat.prenom, p_nom: candidat.nom, p_login: existant.login, p_alias: "inutilise", p_externe: candidat.externe });
      if (error) return { etat: "erreur", message: "Un élève existant n’a pas pu être rattaché à la classe." };
      resultats.push({ prenom: candidat.prenom, nom: candidat.nom, login: existant.login, deja: true });
      continue;
    }
    const login = proposerLogin(candidat.prenom, candidat.nom, candidat.externe);
    const alias = `${randomBytes(16).toString("hex")}@${domaine}`;
    const { data: compte, error: erreurCompte } = await admin.auth.admin.createUser({ email: alias, password: randomBytes(24).toString("base64url"), email_confirm: true });
    if (erreurCompte || !compte.user) return { etat: "erreur", message: `Le compte de ${candidat.prenom} ${candidat.nom} n’a pas pu être préparé.` };
    const { error } = await utilisateur.rpc("classe_autonome_ajouter_eleve", { p_classe: classe, p_profile: compte.user.id, p_prenom: candidat.prenom, p_nom: candidat.nom, p_login: login, p_alias: alias, p_externe: candidat.externe });
    if (error) {
      await admin.auth.admin.deleteUser(compte.user.id);
      return { etat: "erreur", message: `L’ajout de ${candidat.prenom} ${candidat.nom} a échoué. Aucun compte incomplet n’a été conservé.` };
    }
    resultats.push({ prenom: candidat.prenom, nom: candidat.nom, login, deja: false });
  }
  return { etat: "termine", message: `${resultats.length} élève${resultats.length > 1 ? "s" : ""} prêt${resultats.length > 1 ? "s" : ""}.`, resultats };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { reconduireCours } from "@/lib/etablissement";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Passage d'année (D05). Les contrôles réels sont en base (0059) :
 * administration de l'établissement avec second facteur, idempotence, refus
 * d'une année sans classe, refus tant que des élèves actifs n'ont pas de
 * classe dans l'année cible (sauf confirmation explicite, journalisée).
 */

const uuid = z.string().uuid();
const schema = z.object({
  label: z.string().trim().regex(/^\d{4}-\d{4}$/u, "Format attendu : 2027-2028."),
  debut: z.string().date("Date de rentrée invalide."),
  fin: z.string().date("Date de fin invalide."),
});

async function rpc(fonction: string, parametres: Record<string, unknown>) {
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc(fonction, parametres);
  return { data, erreur: error === null ? null : traduire(error, requestId) };
}

export async function preparerAnnee(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { label: String(donnees.get("label") ?? ""), debut: String(donnees.get("debut") ?? ""), fin: String(donnees.get("fin") ?? "") };
  const analyse = schema.safeParse(valeurs);
  if (!analyse.success) {
    const champs: Record<string, string[]> = {};
    for (const i of analyse.error.issues) champs[String(i.path[0])] = [i.message];
    return { ok: false, message: "Vérifiez les champs signalés.", champs, valeurs };
  }
  if (analyse.data.fin <= analyse.data.debut) return { ok: false, message: "La fin doit suivre la rentrée.", champs: { fin: ["Date antérieure à la rentrée."] }, valeurs };
  const { erreur } = await rpc("annee_preparer", { p_label: analyse.data.label, p_debut: analyse.data.debut, p_fin: analyse.data.fin });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs };
  revalidatePath("/admin/annees");
  return { ok: true, message: `Année ${analyse.data.label} préparée. Créez ou importez ses classes, puis reconduisez les élèves.` };
}

export async function creerClasseCible(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const libelle = String(donnees.get("libelle") ?? "").trim();
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  if (libelle.length < 2 || libelle.length > 60) return { ok: false, message: "Indiquez le nom de la classe.", champs: { libelle: ["2 à 60 caractères."] } };
  const { erreur } = await rpc("annee_creer_classe", { p_annee: annee, p_libelle: libelle });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs: { libelle } };
  revalidatePath("/admin/annees");
  return { ok: true, message: `Classe « ${libelle} » créée.` };
}

export async function preinscrire(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const source = uuid.safeParse(String(donnees.get("source") ?? ""));
  const cible = uuid.safeParse(String(donnees.get("cible") ?? ""));
  if (!source.success || !cible.success) return { ok: false, message: "Choisissez la classe d'arrivée.", champs: { cible: ["Choix requis."] } };
  const { data, erreur } = await rpc("annee_preinscrire_classe", { p_classe_source: source.data, p_classe_cible: cible.data });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath("/admin/annees");
  const n = Number(data ?? 0);
  return { ok: true, message: n === 0 ? "Aucun élève à ajouter : ils sont déjà inscrits dans l'année suivante." : `${n} élève${n > 1 ? "s" : ""} préinscrit${n > 1 ? "s" : ""}.` };
}

export async function basculer(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  const confirmer = donnees.get("confirmerSansClasse") === "oui";
  const { data, erreur } = await rpc("annee_basculer", { p_cible: annee, p_confirmer_sans_classe: confirmer });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath("/admin/annees");
  return { ok: true, message: data === true ? "Bascule effectuée. L'année quittée est archivée ; rien n'a été supprimé." : "Cette année était déjà la courante : rien n'a été modifié." };
}

/**
 * Reconduire des groupes dans l'année préparée (0073) : même nom et même
 * type, jamais les élèves ; cours et professeurs titulaires en option.
 */
export async function reconduireGroupes(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  const groupes = donnees.getAll("groupe").map(String).filter((g) => uuid.safeParse(g).success);
  if (groupes.length === 0) return { ok: false, message: "Cochez au moins un groupe." };
  const avecCours = donnees.get("avec_cours") === "oui";
  const { data, erreur } = await rpc("annee_reconduire_groupes", { p_cible: annee, p_groupes: groupes, p_avec_cours: avecCours });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath("/admin/annees");
  const lignes = (data ?? []) as { resultat: string; cours_reconduits: number }[];
  const crees = lignes.filter((l) => l.resultat === "cree").length;
  const cours = lignes.reduce((n, l) => n + (l.cours_reconduits ?? 0), 0);
  return {
    ok: true,
    message:
      crees === 0
        ? "Ces groupes existaient déjà dans l'année suivante : rien n'a été dupliqué."
        : `${crees} groupe${crees > 1 ? "s" : ""} reconduit${crees > 1 ? "s" : ""}${avecCours ? `, ${cours} cours` : ""}. Ajoutez leurs élèves depuis « Groupes » une fois la composition connue.`,
  };
}

/**
 * Reconduire des cours de classe et leurs professeurs vers l'année préparée
 * (PROF-18, YR-08) : chaque ligne nomme le cours d'origine, la classe d'arrivée
 * et les professeurs écartés (qui partent, ou changent de service). Jamais
 * d'élève, jamais de remplaçant ; rejouer ne duplique rien.
 */
export async function reconduireDesCours(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement") || !(await assuranceSuffisante(personne))) {
    return { ok: false, message: "Action refusée." };
  }
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  let lignes: { espace: string; classe: string; exclus: string[] }[] = [];
  try {
    const lu = JSON.parse(String(donnees.get("lignes") ?? "[]"));
    if (Array.isArray(lu)) {
      lignes = lu
        .filter((l) => l && uuid.safeParse(l.espace).success && uuid.safeParse(l.classe).success)
        .map((l) => ({ espace: l.espace, classe: l.classe, exclus: Array.isArray(l.exclus) ? l.exclus.filter((x: unknown) => uuid.safeParse(x).success) : [] }));
    }
  } catch {
    return { ok: false, message: "Sélection illisible." };
  }
  if (lignes.length === 0) return { ok: false, message: "Cochez au moins un cours et choisissez sa classe d'arrivée." };
  const r = await reconduireCours(personne.profileId, annee, lignes);
  if (r === null) return { ok: false, message: "La reconduction a été refusée." };
  revalidatePath("/admin/annees");
  return { ok: true, message: `${r.cours} cours créé${r.cours > 1 ? "s" : ""} dans l'année préparée${r.refusees > 0 ? `, ${r.refusees} ligne${r.refusees > 1 ? "s" : ""} refusée${r.refusees > 1 ? "s" : ""}` : ""}. Les professeurs gardés y sont affectés à la rentrée.` };
}

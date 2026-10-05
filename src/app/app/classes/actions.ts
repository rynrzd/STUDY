"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { codeStable, traduire } from "@/lib/v6/erreurs";
import { empreinteCode, empreinteInvitation, genererCodeClasse, genererJetonInvitation } from "@/lib/v6/invitations";

/**
 * Actions de Ma classe — E10 à E13, E18, E25.
 *
 * Aucune n'accepte un rôle ou un droit venu du formulaire : les fonctions SQL
 * relisent les affectations (responsable, délégué en mandat, enseignant). Un
 * élève qui forge une requête reçoit « Ce contenu n'est pas accessible ».
 */

const uuid = z.string().uuid();

async function appeler(
  fonction: string,
  parametres: Record<string, unknown>,
  chemins: readonly string[],
  succes: string,
): Promise<EtatFormulaire & { donnees?: unknown }> {
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc(fonction, parametres);
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: e.message, code: e.code, requestId };
  }
  for (const c of chemins) revalidatePath(c);
  return { ok: true, message: succes, donnees: data };
}

function lire(donnees: FormData, cle: string): string {
  return String(donnees.get(cle) ?? "").trim();
}

/* --- Accès à la classe ---------------------------------------------------- */

export async function deciderDemande(donnees: FormData): Promise<void> {
  const demande = uuid.safeParse(lire(donnees, "demande"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!demande.success || !classe.success) return;
  await appeler("classe_decider_demande", { p_demande: demande.data, p_accepter: lire(donnees, "accepter") === "oui" }, [
    `/app/classes/${classe.data}/membres`,
  ], "");
}

/** Crée un code de classe : il est affiché une seule fois, puis n'existe plus qu'en empreinte. */
export async function creerCode(classe: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!uuid.safeParse(classe).success) return { ok: false, message: "Classe invalide." };
  const heures = Math.min(720, Math.max(1, Number(lire(donnees, "heures")) || 48));
  const code = genererCodeClasse();
  const r = await appeler("classe_creer_code", { p_classe: classe, p_empreinte: empreinteCode(code), p_heures: heures }, [
    `/app/classes/${classe}/membres`,
  ], "Code créé.");
  if (!r.ok) return r;
  const echeance = new Date(String(r.donnees)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
  return { ok: true, message: `${code.slice(0, 5)}-${code.slice(5)}|${echeance}` };
}

export async function revoquerCodes(donnees: FormData): Promise<void> {
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!classe.success) return;
  await appeler("classe_revoquer_codes", { p_classe: classe.data }, [`/app/classes/${classe.data}/membres`], "");
}

/** Crée un lien d'invitation nominatif : affiché une seule fois, à imprimer ou remettre. */
export async function creerInvitation(classe: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const profil = uuid.safeParse(lire(donnees, "profil"));
  if (!profil.success || !uuid.safeParse(classe).success) return { ok: false, message: "Élève invalide." };
  const jeton = genererJetonInvitation();
  const r = await appeler("invitation_creer", { p_profile: profil.data, p_empreinte: empreinteInvitation(jeton), p_jours: 7 }, [
    `/app/classes/${classe}/membres`,
  ], "");
  if (!r.ok) return r;
  const origine = (process.env.APP_ORIGIN ?? "").replace(/\/$/u, "");
  return { ok: true, message: `${origine}/invitation/${jeton}`, valeurs: { profil: profil.data } };
}

export async function revoquerInvitation(donnees: FormData): Promise<void> {
  const profil = uuid.safeParse(lire(donnees, "profil"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!profil.success || !classe.success) return;
  await appeler("invitation_revoquer", { p_profile: profil.data }, [`/app/classes/${classe.data}/membres`], "");
}

export async function retirerEleve(classe: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const profil = uuid.safeParse(lire(donnees, "profil"));
  const motif = lire(donnees, "motif");
  if (!profil.success || !uuid.safeParse(classe).success) return { ok: false, message: "Élève invalide." };
  if (motif.length < 3) return { ok: false, message: "Indiquez un motif.", champs: { motif: ["Un motif d'au moins trois caractères est nécessaire."] } };
  return appeler("classe_retirer_eleve", { p_classe: classe, p_profile: profil.data, p_motif: motif.slice(0, 480) }, [
    `/app/classes/${classe}/membres`,
  ], "L'élève a été retiré de la classe. Son accès est coupé dès sa prochaine action.");
}

export async function designerDelegue(classe: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const profil = uuid.safeParse(lire(donnees, "profil"));
  const fin = lire(donnees, "fin");
  const titre = lire(donnees, "titre") === "suppleant" ? "suppleant" : "titulaire";
  if (!profil.success || !/^\d{4}-\d{2}-\d{2}$/u.test(fin)) {
    return { ok: false, message: "Choisissez un élève et une date de fin de mandat.", champs: { fin: ["Date de fin requise."] } };
  }
  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const org = await clientUtilisateur(jeton).from("classes").select("organization_id").eq("id", classe).maybeSingle();
  if (org.data === null) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId };
  const { error } = await clientUtilisateur(jeton).from("delegate_terms").insert({
    organization_id: (org.data as { organization_id: string }).organization_id,
    class_id: classe,
    profile_id: profil.data,
    titre,
    ends_on: fin,
    created_by: personne.profileId,
  });
  if (error !== null) {
    return { ok: false, message: error.code === "23514" ? "Un mandat ne dépasse pas un an." : traduire(error, requestId).message, requestId };
  }
  revalidatePath(`/app/classes/${classe}`);
  revalidatePath(`/app/classes/${classe}/membres`);
  return { ok: true, message: "Mandat enregistré." };
}

export async function revoquerMandat(donnees: FormData): Promise<void> {
  const mandat = uuid.safeParse(lire(donnees, "mandat"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!mandat.success || !classe.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).from("delegate_terms").update({ revoked_at: new Date().toISOString() }).eq("id", mandat.data);
  revalidatePath(`/app/classes/${classe.data}/membres`);
}

/* --- Vie de classe --------------------------------------------------------- */

export async function creerConsultation(classe: string, _precedent: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const titre = lire(donnees, "titre");
  if (titre.length < 3) return { ok: false, message: "Donnez un titre.", champs: { titre: ["Trois caractères au moins."] }, valeurs: { titre } };
  const jours = Math.min(31, Math.max(1, Number(lire(donnees, "jours")) || 7));
  const r = await appeler("consultation_creer", { p_classe: classe, p_titre: titre.slice(0, 120), p_jours: jours }, [`/app/classes/${classe}/delegues`], "Consultation créée en brouillon.");
  return { ...r, valeurs: r.ok ? {} : { titre } };
}

export async function changerEtatConsultation(donnees: FormData): Promise<void> {
  const consultation = uuid.safeParse(lire(donnees, "consultation"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  const etat = lire(donnees, "etat");
  if (!consultation.success || !classe.success || !["ouverte", "close", "archivee"].includes(etat)) return;
  await appeler("consultation_etat", { p_consultation: consultation.data, p_etat: etat, p_jours: Number(lire(donnees, "jours")) || 7 }, [
    `/app/classes/${classe.data}`,
    `/app/classes/${classe.data}/delegues`,
    `/app/classes/${classe.data}/consultations/${consultation.data}`,
  ], "");
}

export async function repondreConsultation(
  consultation: string,
  classe: string,
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const valeurs = {
    fonctionne: lire(donnees, "fonctionne").slice(0, 2000),
    difficulte: lire(donnees, "difficulte").slice(0, 2000),
    proposition: lire(donnees, "proposition").slice(0, 2000),
    categorie: lire(donnees, "categorie"),
    version: lire(donnees, "version"),
  };
  if (!["charge", "aide", "projets", "vie_quotidienne"].includes(valeurs.categorie)) {
    return { ok: false, message: "Choisissez une catégorie.", champs: { categorie: ["Catégorie requise."] }, valeurs };
  }
  if (!valeurs.fonctionne && !valeurs.difficulte && !valeurs.proposition) {
    return { ok: false, message: "Écrivez au moins une réponse.", champs: { proposition: ["Au moins un des trois champs."] }, valeurs };
  }
  if (donnees.get("confirme") !== "oui") {
    // Première étape : aperçu avec destinataires, rien n'est encore envoyé.
    return { ok: false, code: "APERCU", message: "", valeurs };
  }
  const r = await appeler(
    "consultation_repondre",
    {
      p_consultation: consultation,
      p_fonctionne: valeurs.fonctionne,
      p_difficulte: valeurs.difficulte,
      p_proposition: valeurs.proposition,
      p_categorie: valeurs.categorie,
      p_version: Number(valeurs.version) || 0,
    },
    [`/app/classes/${classe}/consultations/${consultation}`],
    "Ta réponse est envoyée. Tu peux la modifier jusqu'à la clôture.",
  );
  return r.ok ? { ...r, valeurs: { ...valeurs, version: String(r.donnees) } } : { ...r, valeurs };
}

export async function preparerSynthese(donnees: FormData): Promise<void> {
  const consultation = uuid.safeParse(lire(donnees, "consultation"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!consultation.success || !classe.success) return;
  await appeler("consultation_preparer_synthese", { p_consultation: consultation.data }, [`/app/classes/${classe.data}/delegues`], "");
}

export async function modifierSynthese(consultation: string, classe: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const texte = String(donnees.get("texte") ?? "").slice(0, 12000);
  const version = Number(lire(donnees, "version")) || 0;
  const publier = donnees.get("publier") === "oui";
  const r = await appeler("consultation_modifier_synthese", { p_consultation: consultation, p_texte: texte, p_version: version }, [
    `/app/classes/${classe}/delegues`,
  ], "Synthèse enregistrée (brouillon).");
  if (!r.ok) return { ...r, valeurs: { texte, version: String(version) } };
  if (!publier) return { ...r, valeurs: { texte, version: String(r.donnees) } };
  const p = await appeler("consultation_publier_synthese", { p_consultation: consultation, p_version: Number(r.donnees) }, [
    `/app/classes/${classe}`,
    `/app/classes/${classe}/delegues`,
  ], "Compte rendu publié à la classe.");
  return { ...p, valeurs: { texte, version: String(Number(r.donnees)) } };
}

export async function creerDecision(classe: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const titre = lire(donnees, "titre");
  const explication = lire(donnees, "explication");
  if (titre.length < 3) return { ok: false, message: "Donnez un intitulé.", champs: { titre: ["Trois caractères au moins."] }, valeurs: { titre, explication } };
  const consultation = uuid.safeParse(lire(donnees, "consultation"));
  return appeler(
    "decision_creer",
    { p_classe: classe, p_titre: titre.slice(0, 160), p_explication: explication.slice(0, 4000), p_consultation: consultation.success ? consultation.data : null, p_publiee: true },
    [`/app/classes/${classe}`, `/app/classes/${classe}/delegues`],
    "Sujet ajouté au suivi.",
  );
}

export async function changerDecision(classe: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const decision = uuid.safeParse(lire(donnees, "decision"));
  if (!decision.success) return { ok: false, message: "Sujet invalide." };
  const suivi = lire(donnees, "suivi");
  return appeler(
    "decision_changer",
    {
      p_decision: decision.data,
      p_statut: lire(donnees, "statut"),
      p_motif: lire(donnees, "motif") || null,
      p_responsable: lire(donnees, "responsable") || null,
      p_suivi: /^\d{4}-\d{2}-\d{2}$/u.test(suivi) ? suivi : null,
      p_version: Number(lire(donnees, "version")) || 0,
    },
    [`/app/classes/${classe}`, `/app/classes/${classe}/delegues`],
    "Suivi mis à jour.",
  );
}

/* --- Bibliothèque et entraide ---------------------------------------------- */

export async function proposerRessource(classe: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { titre: lire(donnees, "titre"), corps: String(donnees.get("corps") ?? "").trim(), kind: lire(donnees, "kind") };
  const champs: Record<string, string[]> = {};
  if (valeurs.titre.length < 3) champs.titre = ["Trois caractères au moins."];
  if (valeurs.corps.length < 3) champs.corps = ["Écrivez l'explication à partager."];
  if (!["explication", "fiche", "methode", "lien"].includes(valeurs.kind)) champs.kind = ["Choisissez un type."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs };
  const message = uuid.safeParse(lire(donnees, "message"));
  const fiche = uuid.safeParse(lire(donnees, "fiche"));
  const r = await appeler(
    "bibliotheque_proposer",
    {
      p_classe: classe,
      p_titre: valeurs.titre.slice(0, 140),
      p_corps: valeurs.corps.slice(0, 12000),
      p_kind: valeurs.kind,
      p_espace: null,
      p_message: message.success ? message.data : null,
      p_fiche: fiche.success ? fiche.data : null,
    },
    [`/app/classes/${classe}/bibliotheque`],
    "Ressource proposée à la classe.",
  );
  return r.ok ? r : { ...r, valeurs };
}

export async function statutRessource(donnees: FormData): Promise<void> {
  const ressource = uuid.safeParse(lire(donnees, "ressource"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!ressource.success || !classe.success) return;
  await appeler("bibliotheque_statut", { p_ressource: ressource.data, p_statut: lire(donnees, "statut"), p_version: Number(lire(donnees, "version")) || 0 }, [
    `/app/classes/${classe.data}/bibliotheque`,
  ], "");
}

export async function creerRevisionCollective(classe: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { titre: lire(donnees, "titre"), deroule: lire(donnees, "deroule"), debut: lire(donnees, "debut"), duree: lire(donnees, "duree"), capacite: lire(donnees, "capacite") };
  const debut = new Date(valeurs.debut);
  if (valeurs.titre.length < 3 || Number.isNaN(debut.getTime())) {
    return { ok: false, message: "Indiquez un titre et un créneau.", champs: { titre: valeurs.titre.length < 3 ? ["Trois caractères au moins."] : [], debut: Number.isNaN(debut.getTime()) ? ["Date et heure requises."] : [] }, valeurs };
  }
  const r = await appeler(
    "revcol_creer",
    { p_classe: classe, p_titre: valeurs.titre.slice(0, 140), p_deroule: valeurs.deroule.slice(0, 4000), p_debut: debut.toISOString(), p_duree: Number(valeurs.duree) || 45, p_capacite: Number(valeurs.capacite) || 8, p_espace: null },
    [`/app/classes/${classe}`],
    "Séance d'entraide proposée.",
  );
  return r.ok ? r : { ...r, valeurs };
}

export async function inscriptionRevision(donnees: FormData): Promise<void> {
  const revision = uuid.safeParse(lire(donnees, "revision"));
  const classe = uuid.safeParse(lire(donnees, "classe"));
  if (!revision.success || !classe.success) return;
  const action = lire(donnees, "action");
  const { jeton } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const { error } =
    action === "annuler"
      ? await client.rpc("revcol_annuler", { p_revision: revision.data })
      : await client.rpc("revcol_inscrire", { p_revision: revision.data, p_inscrire: action === "inscrire" });
  revalidatePath(`/app/classes/${classe.data}`);
  if (error !== null) redirect(`/app/entraide/${revision.data}?erreur=${codeStable(error.message) ?? "ERREUR"}`);
  redirect(`/app/entraide/${revision.data}`);
}

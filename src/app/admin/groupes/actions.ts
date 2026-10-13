"use server";

import { revalidatePath } from "next/cache";
import {
  affecterProfesseurGroupe,
  assurerAnnee,
  contexte,
  creerGroupe,
  groupes as listerGroupes,
  limitesEtablissement,
  ficheClasse,
  type GenreGroupe,
  groupeAjouterEleves,
  groupeDecrire,
  designerCoordinateur,
  groupeMembres,
  groupeRetirerEleve,
  rechercherMembres,
} from "@/lib/etablissement";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { nomsVoisins } from "@/lib/noms-voisins";
import { sessionCourante } from "@/lib/session-serveur";

import type { EtatAdmin } from "../etats";

/**
 * Gestes d'administration des groupes pédagogiques — cahier des charges, ch. 07.
 *
 * Mêmes garde-fous que les gestes de classe : le rôle et le second facteur sont
 * revérifiés côté serveur ; l'établissement et l'année ne viennent jamais du
 * formulaire, ils sont recalculés en base à partir de l'adhésion de la personne.
 */

async function exigerAdministrateur(): Promise<string> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    throw new Error("Action refusée.");
  }
  if (!(await assuranceSuffisante(personne))) {
    throw new Error(REFUS_ASSURANCE);
  }
  return personne.profileId;
}

async function anneeCourante(acteur: string): Promise<string | null> {
  const situation = await contexte(acteur);
  if (situation === null) return null;
  return situation.academicYearId ?? (await assurerAnnee(acteur));
}

function texte(donnees: FormData, champ: string, maximum: number): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur.trim().slice(0, maximum) : "";
}

function identifiant(donnees: FormData, champ: string): string | null {
  const valeur = donnees.get(champ);
  if (typeof valeur !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur) ? valeur : null;
}

/** Les UUID valides d'un champ à cases multiples (les élèves cochés). */
function identifiants(donnees: FormData, champ: string): string[] {
  return donnees
    .getAll(champ)
    .filter((v): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

export async function creerUnGroupe(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const label = texte(donnees, "label", 80);
  const kindBrut = texte(donnees, "kind", 20);
  const kind: GenreGroupe = kindBrut === "sous_groupe" ? "sous_groupe" : "interclasses";

  if (label.length < 2) {
    return { etat: "erreur", message: "Donnez un nom de groupe, par exemple « Spé Maths A »." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  // SEC-15 : limite de groupes de l'établissement, réglée par l'exploitation.
  const limites = await limitesEtablissement(acteur);
  if (limites !== null && limites.groupes >= limites.groupes_max) {
    return { etat: "erreur", message: `L'établissement a atteint sa limite de ${limites.groupes_max} groupes. Archivez des groupes inutilisés, ou demandez un relèvement à votre interlocuteur AvecStudy.` };
  }

  // GR-14 : un nom presque identique à un groupe existant prête à confusion.
  // Rien n'est fusionné : on le signale, et l'administrateur précise ou
  // confirme.
  if (donnees.get("confirmer") !== "oui") {
    const voisin = (await listerGroupes(acteur)).find((g) => g.academic_year_id === annee && nomsVoisins(g.label, label));
    if (voisin !== undefined) {
      return { etat: "erreur", message: `Un groupe au nom très proche existe déjà : « ${voisin.label} ».`, equivalente: voisin.label, saisie: label };
    }
  }

  const cree = await creerGroupe(acteur, annee, label, kind);
  if (cree === null) {
    return { etat: "erreur", message: "Le groupe n'a pas pu être créé." };
  }

  revalidatePath("/admin/groupes");
  revalidatePath("/admin");
  return { etat: "ok", message: `Groupe « ${label} » créé.` };
}

export async function ajouterDesEleves(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const eleves = identifiants(donnees, "eleve");

  if (groupe === null) {
    return { etat: "erreur", message: "Groupe introuvable." };
  }
  if (eleves.length === 0) {
    return { etat: "erreur", message: "Sélectionnez au moins un élève." };
  }

  const ajoutes = await groupeAjouterEleves(acteur, groupe, eleves);
  if (ajoutes === null) {
    return { etat: "erreur", message: "L'ajout a été refusé. Vérifiez que ces élèves appartiennent à votre établissement." };
  }

  revalidatePath(`/admin/groupes/${groupe}`);
  revalidatePath("/admin/groupes");
  const dejaLa = eleves.length - ajoutes;
  const message =
    ajoutes === 0
      ? "Ces élèves font déjà partie du groupe."
      : `${ajoutes} élève${ajoutes > 1 ? "s" : ""} ajouté${ajoutes > 1 ? "s" : ""}${dejaLa > 0 ? `, ${dejaLa} déjà présent${dejaLa > 1 ? "s" : ""}` : ""}.`;
  return { etat: "ok", message };
}

export async function retirerUnEleve(donnees: FormData): Promise<void> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const eleve = identifiant(donnees, "eleve");
  if (groupe === null || eleve === null) return;
  await groupeRetirerEleve(acteur, groupe, eleve);
  revalidatePath(`/admin/groupes/${groupe}`);
  revalidatePath("/admin/groupes");
}

export async function affecterUnProfesseurAuGroupe(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const professeur = identifiant(donnees, "professeur");
  const matiere = identifiant(donnees, "matiere");

  if (groupe === null || professeur === null || matiere === null) {
    return { etat: "erreur", message: "Choisissez un professeur et une matière." };
  }

  const annee = await anneeCourante(acteur);
  if (annee === null) {
    return { etat: "erreur", message: "L'année scolaire n'a pas pu être préparée." };
  }

  const espace = await affecterProfesseurGroupe(acteur, professeur, groupe, matiere, annee);
  if (espace === null) {
    return { etat: "erreur", message: "L'affectation a été refusée. Vérifiez que le professeur et la matière sont de votre établissement." };
  }

  revalidatePath(`/admin/groupes/${groupe}`);
  return { etat: "ok", message: "Professeur affecté au groupe." };
}

/**
 * Élèves à proposer pour un groupe : recherche en base (accents et majuscules
 * ignorés), au plus 50 résultats, sans les membres actuels. Le sélecteur ne
 * charge donc jamais tout l'établissement (cahier des charges GR-03).
 */
export async function chercherElevesPourGroupe(
  groupe: string,
  texte: string,
  classe: string,
): Promise<{ eleves: { profile_id: string; prenom: string; nom: string; classe: string | null }[]; plus: boolean } | null> {
  const acteur = await exigerAdministrateur();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupe)) return null;
  const [page, dansLeGroupe] = await Promise.all([
    rechercherMembres(acteur, { role: "eleve", texte: texte.slice(0, 80), classe: classe.slice(0, 80), limite: 80 }),
    groupeMembres(acteur, groupe),
  ]);
  if (page === null) return null;
  const membres = new Set(dansLeGroupe.map((m) => m.profile_id));
  const eleves = page.lignes
    .filter((m) => !membres.has(m.profile_id))
    .slice(0, 50)
    .map((m) => ({ profile_id: m.profile_id, prenom: m.prenom, nom: m.nom, classe: m.classe }));
  // « plus » : la recherche a d'autres résultats que ceux montrés — on invite
  // à l'affiner plutôt que d'annoncer un chiffre approximatif.
  return { eleves, plus: page.total > page.lignes.length || page.lignes.length - eleves.length > 0 && eleves.length === 50 };
}

/**
 * Retirer plusieurs élèves d'un groupe (GR-05). Chaque retrait clôt
 * l'appartenance à la date du jour : les droits futurs s'arrêtent, l'historique
 * reste. Le compte rendu dit combien ont été retirés, et combien refusés.
 */
export async function retirerPlusieursEleves(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  const eleves = identifiants(donnees, "eleve");
  if (groupe === null) return { etat: "erreur", message: "Groupe introuvable." };
  if (eleves.length === 0) return { etat: "erreur", message: "Cochez au moins un élève." };
  if (eleves.length > 200) return { etat: "erreur", message: "Retirez au plus 200 élèves à la fois." };
  let retires = 0;
  for (const eleve of eleves) if (await groupeRetirerEleve(acteur, groupe, eleve)) retires++;
  revalidatePath(`/admin/groupes/${groupe}`);
  revalidatePath("/admin/groupes");
  const refuses = eleves.length - retires;
  return {
    etat: refuses === 0 ? "ok" : "erreur",
    message: `${retires} élève${retires > 1 ? "s" : ""} retiré${retires > 1 ? "s" : ""} du groupe${refuses > 0 ? `, ${refuses} refusé${refuses > 1 ? "s" : ""}` : ""}. Rien n'est effacé : l'historique reste.`,
  };
}

/** Description facultative d'un groupe (GR-02). */
export async function decrireUnGroupe(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  if (groupe === null) return { etat: "erreur", message: "Groupe introuvable." };
  const description = texte(donnees, "description", 500);
  if (!(await groupeDecrire(acteur, groupe, description))) return { etat: "erreur", message: "La description n'a pas pu être enregistrée." };
  revalidatePath(`/admin/groupes/${groupe}`);
  return { etat: "ok", message: description === "" ? "Description retirée." : "Description enregistrée." };
}

/** Coordinateur d'un groupe (GR-12) : un professeur, sans droit d'administration. */
export async function choisirCoordinateur(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const groupe = identifiant(donnees, "groupe");
  if (groupe === null) return { etat: "erreur", message: "Groupe introuvable." };
  const brut = texte(donnees, "professeur", 64);
  const professeur = brut === "" ? null : identifiant(donnees, "professeur");
  if (brut !== "" && professeur === null) return { etat: "erreur", message: "Professeur introuvable." };
  if (!(await designerCoordinateur(acteur, groupe, professeur))) return { etat: "erreur", message: "Refusé : la personne doit être professeur de l'établissement." };
  revalidatePath(`/admin/groupes/${groupe}`);
  return { etat: "ok", message: professeur === null ? "Coordinateur retiré." : "Coordinateur désigné." };
}

/**
 * Deux demi-groupes équilibrés pour une classe (GR-16) : répartition par
 * nombre seulement, dans l'ordre alphabétique, en alternance — aucune autre
 * donnée d'élève n'intervient. Les groupes sont créés vides puis remplis ;
 * rejouer retrouve les mêmes groupes (code unique) sans doublon d'élève.
 */
export async function creerDemiGroupes(_precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> {
  const acteur = await exigerAdministrateur();
  const classe = identifiant(donnees, "classe");
  if (classe === null) return { etat: "erreur", message: "Classe introuvable." };
  const situation = await contexte(acteur);
  const annee = situation?.academicYearId ?? null;
  const fiche = await ficheClasse(acteur, classe);
  if (fiche === null || annee === null || fiche.classe.archivee) return { etat: "erreur", message: "Classe introuvable ou archivée." };
  if (fiche.eleves.length < 2) return { etat: "erreur", message: "Il faut au moins deux élèves." };

  const tries = [...fiche.eleves].sort((x, y) => `${x.nom} ${x.prenom}`.localeCompare(`${y.nom} ${y.prenom}`, "fr"));
  const moities = [tries.filter((_, i) => i % 2 === 0), tries.filter((_, i) => i % 2 === 1)];
  const noms = [`${fiche.classe.label} — Groupe A`, `${fiche.classe.label} — Groupe B`];
  for (const [i, nom] of noms.entries()) {
    const groupe = await creerGroupe(acteur, annee, nom, "sous_groupe");
    if (groupe === null) return { etat: "erreur", message: `Le groupe « ${nom} » n'a pas pu être créé.` };
    await groupeAjouterEleves(acteur, groupe, moities[i]!.map((e) => e.id));
  }
  revalidatePath("/admin/groupes");
  revalidatePath(`/admin/classes/${classe}`);
  return { etat: "ok", message: `Deux demi-groupes créés : ${moities[0]!.length} et ${moities[1]!.length} élèves.` };
}


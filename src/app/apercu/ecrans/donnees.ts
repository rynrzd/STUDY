import type { Signalement } from "@/lib/moderation";

/**
 * Données fictives des écrans recomposés (R2). Aucun nom réel, aucune donnée
 * lue en base. Servies uniquement par /apercu, introuvable en production
 * (`apercu/layout.tsx`). Les identifiants sont des UUID de forme valide qui
 * ne correspondent à rien.
 */

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLASSE = "00000000-0000-4000-8000-0000000000c1";

export const F = {
  classe: CLASSE,
  fiches: [
    { id: u(101), titre: "L'essentiel — Fonctions de référence", format: "essentiel", etat: "ready", majLe: "2026-10-06T16:00:00Z" },
    { id: u(102), titre: "Cartes mémoire — Le XIXe siècle", format: "cartes", etat: "processing", majLe: "2026-10-07T09:30:00Z" },
    { id: u(103), titre: "Préparer le contrôle de SVT", format: "controle", etat: "needs_review", majLe: "2026-10-05T18:10:00Z" },
  ],
  suggestions: [
    { notionId: u(111), notion: "Images et antécédents", cours: "Mathématiques", statut: "a_revoir", score: 0.8, explication: "contrôle annoncé jeudi", prochaine: null, versions: [u(112), u(113)] },
    { notionId: u(114), notion: "Présent perfect", cours: "Anglais", statut: "en_cours", score: 0.5, explication: "deux réponses récentes à revoir", prochaine: null, versions: [u(115)] },
  ],
  erreurs: [
    {
      id: u(121), notion_id: u(111), notion: "Images et antécédents", enonce: "Quelle est l'image de 3 par f(x) = 2x + 1 ?", kind: "numerique", choix: null,
      reponse: { valeur: "5" }, explication: "On remplace x par 3 : 2 × 3 + 1 = 7.", categorie: "calcul", note: "", revision: 1,
      created_at: "2026-10-05T15:00:00Z", version_id: u(112), archived_at: null,
    },
    {
      id: u(122), notion_id: u(114), notion: "Présent perfect", enonce: "Choisis la bonne forme : « She ___ already finished. »", kind: "qcm", choix: ["has", "have", "is"],
      reponse: { index: 1 }, explication: "« She » est à la troisième personne : has.", categorie: "", note: "", revision: 1,
      created_at: "2026-10-06T10:00:00Z", version_id: u(115), archived_at: null,
    },
  ],
  consultation: { id: u(131), titre: "Organisation des révisions avant les vacances", etat: "ouverte", ouvreLe: "2026-10-01T08:00:00Z", fermeLe: "2026-10-15T18:00:00Z", version: 1 },
  decisions: [
    { id: u(141), titre: "Salle d'étude ouverte le mercredi", explication: "Demandée par la classe en septembre.", statut: "en_cours", motif: null, responsable: "M. Exemple", suiviLe: "2026-10-20", publiee: true, version: 1, majLe: "2026-10-03T12:00:00Z" },
    { id: u(142), titre: "Calendrier commun des contrôles", explication: null, statut: "faite", motif: null, responsable: null, suiviLe: null, publiee: true, version: 1, majLe: "2026-09-28T12:00:00Z" },
  ],
  membres: [
    { profileId: u(151), affichage: "Inès E.", initiales: "IE", role: "delegue" as const, etatCompte: null },
    { profileId: u(152), affichage: "Hugo E.", initiales: "HE", role: "delegue" as const, etatCompte: null },
    { profileId: u(153), affichage: "Mme Exemple", initiales: "ME", role: "professeur_principal" as const, etatCompte: null },
  ],
  droitsEleve: { membre: true, eleve: true, delegue: false, enseignant: false, principal: false, responsable: false },
  entraide: [{ id: u(161), titre: "Révision commune : fonctions", debut: "2026-10-09T15:00:00Z", capacite: 8, inscrits: 3, etat: "ouverte", classId: CLASSE }],
  salons: [
    { id: u(171), kind: "general" as const, label: "Général", mode: "discussion" as const, classId: CLASSE, teachingSpaceId: null, projectId: null, classe: "Seconde 2", dernierMessage: "2026-10-07T17:40:00Z", nonLus: 3 },
    { id: u(172), kind: "matiere" as const, label: "Mathématiques", mode: "questions" as const, classId: CLASSE, teachingSpaceId: u(173), projectId: null, classe: "Seconde 2", dernierMessage: "2026-10-07T11:00:00Z", nonLus: 0 },
    { id: u(174), kind: "matiere" as const, label: "Annonces — Histoire-géographie", mode: "annonces" as const, classId: CLASSE, teachingSpaceId: u(175), projectId: null, classe: "Seconde 2", dernierMessage: "2026-10-06T08:00:00Z", nonLus: 1 },
    { id: u(176), kind: "projet" as const, label: "Exposé : villes durables", mode: "discussion" as const, classId: null, teachingSpaceId: null, projectId: u(181), classe: null, dernierMessage: "2026-10-05T19:00:00Z", nonLus: 0 },
  ],
  projets: [
    { id: u(181), titre: "Exposé : villes durables", description: "Préparer un exposé en groupe.", visibilite: "groupe", updated_at: "2026-10-07T10:00:00Z" },
    { id: u(182), titre: "Dossier : réaction chimique", description: "Rédiger le compte rendu.", visibilite: "groupe", updated_at: "2026-10-04T10:00:00Z" },
    { id: u(183), titre: "Lectures personnelles", description: null, visibilite: "prive", updated_at: "2026-09-30T10:00:00Z" },
  ],
  evenements: [
    { id: u(191), kind: "controle", titre: "Contrôle : fonctions", debut: "2026-10-08T08:00:00Z", fin: null, lien: null, personnel: false, contexte: "Mathématiques · salle B203", modifiable: false },
    { id: u(192), kind: "rendu", titre: "Schéma d'urbanisation", debut: "2026-10-09T16:00:00Z", fin: null, lien: null, personnel: false, contexte: "Histoire-géographie", modifiable: false },
    { id: u(193), kind: "creneau", titre: "Réviser l'anglais", debut: "2026-10-06T16:30:00Z", fin: null, lien: null, personnel: true, contexte: null, modifiable: true },
  ],
  pistes: [
    { id: u(201), owner_id: u(1), kind: "intention", intitule: "Travailler dans l'environnement", organisation: null, statut: "a_explorer", contact_pro: null, echeance: null, notes: null, version: 1 },
    { id: u(202), owner_id: u(1), kind: "piste", intitule: "Spécialité SVT en première", organisation: "Lycée fictif", statut: "a_contacter", contact_pro: null, echeance: "2026-11-15", notes: "Demander au professeur principal.", version: 1 },
    { id: u(203), owner_id: u(1), kind: "stage", intitule: "Stage d'observation", organisation: "Médiathèque fictive", statut: "contacte", contact_pro: null, echeance: "2026-12-01", notes: null, version: 1 },
  ],
  ateliers: [
    { id: u(211), titre: "Une même information, deux titres", kind: "actualite", etat: "publie", published_at: "2026-10-05T08:00:00Z", question: "Qu'est-ce qui change entre les deux articles ?" },
    { id: u(212), titre: "Vérifier une réponse sur la photosynthèse", kind: "verifier_ia", etat: "clos", published_at: "2026-09-28T08:00:00Z", question: "Quelles phrases sont exactes d'après le cours ?" },
  ],
  demandes: [
    { id: u(221), subject: "Question sur le devoir de mathématiques", state: "ouverte", created_at: "2026-10-06T18:00:00Z", author_id: u(1), recipient_id: u(153) },
    { id: u(222), subject: "Conseil pour l'orientation", state: "close", created_at: "2026-09-20T18:00:00Z", author_id: u(1), recipient_id: u(153) },
  ],
  destinataires: [{ id: u(153), nom: "Mme Exemple", qualite: "Professeure principale" }],
  cours: { id: u(231), matiere: "Mathématiques", classe: "Seconde 2", classId: CLASSE, enseignants: "Mme Exemple", seances: 4, chapitreCourant: "Chapitre 3", dernierePublication: "2026-10-06T08:00:00Z", enseigne: false },
  chapitres: [
    {
      id: u(241), libelle: "Chapitre 3 — Fonctions de référence",
      seances: [
        { id: u(242), titre: "Lire une image sur un graphique", objectif: "Lire une image et un antécédent", publieeLe: "2026-10-06T08:00:00Z", prevueLe: null, chapitreId: u(241) },
        { id: u(243), titre: "La fonction carré", objectif: null, publieeLe: "2026-10-02T08:00:00Z", prevueLe: null, chapitreId: u(241) },
      ],
    },
    { id: u(244), libelle: "Chapitre 2 — Vecteurs", seances: [{ id: u(245), titre: "Somme de deux vecteurs", objectif: "Construire une somme", publieeLe: "2026-09-25T08:00:00Z", prevueLe: null, chapitreId: u(244) }] },
  ],
  // Professeur
  tableau: {
    cartes: [
      { id: u(251), matiere: "Mathématiques", classe: "Seconde 2", questionsSansReponse: 2, salon: u(172) },
      { id: u(252), matiere: "Mathématiques", classe: "Première 3", questionsSansReponse: 0, salon: null },
    ],
    questionsEnAttente: 2,
    copiesAEvaluer: 5,
    reponsesAteliers: 3,
    erreur: false,
  },
  seancesProf: [
    { id: u(261), title: "Lire une image sur un graphique", state: "publiee", scheduled_for: "2026-10-08", teaching_space_id: u(251) },
    { id: u(262), title: "La fonction inverse", state: "brouillon", scheduled_for: "2026-10-13", teaching_space_id: u(251) },
    { id: u(263), title: "Suites arithmétiques", state: "brouillon", scheduled_for: null, teaching_space_id: u(252) },
  ],
  devoirsProf: [{ id: u(271), title: "Exercices 12 à 15", due_at: "2026-10-12T20:00:00Z", state: "publiee", lesson_id: u(261), teaching_space_id: u(251) }],
  coursProf: [
    { id: u(251), matiere: "Mathématiques", classe: "Seconde 2", groupe: null, libelle: "Mathématiques — Seconde 2" },
    { id: u(252), matiere: "Mathématiques", classe: "Première 3", groupe: null, libelle: "Mathématiques — Première 3" },
  ],
  chapitresProf: [
    { id: u(281), label: "Chapitre 3 — Fonctions de référence", position: 1 },
    { id: u(282), label: "Chapitre 4 — Statistiques", position: 2 },
  ],
  seancesCours: [
    { id: u(261), title: "Lire une image sur un graphique", objective: null, state: "publiee" as const, chapter_id: u(281), teaching_space_id: u(251), scheduled_for: "2026-10-08", published_at: "2026-10-06T08:00:00Z", updated_at: "2026-10-06T08:00:00Z" },
    { id: u(262), title: "La fonction inverse", objective: null, state: "brouillon" as const, chapter_id: u(281), teaching_space_id: u(251), scheduled_for: "2026-10-13", published_at: null, updated_at: "2026-10-07T08:00:00Z" },
  ],
  documents: [
    { id: u(291), titre: "Cours — Fonctions de référence.pdf", etat: "pret" as const, erreur: null, revisionId: u(292), majLe: "2026-10-06T08:00:00Z" },
    { id: u(293), titre: "Fiche méthode — Vecteurs.docx", etat: "a_verifier" as const, erreur: null, revisionId: u(294), majLe: "2026-10-07T08:00:00Z" },
  ],
  exercices: [
    { exercice: u(301), version: u(302), numero: 2, kind: "qcm" as const, enonce: "Quelle est l'image de 2 par la fonction carré ?", choix: ["2", "4", "8"], difficulte: 1 as const, publie: true, matiere: "Mathématiques", cours: "Mathématiques — Seconde 2", seance: "La fonction carré", notion: "Fonction carré", creeLe: "2026-10-01T08:00:00Z", moi: true },
    { exercice: u(303), version: u(304), numero: 1, kind: "numerique" as const, enonce: "Calcule f(3) pour f(x) = 2x + 1.", choix: null, difficulte: 2 as const, publie: false, matiere: "Mathématiques", cours: "Mathématiques — Seconde 2", seance: "Lire une image", notion: "Images", creeLe: "2026-10-02T08:00:00Z", moi: true },
  ],
  ateliersProf: [
    { id: u(311), kind: "actualite", titre: "Une même information, deux titres", etat: "publie" },
    { id: u(312), kind: "verifier_ia", titre: "Vérifier une réponse sur la photosynthèse", etat: "brouillon" },
  ],
  // Administration
  situation: { organizationId: u(2), organisation: "Lycée fictif", publicCode: "FICTIF1", etat: "actif", academicYearId: u(321), anneeLabel: "2026-2027" },
  classesEtab: [
    { id: CLASSE, label: "Seconde 2", class_code: "2-2", effectif: 31 },
    { id: u(331), label: "Première 3", class_code: "1-3", effectif: 28 },
    { id: u(332), label: "Terminale 1", class_code: "T-1", effectif: 30 },
  ],
  membresEtab: [
    { profile_id: u(341), prenom: "Inès", nom: "Exemple", local_login: "ines.exemple", roles: ["eleve"], account_state: "actif", classe: "Seconde 2" },
    { profile_id: u(342), prenom: "Hugo", nom: "Fictif", local_login: "hugo.fictif", roles: ["eleve"], account_state: "a_activer", classe: "Seconde 2" },
    { profile_id: u(343), prenom: "Claire", nom: "Exemple", local_login: "claire.exemple", roles: ["professeur"], account_state: "actif", classe: null },
    { profile_id: u(344), prenom: "Marc", nom: "Fictif", local_login: "marc.fictif", roles: ["professeur"], account_state: "a_activer", classe: null },
  ],
  matieresEtab: [
    { id: u(381), label: "Mathématiques" },
    { id: u(382), label: "Histoire-géographie" },
  ],
  groupesEtab: [
    { id: u(395), label: "Spé Maths A", kind: "interclasses", academic_year_id: u(321), annee: "2026-2027", effectif: 2, cours: 1 },
    { id: u(396), label: "2nde 2 — TP A", kind: "sous_groupe", academic_year_id: u(321), annee: "2026-2027", effectif: 1, cours: 0 },
  ],
  membresGroupe: [
    { profile_id: u(341), prenom: "Inès", nom: "Exemple", classe: "Seconde 2" },
    { profile_id: u(342), prenom: "Hugo", nom: "Fictif", classe: "Première 3" },
  ],
  coursGroupe: [
    { teaching_space_id: u(397), matiere: "Mathématiques", professeur_id: u(343), prenom: "Claire", nom: "Exemple" },
  ],
  affectationsEtab: [
    { teaching_space_id: u(391), class_id: CLASSE, classe: "Seconde 2", matiere: "Mathématiques", professeur_id: u(343), prenom: "Claire", nom: "Exemple" },
    { teaching_space_id: u(392), class_id: u(331), classe: "Première 3", matiere: "Mathématiques", professeur_id: u(343), prenom: "Claire", nom: "Exemple" },
    { teaching_space_id: u(393), class_id: CLASSE, classe: "Seconde 2", matiere: "Histoire-géographie", professeur_id: null, prenom: null, nom: null },
  ],
  imports: [{ id: u(351), kind: "eleves", state: "applique", created_at: "2026-09-01T08:00:00Z", applied_at: "2026-09-01T09:00:00Z", rapport: { cree: 89, existant: 0, erreur: 0 } }],
  recuperations: [
    { id: u(361), prenom: "Hugo", nom: "Fictif", identifiant: "hugo.fictif", classe: "Seconde 2", demandee_le: "2026-10-07T07:50:00Z", reference: "AB12-CD34", compte: "actif" },
    { id: u(362), prenom: "Léa", nom: "Exemple", identifiant: "lea.exemple", classe: "Première 3", demandee_le: "2026-10-05T12:00:00Z", reference: null, compte: "a_activer" },
  ],
  signalements: [
    {
      id: u(371), raison: "contenu_inapproprie", detail: null, etat: "ouvert", signaleLe: "2026-10-07T12:00:00Z", contenu: "Message fictif signalé pour l'aperçu.",
      cible: "message", masque: false, signalements: 2, auteurContenu: "Élève fictif", signalePar: "Autre élève fictif", cours: "Mathématiques — Seconde 2",
    },
    {
      id: u(372), raison: "hors_sujet", detail: "Publicité", etat: "en_examen", signaleLe: "2026-10-06T12:00:00Z", contenu: "Autre message fictif.",
      cible: "reponse", masque: true, signalements: 1, auteurContenu: "Élève fictif", signalePar: "Élève fictif 2", cours: "Anglais — Seconde 2",
    },
  ] satisfies Signalement[],
  annees: [
    { id: u(321), label: "2026-2027", starts_on: "2026-09-01", ends_on: "2027-07-05", is_current: true, archived_at: null },
    { id: u(322), label: "2027-2028", starts_on: "2027-09-01", ends_on: "2028-07-05", is_current: false, archived_at: null },
  ],
} as const;

export const NOMS_FICTIFS = new Map([[u(153), { affichage: "Mme Exemple", initiales: "ME", adulte: true }]]);

/** D11 — relevé d'une année archivée (0075). */
export const ANNEE_ARCHIVEE = {
  annee: { id: "y-2025", label: "2025-2026", debut: "2025-09-01", fin: "2026-07-04", archivee_le: "2026-08-28T09:00:00Z" },
  classes: [
    { id: "c-2a", label: "Seconde 1", effectif: 31, professeur_principal: "Claire Exemple" },
    { id: "c-2b", label: "Seconde 2", effectif: 29, professeur_principal: null },
    { id: "c-1a", label: "Première 3", effectif: 33, professeur_principal: "Marc Fictif" },
  ],
  groupes: [{ id: "g-spe", label: "Spé Maths A", kind: "interclasses", effectif: 24 }],
  cours: [
    { matiere: "Mathématiques", cible: "Seconde 1", genre: "classe", professeurs: "Claire Exemple", seances_publiees: 42, devoirs: 11 },
    { matiere: "Histoire-géographie", cible: "Seconde 1", genre: "classe", professeurs: "Marc Fictif, Léa Remplace (remplacant)", seances_publiees: 30, devoirs: 6 },
    { matiere: "Mathématiques", cible: "Spé Maths A", genre: "groupe", professeurs: "Claire Exemple", seances_publiees: 38, devoirs: 9 },
  ],
} as const satisfies import("@/lib/etablissement").AnneeArchivee;

/** T09, T10 — archives du professeur (0076). */
export const ARCHIVES_PROF = [
  { espace: "a-1", annee: "2025-2026", matiere: "Mathématiques", cible: "Seconde 1", genre: "classe", seances: 34, devoirs: 9, archive_le: "2026-08-28T09:00:00Z" },
  { espace: "a-2", annee: "2025-2026", matiere: "Mathématiques", cible: "Spé Maths A", genre: "groupe", seances: 28, devoirs: 7, archive_le: "2026-08-28T09:00:00Z" },
  { espace: "a-3", annee: "2024-2025", matiere: "Mathématiques", cible: "Première 3", genre: "classe", seances: 31, devoirs: 8, archive_le: "2025-08-29T09:00:00Z" },
] as const satisfies readonly import("@/lib/archives-professeur").CoursArchive[];

const seanceArchivee = (id: string, title: string, chapter_id: string | null, quand: string) => ({
  id, title, objective: null, state: "publiee" as const, chapter_id, teaching_space_id: "a-1", scheduled_for: quand, published_at: quand, updated_at: quand,
});
export const ARCHIVE_COURS = {
  cours: { id: "a-1", matiere: "Mathématiques", cible: "Seconde 1", annee: "2025-2026", archive_le: "2026-08-28T09:00:00Z" },
  chapitres: [{ id: "ch-1", label: "Chapitre 1 — Fonctions de référence" }, { id: "ch-2", label: "Chapitre 2 — Statistiques" }],
  seances: [
    seanceArchivee("s-1", "Lire une image sur un graphique", "ch-1", "2025-09-12T08:00:00Z"),
    seanceArchivee("s-2", "La fonction carré", "ch-1", "2025-09-19T08:00:00Z"),
    seanceArchivee("s-3", "Moyenne et médiane", "ch-2", "2025-11-07T08:00:00Z"),
  ],
  devoirs: [{ id: "d-1", title: "Exercices 12 à 15", due_at: "2025-09-26T16:00:00Z", remises: 29 }],
} satisfies import("@/lib/archives-professeur").ArchiveCours;

/** D01 — contrôle avant ouverture (0077). */
export const CONTROLE = {
  eleves_sans_classe: { n: 2, exemples: [{ id: "e1", nom: "Noah Bernard" }, { id: "e2", nom: "Inès Petit" }] },
  professeurs_sans_cours: { n: 1, exemples: [{ id: "p1", nom: "Marc Fictif" }] },
  cours_sans_professeur: { n: 1, exemples: [{ id: "c1", nom: "Histoire-géographie · Seconde 2" }] },
  classes_sans_pp: { n: 2, exemples: [{ id: "k1", nom: "Première 3" }, { id: "k2", nom: "Terminale 1" }] },
  groupes_vides: { n: 0, exemples: [] },
  matieres_non_enseignees: { n: 1, exemples: [{ id: "m1", nom: "SES" }] },
} satisfies import("@/lib/etablissement").ControleOuverture;

/** D12 — fiche classe (0077). */
export const FICHE_CLASSE = {
  classe: { id: "00000000-0000-4000-8000-0000000000c1", label: "Seconde 2", annee: "2026-2027", archivee: false },
  professeur_principal: { id: "pp", nom: "Claire Exemple" },
  eleves: [
    { id: "e1", prenom: "Lina", nom: "Martin", identifiant: "lina.martin", etat_compte: "actif", depuis: "2026-09-01" },
    { id: "e2", prenom: "Noah", nom: "Bernard", identifiant: "noah.bernard", etat_compte: "a_activer", depuis: "2026-09-01" },
    { id: "e3", prenom: "Camille", nom: "Exemple", identifiant: "camille.exemple", etat_compte: "actif", depuis: "2026-09-01" },
  ],
  cours: [
    { espace: "s1", matiere: "Mathématiques", professeurs: "Claire Exemple" },
    { espace: "s2", matiere: "Histoire-géographie", professeurs: null },
  ],
  groupes: [{ id: "g1", label: "Spé Maths A", kind: "interclasses", eleves_de_la_classe: 2 }],
} satisfies import("@/lib/etablissement").FicheClasse;

/** D13 — qui enseigne quoi (0078). */
const ens = (espace: string, genre: "classe" | "groupe", cible: string, cible_label: string, matiere: string, matiere_label: string, intervenants: { nom: string; role: string }[]) => ({ espace, genre, cible, cible_label, matiere, matiere_label, intervenants });
export const MATRICE = [
  ens("s1", "classe", "c1", "Seconde 1", "m1", "Mathématiques", [{ nom: "Claire Exemple", role: "titulaire" }]),
  ens("s2", "classe", "c1", "Seconde 1", "m2", "Histoire-géographie", [{ nom: "Marc Fictif", role: "titulaire" }]),
  ens("s3", "classe", "c1", "Seconde 1", "m3", "Anglais", []),
  ens("s4", "classe", "c2", "Seconde 2", "m1", "Mathématiques", [{ nom: "Claire Exemple", role: "titulaire" }, { nom: "Léa Remplace", role: "remplacant" }]),
  ens("s5", "classe", "c2", "Seconde 2", "m2", "Histoire-géographie", [{ nom: "Marc Fictif", role: "titulaire" }]),
  ens("s6", "classe", "c3", "Première 3", "m1", "Mathématiques", [{ nom: "Claire Exemple", role: "titulaire" }]),
  ens("s7", "groupe", "g1", "Spé Maths A", "m1", "Mathématiques", [{ nom: "Claire Exemple", role: "titulaire" }, { nom: "Paul Aide", role: "co_intervenant" }]),
] satisfies import("@/lib/etablissement").Enseignement[];

/** A22 — une séance avec formules (EDIT-04). */
export const SEANCE_FORMULES = {
  seance: { id: "s-f", title: "Le second degré", objective: "Résoudre une équation du second degré.", state: "publiee" as const, chapter_id: null, teaching_space_id: "c", scheduled_for: "2026-10-12T08:00:00Z", published_at: "2026-10-12T08:00:00Z", updated_at: "2026-10-12T08:00:00Z" },
  blocs: [
    { id: "b1", kind: "texte" as const, position: 1, contenu: { texte: "Une équation du second degré s'écrit $ax^2 + bx + c = 0$ avec $a \\neq 0$. Son discriminant vaut :" }, file_id: null, assignment_id: null },
    { id: "b2", kind: "texte" as const, position: 2, contenu: { texte: "$$\\Delta = b^2 - 4ac$$" }, file_id: null, assignment_id: null },
    { id: "b3", kind: "texte" as const, position: 3, contenu: { texte: "Si $\\Delta > 0$, deux solutions : $$x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$ Le manuel coûte 5 $ : ce n'est pas une formule." }, file_id: null, assignment_id: null },
    { id: "b4", kind: "exercice" as const, position: 4, contenu: { consigne: "Résoudre $2x^2 - 3x + 1 = 0$." }, file_id: null, assignment_id: null },
    { id: "b5", kind: "texte" as const, position: 5, contenu: { texte: "## Méthode\n1. Calculer $\\Delta$.\n2. Comparer $\\Delta$ à 0.\n3. Conclure.\n> À retenir : si $\\Delta < 0$, aucune solution réelle.\n| $\\Delta$ | Solutions |\n|---|---|\n| $> 0$ | deux |\n| $= 0$ | une |\n| $< 0$ | aucune |" }, file_id: null, assignment_id: null },
  ],
};

/** D14 — fiche professeur (0080). */
export const FICHE_PROF = {
  identite: { prenom: "Claire", nom: "Exemple", identifiant: "claire.exemple", etat_compte: "actif", actif: true, roles: ["professeur"], courriel: null },
  affectations: [
    { id: "a1", espace: "s1", matiere: "Mathématiques", cible: "Seconde 2", genre: "classe" as const, cible_id: "c2", annee: "2026-2027", role: "titulaire", debut: "2026-09-01", fin: null, etat: "en_cours" as const },
    { id: "a2", espace: "s2", matiere: "Mathématiques", cible: "Spé Maths A", genre: "groupe" as const, cible_id: "g1", annee: "2026-2027", role: "co_intervenant", debut: "2026-09-01", fin: null, etat: "en_cours" as const },
    { id: "a3", espace: "s3", matiere: "Mathématiques", cible: "Première 3", genre: "classe" as const, cible_id: "c3", annee: "2026-2027", role: "remplacant", debut: "2026-11-03", fin: "2026-11-17", etat: "a_venir" as const },
    { id: "a4", espace: "s4", matiere: "Mathématiques", cible: "Seconde 1", genre: "classe" as const, cible_id: "c1", annee: "2025-2026", role: "titulaire", debut: "2025-09-01", fin: null, etat: "archive" as const },
  ],
  principal_de: [{ id: "c2", label: "Seconde 2" }],
} satisfies import("@/lib/etablissement").FicheProfesseur;

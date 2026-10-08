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

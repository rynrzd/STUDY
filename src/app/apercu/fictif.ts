import type { DonneesAccueil } from "@/components/study/accueil/AccueilEleve";
import type { ContexteApp } from "@/lib/v6/contexte";

/**
 * Données fictives des aperçus de développement. Aucun nom réel, aucune
 * donnée lue en base ; ces valeurs ne sont jamais servies en production
 * (`apercu/layout.tsx`).
 */

export const CONTEXTE_FICTIF: ContexteApp = {
  personne: {
    profileId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    prenom: "Camille",
    nom: "Exemple",
    organisation: "Lycée fictif",
    roles: ["eleve"],
    portee: "etablissement",
    niveauAssurance: "aal1",
    activationRequise: false,
    appareil: "partage",
    empreinte: Buffer.alloc(32),
  },
  jeton: "apercu",
  contextes: [
    { classe: "00000000-0000-4000-8000-0000000000c1", libelle: "Seconde 2", annee: "2026-2027", role: "eleve" },
    { classe: "00000000-0000-4000-8000-0000000000c2", libelle: "Groupe Anglais B", annee: "2026-2027", role: "eleve" },
  ],
  classeActive: { classe: "00000000-0000-4000-8000-0000000000c1", libelle: "Seconde 2", annee: "2026-2027", role: "eleve" },
  roles: { eleve: true, professeur: false, admin: false, exploitant: false },
  nonLus: { notifications: 2, messages: 3 },
  copiesLocales: false,
  chemin: "/app",
};

export const ACCUEIL_FICTIF: DonneesAccueil = {
  prenom: "Camille",
  salut: "Bonjour",
  dateLibelle: "mardi 6 octobre",
  premiereVisite: false,
  reprise: {
    id: "00000000-0000-4000-8000-0000000000a1",
    titre: "Les fonctions de référence",
    objectif: "lire une image et un antécédent sur un graphique",
    contexte: "Mathématiques · Chapitre 3",
    dejaLue: true,
  },
  taches: [
    { id: "00000000-0000-4000-8000-0000000000d1", titre: "Revoir les images et antécédents", matiere: "Mathématiques", echeance: "Pour demain" },
    { id: "00000000-0000-4000-8000-0000000000d2", titre: "Terminer le schéma d'urbanisation", matiere: "Histoire-géographie", echeance: "Pour jeudi" },
  ],
  cours: [
    { id: "00000000-0000-4000-8000-0000000000e1", matiere: "Mathématiques", libelle: "Seconde 2" },
    { id: "00000000-0000-4000-8000-0000000000e2", matiere: "Français", libelle: "Seconde 2" },
    { id: "00000000-0000-4000-8000-0000000000e3", matiere: "Histoire-géographie", libelle: "Seconde 2" },
  ],
  enDirect: {
    titre: "Mme Laurent a répondu à ta question",
    sujet: "Pour lire une image, pars de l'axe horizontal…",
    lien: "/app/messagerie",
    quand: "6 oct., 08:42",
  },
  consultation: { titre: "Consultation de classe d'octobre", lien: "/app/classe", fermeLe: "2026-10-16T18:00:00Z" },
  ensemble: { titre: "Les fonctions", lien: "/app/classe", debut: "mardi 6 à 18:00", inscrits: 8, capacite: 12 },
  semaine: [
    { cle: "a", jour: "jeu. 8", titre: "Contrôle de mathématiques", genre: "Contrôle · Seconde 2" },
    { cle: "b", jour: "ven. 9", titre: "Exposé d'histoire", genre: "À rendre" },
  ],
  suggestion: null,
};

/**
 * Système de mouvement partagé — brief « Direction visuelle, animations et 3D », §5.
 *
 * Source unique des durées et des courbes. Le CSS les reçoit sous forme de
 * variables posées sur <html> (voir `variablesMouvement`) ; les composants
 * clients les lisent ici. Aucune durée n'est écrite en dur ailleurs pour un
 * mouvement d'interface.
 *
 * Règles : on anime `transform` et `opacity` ; aucune courbe à rebond ; une
 * transition interrompue repart de l'état courant (transitions CSS, pas de
 * file d'attente d'animations).
 */

export const DUREES = {
  /** Retour d'un bouton pressé. */
  bouton: 120,
  /** Ouverture d'un menu. */
  menu: 170,
  /** Changement de panneau (fil, onglet). */
  panneau: 200,
  /** Entrée d'une section. */
  section: 260,
  /** Retournement d'une carte mémoire. */
  carte: 320,
  /** Animation ponctuelle de fin de séance (toujours < 1 s). */
  fin: 720,
} as const;

export const COURBES = {
  /** Entrée : décélération douce. */
  entree: "cubic-bezier(0.16, 0.84, 0.44, 1)",
  /** Sortie : courte. */
  sortie: "cubic-bezier(0.4, 0, 1, 1)",
  /** Déplacement : courbe équilibrée. */
  deplacement: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** Amplitudes maximales, en pixels. */
export const AMPLITUDES = {
  section: 12,
  message: 4,
  survol: 2,
} as const;

/** Préférence de la personne, enregistrée sur l'appareil. */
export type PreferenceEffets = "auto" | "reduits" | "desactives";

export const COOKIE_EFFETS = "study_effets";

export function lirePreference(valeur: string | null | undefined): PreferenceEffets {
  return valeur === "reduits" || valeur === "desactives" ? valeur : "auto";
}

/** Variables CSS posées sur <html> : le CSS n'a pas d'autre source. */
export function variablesMouvement(): Record<string, string> {
  return {
    "--duree-bouton": `${DUREES.bouton}ms`,
    "--duree-menu": `${DUREES.menu}ms`,
    "--duree-panneau": `${DUREES.panneau}ms`,
    "--duree-section": `${DUREES.section}ms`,
    "--duree-carte": `${DUREES.carte}ms`,
    "--duree-fin": `${DUREES.fin}ms`,
    "--courbe-entree": COURBES.entree,
    "--courbe-sortie": COURBES.sortie,
    "--courbe-deplacement": COURBES.deplacement,
    "--amplitude-section": `${AMPLITUDES.section}px`,
    "--amplitude-message": `${AMPLITUDES.message}px`,
    "--amplitude-survol": `${AMPLITUDES.survol}px`,
  };
}

/**
 * Script de démarrage, exécuté avant le premier rendu : il pose
 * `data-effets` sur <html> à partir du cookie, pour qu'aucune animation
 * d'entrée ne joue chez une personne qui les a désactivées. Il ne lit rien
 * d'autre et n'écrit rien.
 */
export const SCRIPT_EFFETS = `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE_EFFETS}=(auto|reduits|desactives)/);document.documentElement.dataset.effets=m?m[1]:"auto";}catch(e){}})();`;

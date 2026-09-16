import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Un fichier « use server » ne peut exporter que des fonctions asynchrones.
 *
 * Ce test existe parce que la règle a été enfreinte, et que **rien** ne l'a
 * signalé : le typage passait, ESLint passait, le build passait. C'est à la
 * première soumission de formulaire, sur le site déployé, que Next a répondu
 * 500 avec « A "use server" file can only export async functions, found
 * object ». Tous les formulaires de l'application étaient cassés : connexion,
 * demande de devis, administration, activation, import.
 *
 * La cause : chaque fichier d'action exportait sa constante d'état initial,
 * pour que le composant client la réutilise. Next transforme chaque export
 * d'un fichier « use server » en point d'entrée appelable depuis le navigateur
 * — un objet n'en est pas un, et le module échoue à l'évaluation.
 *
 * Les états vivent désormais dans un module `etats.ts` voisin. Ce test relit
 * les fichiers pour que personne ne recommence.
 */

const RACINE = path.resolve(import.meta.dirname, "..", "..", "src");

/** Tous les fichiers de `src`, sans suivre les dossiers cachés. */
function fichiersSources(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree.startsWith(".")) continue;
    const chemin = path.join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiersSources(chemin));
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/** Fichiers dont la première instruction est « use server ». */
function fichiersAction(): { chemin: string; contenu: string }[] {
  return fichiersSources(RACINE)
    .map((chemin) => ({ chemin, contenu: readFileSync(chemin, "utf8") }))
    .filter(({ contenu }) => /^\s*["']use server["']\s*;/.test(contenu));
}

test("les fichiers « use server » existent et sont reconnus", () => {
  const fichiers = fichiersAction();
  assert.ok(
    fichiers.length >= 5,
    `au moins cinq fichiers d action attendus, ${fichiers.length} trouve(s) — ` +
      "si ce test se vide, c est qu il ne verifie plus rien",
  );
});

test("un fichier « use server » n exporte que des fonctions asynchrones", () => {
  const fautifs: string[] = [];

  for (const { chemin, contenu } of fichiersAction()) {
    const relatif = path.relative(RACINE, chemin);

    // Les exports de valeur : const, let, var, class, function synchrone.
    // `export type` et `export interface` sont effaces a la compilation : ils
    // n atteignent jamais l execution et ne posent donc aucun probleme.
    for (const ligne of contenu.split("\n")) {
      const valeur = /^export\s+(const|let|var|class)\s+(\w+)/.exec(ligne);
      if (valeur !== null) {
        fautifs.push(`${relatif} exporte « ${valeur[2]} » (${valeur[1]})`);
        continue;
      }

      const fonction = /^export\s+function\s+(\w+)/.exec(ligne);
      if (fonction !== null) {
        fautifs.push(`${relatif} exporte « ${fonction[1]} », fonction non asynchrone`);
        continue;
      }

      // `export default` d'autre chose qu'une fonction asynchrone.
      const defaut = /^export\s+default\s+(?!async\s)/.exec(ligne);
      if (defaut !== null) {
        fautifs.push(`${relatif} a un export par defaut qui n est pas une fonction asynchrone`);
      }
    }
  }

  assert.deepEqual(
    fautifs,
    [],
    "Next refuse ces exports a l execution : le build passe, et le premier envoi\n" +
      "de formulaire repond 500. Deplacer ces valeurs dans un module voisin\n" +
      "(« etats.ts ») que l action et le composant client importent tous deux.\n",
  );
});

test("chaque fichier d action a bien au moins une action exportee", () => {
  for (const { chemin, contenu } of fichiersAction()) {
    const relatif = path.relative(RACINE, chemin);
    assert.match(
      contenu,
      /^export\s+async\s+function\s+\w+/m,
      `${relatif} est marque « use server » mais n exporte aucune action`,
    );
  }
});

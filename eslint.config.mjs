import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Configuration ESLint — chapitre 40 : « lint » fait partie des commandes
 * livrees et doit retourner un resultat interpretable.
 *
 * eslint-config-next 16 exporte directement des configurations plates : on les
 * utilise telles quelles, sans couche de compatibilite.
 */
const configuration = [
  {
    ignores: [".next/**", "node_modules/**", "preuves/**", "supabase/**", "next-env.d.ts"],
  },
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
  ...(Array.isArray(nextTypescript) ? nextTypescript : [nextTypescript]),
  {
    rules: {
      // Un console.log oublie dans une route serveur peut journaliser une copie
      // ou un identifiant. Interdit, sauf warn/error qui sont intentionnels.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Un parametre prefixe d un souligne est volontairement inutilise : il
      // est la pour respecter une signature d interface, pas par oubli.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Les scripts et les tests parlent a l operateur : la console est leur
    // interface, pas un oubli.
    // instrumentation.ts est le journal de demarrage du serveur : sa sortie
    // console est son role, et elle n affiche que des etats, jamais de valeur.
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "tests/**/*.ts", "src/instrumentation.ts"],
    rules: { "no-console": "off" },
  },
];

export default configuration;

#!/usr/bin/env node
// =============================================================================
// Les requêtes que PostgREST doit savoir résoudre.
//
//   npm run verifier:requetes
//
// Pourquoi ce fichier existe. Les tests RLS tournent sur PGlite, c'est-à-dire
// sur PostgreSQL **sans PostgREST**. Ils prouvent que la base autorise ou
// refuse la bonne chose — ils ne voient jamais si la requête telle que
// l'application l'écrit peut seulement être construite.
//
// Trois fonctions du produit demandaient une jointure imbriquée vers
// `profiles` à partir de tables dont la clé étrangère désigne
// `organization_memberships`. PostgREST répondait `PGRST200`, l'erreur était
// avalée, et la fonction rendait un tableau vide. Conséquences visibles :
// un professeur ne voyait jamais les élèves de sa classe, les questions
// d'entraide n'étaient affichées à personne — pas même à leur auteur — et les
// membres d'un groupe restaient sans nom.
//
// Rien dans la suite de tests n'attrapait cela, parce qu'une liste vide
// ressemble à « il n'y a rien » et non à « la requête a échoué ».
//
// Ce script rejoue les formes de requête que le produit utilise, contre le
// vrai PostgREST, et échoue si l'une d'elles cesse d'être résolvable.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { chargerEnv, titre, exiger } from "../_commun.mjs";

chargerEnv();
exiger(["SUPABASE_URL", "SUPABASE_SECRET_KEY"], "verifier les requetes demande un acces a l API.");

/**
 * Les formes utilisées par `src/lib`, table par table.
 *
 * La clé de service contourne RLS : ce n'est pas un problème ici, parce que la
 * résolution d'une jointure imbriquée par PostgREST ne dépend pas des
 * politiques. Ce qu'on éprouve est la **forme** de la requête, pas le droit.
 */
const FORMES = [
  ["espace-eleve", "teaching_spaces", "id, class_id, subject_id"],
  ["espace-eleve", "assignments", "id, title, due_at, teaching_space_id, lesson_id"],
  ["espace-professeur", "class_enrollments", "profile_id"],
  ["espace-professeur", "class_enrollments", "class_id"],
  ["espace-professeur", "teaching_spaces", "id, class_id, subject_id"],
  ["studio", "lessons", "id, title, state, chapter_id, teaching_space_id"],
  ["studio", "lesson_blocks", "id, kind, position, contenu, file_id, assignment_id"],
  ["parcours-eleve", "fils_entraide", "id, question, auteur_id, resolu_le, created_at, reponses_entraide(id, texte, utile, created_at, masque_le, auteur_id)"],
  ["parcours-eleve", "travaux_faits", "assignment_id, profile_id"],
  ["parcours-eleve", "profiles", "id, first_name, last_name"],
  ["entraide", "workgroup_members", "workgroup_id, profile_id"],
  ["entraide", "workgroups", "id, label, teaching_space_id, max_members, closed_at"],
  ["lot-rentree", "import_rows", "id, row_number, payload, state, issue_detail, import_job_id"],
  ["acces", "organization_memberships", "profile_id, local_login, roles, account_state"],
  ["administration", "commercial_requests", "id, reference, state"],
  ["documents", "files", "id, display_name, mime_detected, byte_size, state"],
  ["devoirs", "assignment_corrections", "id, body, file_id, published_at, updated_at"],
  ["moderation", "reports", "id, reason, detail, state, created_at, fil_id, reponse_id, reporter_id"],
  ["moderation", "fils_entraide", "id, question, auteur_id, masque_le, teaching_space_id"],
  ["moderation", "reponses_entraide", "id, texte, auteur_id, masque_le, fil_id"],
  ["nouveautes", "nouveautes", "id, genre, objet, contexte, created_at, lu_le"],
];

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

titre("AvecStudy — formes de requete resolvables par PostgREST");

let defauts = 0;

for (const [module, table, select] of FORMES) {
  const { error } = await client.from(table).select(select).limit(1);

  if (error === null) {
    console.log(`  ok   ${module.padEnd(18)} ${table}`);
    continue;
  }

  defauts += 1;
  const abrege = String(error.message ?? "").split("\n")[0].slice(0, 90);
  console.log(`  NON  ${module.padEnd(18)} ${table} — ${error.code} ${abrege}`);
}

console.log("\n" + "-".repeat(72));
if (defauts === 0) {
  console.log("Toutes les formes de requete du produit sont resolvables.");
} else {
  console.log(`${defauts} forme(s) que PostgREST ne sait pas resoudre.`);
  console.log("Une requete irresolvable rend une liste vide : l ecran dit « rien », pas « panne ».");
}
process.exitCode = defauts === 0 ? 0 : 1;

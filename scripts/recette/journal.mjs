#!/usr/bin/env node
// =============================================================================
// §10 — Le journal d'audit : ce qu'il contient, et ce qu'il ne doit pas.
//
//   npm run verifier:journal
//
// Le journal est **immuable** : la table refuse les mises à jour et les
// suppressions. C'est sa valeur — et c'est aussi ce qui rend une erreur
// définitive. Un secret écrit ici y resterait pour toujours.
//
// Ce script ne corrige rien et n'efface rien. Il lit, il mesure, et il dit.
// Le déclencheur `audit_sans_secret` (migration 0039) empêche l'écriture d'un
// secret ; ce contrôle vérifie l'existant, celui d'avant le déclencheur.
// =============================================================================

import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

/**
 * Ce qui n'a rien à faire dans une trace.
 *
 * On examine les **clés** comme les **valeurs**, ici, contrairement au
 * déclencheur qui n'examine que les clés : celui-ci regarde ce qui est déjà
 * écrit, et un secret peut très bien s'être glissé dans un champ au nom
 * innocent.
 */
const MOTIFS = [
  [/(^|[^a-z])(mot_de_passe|motdepasse|password|passwd)([^a-z]|$)/i, "mot de passe"],
  [/(^|[^a-z])(secret|api_key|cle_privee|private_key)([^a-z]|$)/i, "secret ou cle"],
  [/(^|[^a-z])(token|jeton|bearer)([^a-z]|$)/i, "jeton"],
  [/(^|[^a-z])(cookie|__Host-|avecstudy_session)/i, "cookie de session"],
  [/(^|[^a-z])(totp|otpauth)([^a-z]|$)/i, "second facteur"],
  [/\beyJ[A-Za-z0-9_-]{10,}\./, "jeton JWT"],
  [/[?&](token|X-Amz-Signature|signature)=/i, "URL signee"],
  [/(^|[^0-9])[0-9]{11}[A-Za-z]($|[^A-Za-z0-9])/, "INE"],
];

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "verifier-journal",
});
await sql.connect();

titre("AvecStudy — journal d audit");

let defauts = 0;

function verifier(condition, texte, detail = "") {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  defauts += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

/* --- Ce que le journal contient ------------------------------------------- */

const { rows: entrees } = await sql.query(
  `select id, action, actor_kind, object_kind, reason, metadata, created_at
     from study.audit_events order by created_at`,
);

console.log(`\n${entrees.length} entree(s) au journal.`);

const parAction = new Map();
for (const entree of entrees) {
  parAction.set(entree.action, (parAction.get(entree.action) ?? 0) + 1);
}
console.log("\nRepartition :");
for (const [action, nombre] of [...parAction].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(nombre).padStart(3)} × ${action}`);
}

/* --- Aucun secret --------------------------------------------------------- */

console.log("\nContenu sensible");

const suspectes = [];
for (const entree of entrees) {
  const texte = JSON.stringify({
    metadata: entree.metadata,
    reason: entree.reason,
    object_kind: entree.object_kind,
  });

  for (const [motif, quoi] of MOTIFS) {
    if (motif.test(texte)) {
      // On nomme l'entrée et la catégorie, **jamais** la valeur trouvée : un
      // rapport qui recopie le secret qu'il dénonce ne vaut pas mieux.
      suspectes.push({ id: entree.id, action: entree.action, quoi });
      break;
    }
  }
}

verifier(
  suspectes.length === 0,
  "aucune entree ne porte de mot de passe, secret, jeton, cookie, URL signee ni INE",
  suspectes.map((s) => `#${s.id} (${s.action}) : ${s.quoi}`).join(" ; "),
);

/* --- L'immutabilité tient -------------------------------------------------- */

console.log("\nImmutabilite");

const { rows: declencheurs } = await sql.query(
  `select tgname, tgenabled from pg_trigger
    where tgrelid = 'study.audit_events'::regclass and not tgisinternal
    order by tgname`,
);

for (const attendu of ["audit_events_immutable", "audit_events_sans_secret"]) {
  const trouve = declencheurs.find((d) => d.tgname === attendu);
  verifier(
    trouve !== undefined && trouve.tgenabled === "O",
    `le declencheur « ${attendu} » est actif`,
    trouve === undefined ? "absent" : `etat ${trouve.tgenabled}`,
  );
}

/* --- Conservation ---------------------------------------------------------- */

console.log("\nConservation");

if (entrees.length > 0) {
  const plusAncienne = entrees[0].created_at;
  const jours = Math.floor((Date.now() - plusAncienne.getTime()) / 86_400_000);
  console.log(`  la plus ancienne entree a ${jours} jour(s).`);

  // La politique est de trois ans (voir docs/14-journal-audit.md). Rien n'est
  // purgé automatiquement aujourd'hui : on le dit, plutôt que de laisser
  // croire qu'une purge existe.
  const limite = 3 * 365;
  verifier(
    jours <= limite,
    "aucune entree ne depasse la duree de conservation annoncee (3 ans)",
    `${jours} jours`,
  );
}

await sql.end();

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Journal d audit : conforme, et intact."
    : `Journal d audit : ${defauts} defaut(s).`,
);
process.exitCode = defauts === 0 ? 0 : 1;

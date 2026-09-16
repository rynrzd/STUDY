#!/usr/bin/env node
// =============================================================================
// Exercice de restauration — chapitres 27 et 39, test T18.
//
// « Une tâche "sauvegarde réussie" sans restauration ne suffit pas. »
// « Les logs d'un job ne suffisent pas à établir cette preuve. »
//
// Ce script vérifie une base RESTAURÉE, dans un projet séparé : il ne restaure
// pas lui-même (cela dépend de l'hébergeur), il contrôle que ce qui en sort est
// cohérent et exploitable, et produit un compte rendu horodaté.
//
//   RESTAURE_DATABASE_URL=postgres://… node scripts/restauration-test.mjs
// =============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { RACINE, chargerEnv, titre, abandonner, connecter } from "./_commun.mjs";

const CONTROLES = [
  {
    nom: "Le schema est complet",
    sql: `select count(*)::int as valeur from pg_tables where schemaname = 'study'`,
    attendu: (valeur) => valeur >= 50,
    detail: "au moins 50 tables dans le schema study",
  },
  {
    nom: "Le schema prive existe et reste ferme",
    sql: `select count(*)::int as valeur from pg_tables where schemaname = 'study_prive'`,
    attendu: (valeur) => valeur >= 6,
    detail: "sessions, jetons, alias, jobs, outbox, webhooks",
  },
  {
    nom: "RLS est active partout",
    sql: `select count(*)::int as valeur from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'study' and c.relkind = 'r' and c.relrowsecurity = false`,
    attendu: (valeur) => valeur === 0,
    detail: "aucune table du schema study sans RLS",
  },
  {
    nom: "Les politiques sont presentes",
    sql: `select count(*)::int as valeur from pg_policies where schemaname = 'study'`,
    attendu: (valeur) => valeur >= 90,
    detail: "les politiques ne sont pas perdues a la restauration",
  },
  {
    nom: "Les copies remises sont la",
    sql: `select count(*)::int as valeur from study.submission_versions`,
    attendu: (valeur) => valeur >= 0,
    detail: "table lisible ; le nombre attendu depend de la sauvegarde",
  },
  {
    nom: "Les inscriptions relient toujours eleves et classes",
    sql: `select count(*)::int as valeur from study.class_enrollments ce
            left join study.classes c on c.id = ce.class_id
           where c.id is null`,
    attendu: (valeur) => valeur === 0,
    detail: "aucune inscription orpheline",
  },
  {
    nom: "Aucune facture orpheline",
    sql: `select count(*)::int as valeur from study.invoice_refs i
            left join study.contracts c on c.id = i.contract_id
           where c.id is null`,
    attendu: (valeur) => valeur === 0,
    detail: "chaque facture pointe encore son contrat",
  },
  {
    nom: "Les declencheurs d immuabilite sont en place",
    sql: `select count(*)::int as valeur from pg_trigger
           where tgname in ('submission_versions_immutable', 'audit_events_immutable',
                            'content_versions_immutable')`,
    attendu: (valeur) => valeur >= 3,
    detail: "une copie remise reste immuable apres restauration",
  },
];

async function principal() {
  chargerEnv();

  const url = process.env.RESTAURE_DATABASE_URL;
  if (url === undefined || url.trim() === "") {
    abandonner(
      "aucune base restauree a controler. " +
        "Restaurer d'abord une sauvegarde dans un projet SEPARE, puis relancer avec " +
        "RESTAURE_DATABASE_URL pointant dessus. Ce script ne restaure pas lui-meme : " +
        "la restauration depend de l'hebergeur, et la verifier est une operation distincte.",
      ["RESTAURE_DATABASE_URL"],
    );
  }

  const debut = new Date();
  titre(
    `AvecStudy — exercice de restauration (test T18)\n` +
    `debut : ${debut.toISOString()}`,
  );

  const client = await connecter(url, { application: "study-restauration" });
  const resultats = [];

  try {
    for (const controle of CONTROLES) {
      try {
        const reponse = await client.query(controle.sql);
        const valeur = reponse.rows[0]?.valeur ?? null;
        const reussi = controle.attendu(valeur);
        resultats.push({ ...controle, valeur, reussi, erreur: null });
        console.log(`  [${reussi ? "ok " : "ECHEC"}] ${controle.nom} — ${valeur}`);
      } catch (erreur) {
        resultats.push({ ...controle, valeur: null, reussi: false, erreur: erreur.message });
        console.log(`  [ECHEC] ${controle.nom} — ${erreur.message}`);
      }
    }
  } finally {
    await client.end();
  }

  const fin = new Date();
  const dureeSecondes = Math.round((fin.getTime() - debut.getTime()) / 1000);
  const echecs = resultats.filter((resultat) => !resultat.reussi);

  // La preuve est un compte rendu horodaté, pas un log de tâche (ch. 27).
  const dossier = path.join(RACINE, "preuves");
  mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, `restauration-${debut.toISOString().slice(0, 19).replace(/:/g, "")}.md`);

  const lignes = [
    "# Exercice de restauration",
    "",
    `- Debut : ${debut.toISOString()}`,
    `- Fin : ${fin.toISOString()}`,
    `- Duree du controle : ${dureeSecondes} s`,
    `- Resultat : ${echecs.length === 0 ? "conforme" : `${echecs.length} controle(s) en echec`}`,
    "",
    "| Controle | Valeur | Resultat | Attendu |",
    "|---|---|---|---|",
    ...resultats.map(
      (resultat) =>
        `| ${resultat.nom} | ${resultat.valeur ?? "—"} | ${resultat.reussi ? "ok" : "ECHEC"} | ${resultat.detail} |`,
    ),
    "",
    "## Ce que cet exercice ne prouve pas",
    "",
    "- Il ne controle que la base. Les objets du stockage se sauvegardent et se",
    "  restaurent separement (BACKUP-01) : leur restauration doit etre exercee a part.",
    "- Il ne mesure pas le RTO reel, qui inclut la duree de la restauration elle-meme,",
    "  pas seulement celle de ce controle.",
    "- Il ne verifie pas que les suppressions demandees avant la sauvegarde ont ete",
    "  reappliquees apres restauration : ce point se controle manuellement.",
    "",
  ];

  writeFileSync(fichier, `${lignes.join("\n")}\n`, "utf8");
  console.log(`\nCompte rendu horodate : ${fichier}`);
  console.log(
    echecs.length === 0
      ? "Controles conformes. Le RTO reel reste a mesurer separement."
      : `${echecs.length} controle(s) en echec : la restauration n'est pas exploitable en l'etat.`,
  );

  process.exit(echecs.length === 0 ? 0 : 1);
}

principal().catch((erreur) => {
  console.error(`restauration : ${erreur.message}`);
  process.exit(1);
});

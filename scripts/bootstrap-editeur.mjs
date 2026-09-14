#!/usr/bin/env node
// =============================================================================
// Bootstrap du propriétaire — chapitre 41.
//
// « Script serveur ponctuel avec adresse professionnelle du propriétaire,
// création/invitation, MFA et journal. Aucun secret fixe dans Git, aucune route
// /make-me-admin, aucune promotion automatique du premier inscrit. Le script
// est idempotent et son usage de production est restreint. »
//
//   node scripts/bootstrap-editeur.mjs --email prenom.nom@domaine.fr
//
// Ce script ne fabrique PAS de mot de passe : il crée la personne et envoie une
// invitation à usage unique. Un mot de passe imprimé dans un terminal finirait
// dans un historique de shell.
// =============================================================================

import {
  chargerEnv, titre, exiger, abandonner, connecter,
} from "./_commun.mjs";

function lireArgument(nom) {
  const index = process.argv.indexOf(`--${nom}`);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

async function principal() {
  chargerEnv();

  const email = lireArgument("email");
  if (email === null || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    abandonner(
      "adresse professionnelle absente ou invalide. " +
        "Usage : node scripts/bootstrap-editeur.mjs --email prenom.nom@domaine.fr",
    );
  }

  exiger(
    ["WORKER_DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"],
    "creer le compte proprietaire demande la base et l'API d'administration du " +
      "fournisseur d'identite.",
  );

  const environnement = (process.env.APP_ENV ?? "").trim();
  if (environnement === "production" && process.env.CONFIRMER_PRODUCTION !== "oui") {
    abandonner(
      "usage en production restreint. Relancer avec CONFIRMER_PRODUCTION=oui " +
        "si c'est bien l'intention (ch. 41).",
    );
  }

  titre(`study. — bootstrap du proprietaire\nenvironnement : ${environnement || "(non defini)"}`);

  const client = await connecter(process.env.WORKER_DATABASE_URL, {
    application: "study-bootstrap",
  });

  try {
    // Idempotence : si la personne existe déjà comme personnel éditeur, on ne
    // recrée rien et on ne réinvite pas.
    const existant = await client.query(
      `select p.id, e.state::text as etat
         from study.profiles p
         join study_prive.editor_staff e on e.profile_id = p.id
        where lower(p.professional_email) = lower($1)`,
      [email],
    );

    if (existant.rows.length > 0) {
      console.log("Cette personne est deja enregistree comme personnel editeur.");
      console.log(`  etat : ${existant.rows[0].etat}`);
      console.log("Aucune modification. Le script est idempotent.");
      return;
    }

    console.log("Ce que ce script ferait, une fois le fournisseur d'identite raccorde :");
    console.log("  1. creer l'utilisateur via l'API d'administration, sans mot de passe ;");
    console.log("  2. inserer study.profiles et study_prive.editor_staff ;");
    console.log("  3. envoyer une invitation a usage unique, expirante ;");
    console.log("  4. imposer l'enrolement MFA avant toute operation privilegiee ;");
    console.log("  5. journaliser l'operation dans study.audit_events.");
    console.log("");

    abandonner(
      "le raccordement au fournisseur d'identite n'est pas fait. " +
        "Creer un utilisateur sans lui, ou lui poser un mot de passe depuis ce script, " +
        "produirait un compte privilegie hors du circuit d'authentification.",
    );
  } finally {
    await client.end();
  }
}

principal().catch((erreur) => {
  console.error(`bootstrap : ${erreur.message}`);
  process.exit(1);
});

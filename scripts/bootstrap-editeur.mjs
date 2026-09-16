#!/usr/bin/env node
// =============================================================================
// Compte propriétaire AvecStudy — chapitre 41, migrations 0013 et 0016.
//
// Crée le compte qui gère la plateforme. Un seul chemin, volontairement : ce
// script, exécuté à la main, avec un secret lu dans l'environnement.
//
//   STUDY_EDITEUR_IDENTIFIANT=rayan \
//   STUDY_EDITEUR_MOT_DE_PASSE='...' \
//   npm run bootstrap:editeur -- --prenom Rayan --nom Tifouti
//
// Pourquoi le mot de passe passe par l'environnement et jamais par un argument :
// un argument de ligne de commande apparaît dans l'historique du shell et dans
// la liste des processus de la machine. Une variable d'environnement d'un seul
// appel, non.
//
// Ce que le chapitre 41 interdit et que ce script respecte :
//   - aucun secret fixe dans Git ;
//   - aucune route /make-me-admin ;
//   - aucune promotion automatique du premier inscrit ;
//   - idempotent : relancé, il ne recrée rien et ne réinitialise rien.
//
// Depuis la finition V1, il n'a **plus besoin de WORKER_DATABASE_URL** : il
// passe par la clé de service et la fonction study.amorcer_exploitant. Le
// cahier demande de ne pas faire dépendre la V1 d'une URL PostgreSQL complète
// quand ce n'est pas indispensable.
//
// AvecStudy n'envoie aucun courrier : ce compte n'a pas d'adresse électronique
// mais une identité technique opaque, comme celle d'un élève.
// =============================================================================

import { randomBytes } from "node:crypto";
import { chargerEnv, titre, exiger, abandonner } from "./_commun.mjs";

/** AUTH-01 : 15 caractères minimum pour un compte sans MFA encore enrôlée. */
const LONGUEUR_MINIMALE = 15;

function lireArgument(nom) {
  const index = process.argv.indexOf(`--${nom}`);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

function verifierIdentifiant(identifiant) {
  if (identifiant === null || !/^[a-z0-9][a-z0-9._-]{1,38}$/.test(identifiant)) {
    abandonner(
      "identifiant absent ou invalide. Minuscules, chiffres, point, tiret ou " +
        "souligne ; de 2 a 39 caracteres. Exemple : rayan",
      ["STUDY_EDITEUR_IDENTIFIANT"],
    );
  }
}

function verifierMotDePasse(secret, identifiant) {
  if (secret === undefined || secret === "") {
    abandonner(
      "mot de passe absent. Il se transmet par variable d'environnement, jamais " +
        "en argument : un argument reste dans l'historique du shell.",
      ["STUDY_EDITEUR_MOT_DE_PASSE"],
    );
  }

  const problemes = [];
  if (secret.length < LONGUEUR_MINIMALE) {
    problemes.push(`au moins ${LONGUEUR_MINIMALE} caracteres (AUTH-01), il en a ${secret.length}`);
  }
  if (secret.length > 200) {
    problemes.push("au plus 200 caracteres");
  }
  if (secret.toLowerCase().includes(identifiant.toLowerCase())) {
    problemes.push("il ne doit pas contenir l'identifiant");
  }
  if (/^(.)\1+$/.test(secret)) {
    problemes.push("il ne doit pas etre une repetition d'un seul caractere");
  }
  for (const courant of ["password", "motdepasse", "azerty", "qwerty", "123456", "avecstudy"]) {
    if (secret.toLowerCase().includes(courant)) {
      problemes.push(`il contient une suite trop courante (« ${courant} »)`);
      break;
    }
  }

  if (problemes.length > 0) {
    // On dit ce qui ne va pas, jamais ce qui a ete saisi.
    console.error("\nMot de passe refuse :");
    for (const probleme of problemes) console.error(`  - ${probleme}`);
    console.error("\nUne phrase de passe longue vaut mieux qu'une suite courte et compliquee.");
    process.exit(1);
  }
}

async function principal() {
  chargerEnv();

  const identifiant = process.env.STUDY_EDITEUR_IDENTIFIANT ?? null;
  const secret = process.env.STUDY_EDITEUR_MOT_DE_PASSE;
  const prenom = lireArgument("prenom") ?? "Exploitant";
  const nom = lireArgument("nom") ?? "AvecStudy";

  verifierIdentifiant(identifiant);
  verifierMotDePasse(secret, identifiant);

  exiger(
    ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "STUDENT_ALIAS_DOMAIN"],
    "creer le compte proprietaire demande l'API d'administration du fournisseur " +
      "d'identite et le domaine d'alias.",
  );

  const environnement = (process.env.APP_ENV ?? "").trim();
  if (environnement === "production" && process.env.CONFIRMER_PRODUCTION !== "oui") {
    abandonner(
      "usage en production restreint. Relancer avec CONFIRMER_PRODUCTION=oui " +
        "si c'est bien l'intention (ch. 41).",
    );
  }

  titre(
    `AvecStudy — compte proprietaire\n` +
      `environnement : ${environnement || "(non defini)"}\n` +
      `identifiant   : ${identifiant}`,
  );

  const { createClient } = await import("@supabase/supabase-js");
  const fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
  });

  // --- Création côté fournisseur d'identité --------------------------------
  // L'ordre compte : on crée d'abord chez le fournisseur, puis en base. Si la
  // base échoue, on défait la création. L'inverse laisserait une ligne sans
  // moyen de connexion.
  const alias = `${randomBytes(8).toString("hex")}@${process.env.STUDENT_ALIAS_DOMAIN}`;

  const creation = await fournisseur.auth.admin.createUser({
    email: alias,
    password: secret,
    // L'alias n'est pas une boite aux lettres : rien ne sera jamais envoye
    // dessus, et il n'y a donc rien a confirmer par courrier.
    email_confirm: true,
    app_metadata: { role: "exploitant" },
  });

  if (creation.error !== null) {
    abandonner(`le fournisseur d'identite a refuse la creation : ${creation.error.message}`);
  }

  const profileId = creation.data.user.id;

  // --- Écriture en base, en une seule fonction atomique --------------------
  const { data, error } = await fournisseur.rpc("amorcer_exploitant", {
    p_profile: profileId,
    p_prenom: prenom,
    p_nom: nom,
    p_identifiant: identifiant,
    p_alias: alias,
  });

  if (error !== null) {
    const suppression = await fournisseur.auth.admin
      .deleteUser(profileId)
      .catch(() => ({ error: { message: "suppression impossible" } }));

    if (suppression?.error) {
      console.error(
        `\nAttention : un compte a ete cree chez le fournisseur d'identite (${profileId}) ` +
          "et n'a pas pu etre supprime. Le supprimer a la main avant de relancer.",
      );
    } else {
      console.error("\nLa creation a ete defaite chez le fournisseur d'identite.");
    }

    abandonner(
      `la base a refuse l'amorcage (${error.code ?? "code inconnu"}). ` +
        "Verifier que les migrations sont appliquees et que le schema « study » " +
        "est expose dans Settings > API du projet Supabase.",
    );
  }

  if (data === "existant") {
    // Le compte fournisseur qui vient d'être créé n'a plus lieu d'être : c'est
    // un doublon d'un compte déjà amorcé.
    await fournisseur.auth.admin.deleteUser(profileId).catch(() => undefined);

    console.log("Ce compte proprietaire existe deja. Rien n'a ete modifie.\n");
    console.log(
      "Ce script ne reinitialise pas un mot de passe : ce serait un chemin de " +
        "reprise de compte sans controle. Pour changer le secret, passer par le " +
        "fournisseur d'identite.",
    );
    return;
  }

  console.log("Compte proprietaire cree.\n");
  console.log(`  code a saisir : AVECSTUDY`);
  console.log(`  identifiant   : ${identifiant}`);
  console.log(`  personne      : ${prenom} ${nom}`);
  console.log("  capacites     : administration, commercial, assistance");
  console.log("\nCe que ce compte permet :");
  console.log("  - consulter les demandes commerciales et leur statut ;");
  console.log("  - creer un lycee, le suspendre, creer son administrateur ;");
  console.log("  - suivre prospects, devis, contrats et reglements ;");
  console.log("  - lire le journal d'audit de tous les etablissements.");
  console.log("\nCe qu'il ne permet PAS, par conception :");
  console.log("  - lire une copie, une correction, une note personnelle ou un message");
  console.log("    d'entraide. Cela passe par un acces d'assistance : motif ecrit,");
  console.log("    accord d'un administrateur du lycee, expiration et journal.");
  console.log("\nLe mot de passe n'a ete affiche nulle part, et n'est pas journalise.");
}

principal().catch((erreur) => {
  console.error(`bootstrap : ${erreur.message}`);
  process.exit(1);
});

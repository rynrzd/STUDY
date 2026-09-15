#!/usr/bin/env node
// =============================================================================
// Compte exploitant — chapitre 41, et migration 0013.
//
// Crée le compte qui gère la plateforme : celui de Rayan. Un seul chemin,
// volontairement : ce script, exécuté à la main, avec un secret lu dans
// l'environnement.
//
//   STUDY_EDITEUR_IDENTIFIANT=rayan \
//   STUDY_EDITEUR_MOT_DE_PASSE='...' \
//   npm run bootstrap:editeur -- --prenom Rayan --nom Nom
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
// study. n'envoie aucun courrier : ce compte n'a pas d'adresse électronique
// mais une identité technique opaque, comme celle d'un élève.
// =============================================================================

import { randomBytes, randomUUID } from "node:crypto";
import { chargerEnv, titre, exiger, abandonner, connecter } from "./_commun.mjs";

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
  for (const courant of ["password", "motdepasse", "azerty", "qwerty", "123456", "study"]) {
    if (secret.toLowerCase().includes(courant)) {
      problemes.push(`il contient une suite trop courante (« ${courant} »)`);
      break;
    }
  }

  if (problemes.length > 0) {
    // On dit ce qui ne va pas, jamais ce qui a ete saisi.
    console.error("\nMot de passe refuse :");
    for (const probleme of problemes) console.error(`  - ${probleme}`);
    console.error(
      "\nUne phrase de passe longue vaut mieux qu'une suite courte et compliquee.",
    );
    process.exit(1);
  }
}

async function principal() {
  chargerEnv();

  const identifiant = process.env.STUDY_EDITEUR_IDENTIFIANT ?? null;
  const secret = process.env.STUDY_EDITEUR_MOT_DE_PASSE;
  const prenom = lireArgument("prenom") ?? "Exploitant";
  const nom = lireArgument("nom") ?? "study.";

  verifierIdentifiant(identifiant);
  verifierMotDePasse(secret, identifiant);

  exiger(
    ["WORKER_DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "STUDENT_ALIAS_DOMAIN"],
    "creer le compte exploitant demande la base et l'API d'administration du " +
      "fournisseur d'identite.",
  );

  const environnement = (process.env.APP_ENV ?? "").trim();
  if (environnement === "production" && process.env.CONFIRMER_PRODUCTION !== "oui") {
    abandonner(
      "usage en production restreint. Relancer avec CONFIRMER_PRODUCTION=oui " +
        "si c'est bien l'intention (ch. 41).",
    );
  }

  titre(
    `study. — compte exploitant\n` +
    `environnement : ${environnement || "(non defini)"}\n` +
    `identifiant   : ${identifiant}`,
  );

  const client = await connecter(process.env.WORKER_DATABASE_URL, {
    application: "study-bootstrap",
  });

  let identifiantFournisseur = null;
  let fournisseur = null;

  try {
    // --- Idempotence -------------------------------------------------------
    const existant = await client.query(
      `select a.profile_id, p.first_name, p.last_name, e.capabilities, e.state::text as etat
         from study_prive.auth_aliases a
         join study.profiles p on p.id = a.profile_id
         left join study_prive.editor_staff e on e.profile_id = a.profile_id
        where a.organization_id is null and a.local_login = $1`,
      [identifiant],
    );

    if (existant.rows.length > 0) {
      const ligne = existant.rows[0];
      console.log("Ce compte exploitant existe deja. Rien n'a ete modifie.\n");
      console.log(`  personne   : ${ligne.first_name} ${ligne.last_name}`);
      console.log(`  etat       : ${ligne.etat ?? "(pas de capacite editeur)"}`);
      console.log(`  capacites  : ${(ligne.capabilities ?? []).join(", ") || "(aucune)"}`);
      console.log(
        "\nCe script ne reinitialise pas un mot de passe : ce serait un chemin " +
          "de reprise de compte sans controle. Pour changer le secret, passer par " +
          "le fournisseur d'identite.",
      );
      return;
    }

    // --- Création côté fournisseur d'identité ------------------------------
    // L'ordre compte : on crée d'abord chez le fournisseur, puis en base. Si la
    // base échoue, on défait la création. L'inverse laisserait une ligne sans
    // moyen de connexion.
    const alias = `${randomBytes(8).toString("hex")}@${process.env.STUDENT_ALIAS_DOMAIN}`;

    const { createClient } = await import("@supabase/supabase-js");
    fournisseur = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
    identifiantFournisseur = creation.data.user.id;

    // --- Écriture en base, en une transaction ------------------------------
    const profileId = identifiantFournisseur ?? randomUUID();

    await client.query("begin");

    await client.query(
      `insert into study.profiles (id, first_name, last_name, professional_email)
       values ($1, $2, $3, null)`,
      [profileId, prenom, nom],
    );

    await client.query(
      `insert into study_prive.editor_staff (profile_id, capabilities, state)
       values ($1, array['administration', 'commercial', 'assistance'], 'active')`,
      [profileId],
    );

    await client.query(
      `insert into study_prive.auth_aliases
         (organization_id, profile_id, local_login, alias, kind)
       values (null, $1, $2, $3, 'exploitant')`,
      [profileId, identifiant, alias],
    );

    await client.query(
      `insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, reason)
       values (null, $1, 'systeme', 'bootstrap.exploitant', 'editor_staff', $1,
               'Creation du compte exploitant par script de bootstrap')`,
      [profileId],
    );

    await client.query("commit");

    console.log("Compte exploitant cree.\n");
    console.log(`  identifiant : ${identifiant}`);
    console.log(`  personne    : ${prenom} ${nom}`);
    console.log("  capacites   : administration, commercial, assistance");
    console.log("\nCe que ce compte permet :");
    console.log("  - creer un lycee, son annee scolaire et son premier administrateur ;");
    console.log("  - gerer classes, groupes, matieres, affectations et inscriptions ;");
    console.log("  - suivre prospects, devis, contrats, factures et reglements ;");
    console.log("  - lire le journal d'audit de tous les etablissements.");
    console.log("\nCe qu'il ne permet PAS, par conception :");
    console.log("  - lire une copie, une correction, une note personnelle ou un message");
    console.log("    d'entraide. Cela passe par un acces d'assistance : motif ecrit,");
    console.log("    accord d'un administrateur du lycee, expiration et journal.");
    console.log("\nAvant toute operation privilegiee : enroler la MFA.");
    console.log("  Les politiques de la base exigent un second facteur verifie sur la");
    console.log("  session elle-meme. Sans lui, ce compte ne peut rien administrer.");
    console.log("\nLe mot de passe n'a ete affiche nulle part, et n'est pas journalise.");
  } catch (erreur) {
    await client.query("rollback").catch(() => {});

    // Défaire la création côté fournisseur : ne pas laisser un compte
    // d'authentification orphelin, sans adhésion ni capacité (ch. 12).
    if (identifiantFournisseur !== null && fournisseur !== null) {
      const suppression = await fournisseur.auth.admin
        .deleteUser(identifiantFournisseur)
        .catch(() => ({ error: { message: "suppression impossible" } }));
      if (suppression?.error) {
        console.error(
          `\nAttention : un compte a ete cree chez le fournisseur d'identite (${identifiantFournisseur}) ` +
            "et n'a pas pu etre supprime. Le supprimer a la main avant de relancer.",
        );
      } else {
        console.error("\nLa creation a ete defaite chez le fournisseur d'identite.");
      }
    }

    abandonner(erreur.message);
  } finally {
    await client.end();
  }
}

principal().catch((erreur) => {
  console.error(`bootstrap : ${erreur.message}`);
  process.exit(1);
});

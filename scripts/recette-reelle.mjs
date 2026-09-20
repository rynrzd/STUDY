#!/usr/bin/env node
/**
 * Recette sur le projet Supabase réel — `npm run recette:reelle`.
 *
 * Elle n'imite rien : elle appelle les mêmes modules que les actions serveur —
 * `tenterConnexion`, `DepotSupabase`, `FournisseurSupabase`, les fonctions
 * `study.*` — contre la vraie base, avec les vraies clés.
 *
 * Tout ce qu'elle crée est supprimé à la fin, même en cas d'échec.
 * Aucun secret n'est affiché.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chargerEnv } from "./_commun.mjs";
import { codeStable, codeTotp } from "./recette/totp.mjs";
import {
  demonterDemandes,
  demonterEtablissement,
  demonterProfils,
  residuDeRecette,
} from "./recette/nettoyage.mjs";

chargerEnv();

const { tenterConnexion, messageDeRefus } = await import("../src/lib/authentification.ts");
const { DepotSupabase } = await import("../src/lib/depot-authentification.ts");
const { FournisseurSupabase, changerMotDePasse } = await import("../src/lib/fournisseur-supabase.ts");
const { chiffrer, dechiffrer, lireCles } = await import("../src/lib/chiffrement.ts");
const { empreinteJeton } = await import("../src/lib/session.ts");
const { genererReference, empreinteDeduplication } = await import("../src/lib/demande-commerciale.ts");
const { lireCsv } = await import("../src/lib/tableur.ts");
const { analyser, reconnaitreColonnes } = await import("../src/lib/import-rentree.ts");
const { appliquerImport } = await import("../src/lib/etablissement.ts");

/* -------------------------------------------------------------------------- */

let echecs = 0;
const aNettoyer = { profils: [], organisations: [], demandes: [] };
const CLES = lireCles();
const SUFFIXE = randomBytes(3).toString("hex");

function verifier(condition, texte, detail) {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  echecs += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

function service() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
  });
}

function anonyme() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
  });
}

const empreinteHexa = (jeton) => `\\x${empreinteJeton(jeton).toString("hex")}`;

async function seConnecter(code, identifiant, secret) {
  return tenterConnexion(
    { codeEtablissement: code, identifiant, secret, appareil: "personnel" },
    {
      depot: new DepotSupabase(),
      fournisseur: new FournisseurSupabase(),
      chiffrer: (clair) => chiffrer(clair, CLES),
    },
  );
}

/** Les deux jetons du fournisseur, déchiffrés depuis la session — comme le BFF. */
async function jetonsDe(jetonSession) {
  const { data } = await service().rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(jetonSession),
  });
  const ligne = Array.isArray(data) ? data[0] : null;
  if (ligne?.provider_tokens_chiffres == null) return null;

  const brut = ligne.provider_tokens_chiffres;
  const scelle = brut.startsWith("\\x") ? Buffer.from(brut.slice(2), "hex").toString("utf8") : brut;
  const clair = JSON.parse(dechiffrer(scelle, CLES));

  return { accessToken: clair.access, refreshToken: clair.refresh };
}

/** Jeton d'accès seul, pour les contrôles qui n'ont pas besoin du reste. */
async function jetonAccesDe(jetonSession) {
  return (await jetonsDe(jetonSession))?.accessToken ?? null;
}

/**
 * L'identifiant de profil de l'exploitant, lu en base.
 *
 * Ce n'est pas un contournement d'authentification : la clé de service a déjà
 * tous les droits, et ce que l'on cherche ici n'est qu'une clé primaire. Cela
 * permet de jouer le reste de la recette sur une machine où le mot de passe de
 * l'exploitant n'a — à juste titre — pas été déposé.
 */
async function identifiantExploitant() {
  // `study_prive` n'est volontairement pas exposé à PostgREST : on passe donc
  // par la connexion PostgreSQL, comme les scripts d'exploitation.
  const client = new pg.Client({
    connectionString: process.env.WORKER_DATABASE_URL,
    application_name: "recette-reelle",
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "select profile_id from study_prive.editor_staff where state = 'active' limit 1",
    );
    return rows[0]?.profile_id ?? null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

/* ========================================================================== */
/* 1. Connexion du compte propriétaire                                         */
/* ========================================================================== */

async function connexionProprietaire() {
  console.log("\n1. Connexion reelle du compte proprietaire");

  // Les identifiants du propriétaire peuvent venir de l'environnement — le
  // plus propre — ou de la fiche produite par l'amorçage, si elle n'a pas
  // encore été rangée puis supprimée.
  let identifiant = process.env.STUDY_EDITEUR_IDENTIFIANT ?? null;
  let motDePasse = process.env.STUDY_EDITEUR_MOT_DE_PASSE ?? null;

  if (identifiant === null || motDePasse === null) {
    let texte;
    try {
      texte = readFileSync("ACCES-PROPRIETAIRE.txt", "utf8");
    } catch {
      texte = null;
    }

    if (texte === null) {
      // Pas d'identifiants : la connexion réelle de l'exploitant ne peut pas
      // être jouée. Le reste de la recette, lui, n'a besoin que de son
      // **identifiant de profil**, que la clé de service sait lire.
      //
      // On le dit franchement plutôt que de compter un succès : une section
      // non jouée n'est pas une section réussie. Et on ne s'arrête pas là,
      // sinon tout le reste deviendrait intestable faute d'un mot de passe
      // qui n'a rien à faire sur cette machine.
      console.log(
        "  (non joue) connexion reelle de l exploitant : identifiants absents de cette machine.\n" +
          "             Pour la jouer : STUDY_EDITEUR_IDENTIFIANT=... STUDY_EDITEUR_MOT_DE_PASSE=... npm run recette:reelle",
      );

      return identifiantExploitant();
    }

    identifiant = identifiant ?? /Identifiant\s*:\s*(\S+)/.exec(texte)?.[1] ?? null;
    motDePasse = motDePasse ?? /Mot de passe\s*:\s*(\S+)/.exec(texte)?.[1] ?? null;
  }

  if (identifiant === null || motDePasse === null) {
    console.log("  Identifiants du proprietaire illisibles.");
    echecs += 1;
    return null;
  }

  const resultat = await seConnecter("AVECSTUDY", identifiant, motDePasse);
  if (!verifier(resultat.reussi, "connexion acceptee", resultat.reussi ? "" : messageDeRefus(resultat))) {
    return null;
  }

  verifier(resultat.portee === "editeur", "portee de session « editeur »", resultat.portee);
  verifier(resultat.activationRequise === false, "aucune activation exigee pour l exploitant");
  verifier(resultat.jetonSession.length >= 40, "jeton de session opaque et long");

  const { data } = await service().rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(resultat.jetonSession),
  });
  const ligne = Array.isArray(data) ? data[0] : null;
  verifier(ligne != null, "session enregistree cote serveur");
  verifier(ligne?.revoked_at === null, "session active");
  verifier(ligne?.prenom === "Rayan", "session rattachee a la bonne personne", ligne?.prenom);
  verifier(ligne?.roles?.includes("editeur"), "role editeur porte par la session");

  // Mauvais mot de passe, puis identifiant inconnu : meme refus, meme message.
  const refus = await seConnecter("AVECSTUDY", identifiant, "ce-n-est-pas-le-bon-mot-de-passe");
  verifier(refus.reussi === false, "un mauvais mot de passe est refuse");

  const inconnu = await seConnecter("AVECSTUDY", "personne-inexistante", "peu-importe");
  verifier(inconnu.reussi === false, "un identifiant inconnu est refuse");
  verifier(
    messageDeRefus(inconnu) === messageDeRefus(refus),
    "compte inconnu et mot de passe faux donnent le meme message",
  );

  // Deconnexion reelle : la session est revoquee en base.
  const depot = new DepotSupabase();
  await depot.revoquerSession(empreinteJeton(resultat.jetonSession), "recette");
  const { data: apres } = await service().rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(resultat.jetonSession),
  });
  verifier(apres?.[0]?.revoked_at !== null, "la deconnexion revoque la session en base");

  await depot.effacerEchecs(resultat.profileId);
  return resultat.profileId;
}

/* ========================================================================== */
/* 2. Demande de démonstration                                                 */
/* ========================================================================== */

async function demandeDeDevis() {
  console.log("\n2. Demande de demonstration deposee pour de vrai");

  const client = service();
  const reference = genererReference((n) => new Uint8Array(randomBytes(n)));
  const etablissement = `Lycee de recette ${SUFFIXE}`;
  const courriel = `recette.${SUFFIXE}@exemple.invalid`;
  const empreinte = empreinteDeduplication({ etablissement, contactEmail: courriel });

  const { data, error } = await client
    .from("commercial_requests")
    .insert({
      reference,
      establishment_name: etablissement,
      legal_kind: "public",
      commune: "Roubaix",
      approximate_size: 900,
      contact_name: "Claude Martin",
      contact_role: "Proviseur",
      contact_email: courriel,
      message: "Nous cherchons a organiser les devoirs de seconde.",
      dedupe_digest: empreinte,
      source: "site",
    })
    .select("id, reference, state, purge_after, last_contact_at")
    .single();

  if (!verifier(error === null, "la demande est enregistree", error?.message)) return;
  aNettoyer.demandes.push(data.id);

  verifier(data.reference === reference, "la reference rendue est celle affichee au visiteur");
  verifier(data.state === "nouvelle", "etat initial « nouvelle »", data.state);
  verifier(/^AS-\d{4}-[A-Z2-9]{5}$/.test(reference), "reference lisible et sans caractere ambigu", reference);

  const ecart = new Date(data.purge_after) - new Date(data.last_contact_at);
  verifier(
    Math.abs(ecart - 3 * 365 * 24 * 3600 * 1000) < 5 * 24 * 3600 * 1000,
    "conservation calee sur trois ans apres le dernier contact",
  );

  const { error: doublon } = await client.from("commercial_requests").insert({
    reference: genererReference((n) => new Uint8Array(randomBytes(n))),
    establishment_name: etablissement,
    legal_kind: "public",
    contact_name: "Claude Martin",
    contact_email: courriel,
    dedupe_digest: empreinte,
  });
  verifier(doublon?.code === "23505", "un envoi en double est refuse", doublon?.code);

  const { data: liste } = await client
    .from("commercial_requests")
    .select("reference, state")
    .eq("reference", reference);
  verifier(liste?.length === 1, "la demande apparait dans l administration");

  const { error: maj } = await client
    .from("commercial_requests")
    .update({ state: "contactee", internal_note: "Rappele le 16" })
    .eq("id", data.id);
  verifier(maj === null, "l etat commercial se met a jour", maj?.message);

  const { data: vu, error: refuse } = await anonyme()
    .from("commercial_requests")
    .select("contact_email")
    .limit(1);
  verifier(
    refuse !== null || (vu?.length ?? 0) === 0,
    "une session anonyme ne lit aucune demande",
    refuse?.code ?? `${vu?.length ?? 0} ligne(s)`,
  );
}

/* ========================================================================== */
/* 3. Établissement, administrateur, activation                                */
/* ========================================================================== */

async function parcoursEtablissement(proprietaire) {
  console.log("\n3. Etablissement, administrateur et activation");

  const client = service();
  const code = `RECETTE-${SUFFIXE.toUpperCase()}`;
  const login = `c.martin${SUFFIXE}`;

  const { data: organisation, error: erreurOrg } = await client.rpc("admin_creer_etablissement", {
    p_acteur: proprietaire,
    p_nom: "Lycee de recette",
    p_code: code,
    p_slug: `lycee-recette-${SUFFIXE}`,
    p_type: "public",
    p_commune: "Roubaix",
  });
  if (!verifier(erreurOrg === null, "etablissement cree", erreurOrg?.message)) return null;
  aNettoyer.organisations.push(organisation);

  const { data: etatInitial } = await client
    .from("organizations")
    .select("state")
    .eq("id", organisation)
    .single();
  verifier(etatInitial.state === "preparation", "etablissement cree en « preparation »", etatInitial.state);

  await client.rpc("admin_changer_etat_etablissement", {
    p_acteur: proprietaire,
    p_organisation: organisation,
    p_etat: "actif",
    p_motif: "Ouverture pour la recette de mise en service",
  });

  const courriel = `admin.recette.${SUFFIXE}@exemple.invalid`;
  const temporaire = `Temporaire-${randomBytes(8).toString("hex")}`;

  const creation = await client.auth.admin.createUser({
    email: courriel,
    password: temporaire,
    email_confirm: true,
  });
  if (!verifier(creation.error === null, "compte de connexion cree", creation.error?.message)) return null;

  const administrateur = creation.data.user.id;
  aNettoyer.profils.push(administrateur);

  const { error: erreurAdmin } = await client.rpc("admin_creer_administrateur", {
    p_acteur: proprietaire,
    p_organisation: organisation,
    p_profile: administrateur,
    p_prenom: "Claude",
    p_nom: "Martin",
    p_email: courriel,
    p_identifiant: login,
    p_alias: courriel,
  });
  if (!verifier(erreurAdmin === null, "administrateur cree", erreurAdmin?.message)) return null;

  const connexion = await seConnecter(code, login, temporaire);
  if (!verifier(connexion.reussi, "l administrateur se connecte", connexion.reussi ? "" : messageDeRefus(connexion))) {
    return null;
  }
  verifier(connexion.activationRequise === true, "changement de mot de passe exige");
  verifier(connexion.portee === "activation", "session de portee « activation »", connexion.portee);

  const { data: avant } = await client.rpc("etab_contexte", { p_acteur: administrateur });
  verifier((avant?.length ?? 0) === 0, "un compte non active n administre rien");

  const jetonAcces = await jetonAccesDe(connexion.jetonSession);
  verifier(typeof jetonAcces === "string", "jeton du fournisseur dechiffrable depuis la session");

  const nouveau = `phrase de recette ${randomBytes(6).toString("hex")}`;
  verifier(await changerMotDePasse(jetonAcces, nouveau), "mot de passe reellement change chez le fournisseur");

  const { error: erreurActivation } = await client.rpc("auth_activer_compte", {
    p_profile: administrateur,
    p_organization: organisation,
    p_session_conservee: empreinteHexa(connexion.jetonSession),
  });
  verifier(erreurActivation === null, "compte active", erreurActivation?.message);

  const avecNouveau = await seConnecter(code, login, nouveau);
  verifier(avecNouveau.reussi === true, "connexion avec le nouveau mot de passe");
  verifier(avecNouveau.activationRequise === false, "l activation n est plus demandee");
  verifier(avecNouveau.portee === "etablissement", "session d etablissement ordinaire", avecNouveau.portee);

  const avecAncien = await seConnecter(code, login, temporaire);
  verifier(avecAncien.reussi === false, "l ancien mot de passe temporaire ne fonctionne plus");
  await new DepotSupabase().effacerEchecs(administrateur);

  const { data: apres } = await client.rpc("etab_contexte", { p_acteur: administrateur });
  verifier(apres?.[0]?.organization_id === organisation, "contexte d etablissement accessible apres activation");

  return { organisation, administrateur, code, login, motDePasse: nouveau };
}

/* ========================================================================== */
/* 3 bis. Second facteur                                                       */
/* ========================================================================== */

/**
 * Le second facteur, joué en entier contre le vrai fournisseur.
 *
 * C'est la seule preuve qui compte : les tests PGlite montrent que la base
 * refuse en `aal1`, mais ils n'atteignent pas Supabase Auth. Ici on enrôle un
 * facteur, on calcule un code, on le présente, et on vérifie que la session
 * est réellement montée en `aal2`.
 *
 * Le secret n'est jamais affiché, jamais écrit, et meurt avec le compte
 * jetable à la fin de la recette.
 */
async function secondFacteur(contexte, motDePasse) {
  console.log("\n3 bis. Second facteur (MFA)");

  const client = service();
  const fournisseur = new FournisseurSupabase();

  const { data: exige } = await client.rpc("auth_second_facteur_exige", {
    p_profile: contexte.administrateur,
  });
  if (!verifier(exige === true, "le second facteur est exige d un administrateur")) return;

  // Deux sessions : celle sur laquelle on enrôle, et une autre restée ouverte
  // ailleurs. La seconde doit tomber au moment de l'activation.
  const ailleurs = await seConnecter(contexte.code, contexte.login, motDePasse);
  const courante = await seConnecter(contexte.code, contexte.login, motDePasse);
  if (!verifier(courante.reussi && ailleurs.reussi, "deux sessions ouvertes au mot de passe")) return;

  const { data: avant } = await client.rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(courante.jetonSession),
  });
  verifier(avant?.[0]?.niveau_assurance === "aal1", "une session au mot de passe nait en aal1", avant?.[0]?.niveau_assurance);

  const jetons = await jetonsDe(courante.jetonSession);
  if (!verifier(jetons !== null, "jetons du fournisseur lisibles depuis la session")) return;

  // Un enrôlement abandonné ne doit pas empiler les facteurs : on part d'une
  // liste propre, comme le fait `preparerEnrolement`.
  for (const facteur of await fournisseur.listerFacteurs(jetons)) {
    if (!facteur.verifie) await fournisseur.retirerFacteur(jetons, facteur.id);
  }

  let enrolement;
  try {
    enrolement = await fournisseur.enrolerTotp(jetons);
  } catch (erreur) {
    verifier(false, "facteur TOTP enrole chez le fournisseur", erreur.message);
    return;
  }
  verifier(typeof enrolement.facteurId === "string" && enrolement.facteurId !== "", "facteur TOTP enrole chez le fournisseur");
  verifier(typeof enrolement.secret === "string" && enrolement.secret.length >= 16, "un secret est remis une fois");
  verifier(enrolement.qrCode.startsWith("data:"), "le QR est une image « data: », sans requete exterieure");

  // Un facteur enrôlé mais non vérifié n'élève rien : l'étape reste « à
  // vérifier », et la session est toujours en aal1.
  const { data: pendant } = await client.rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(courante.jetonSession),
  });
  verifier(pendant?.[0]?.niveau_assurance === "aal1", "un facteur enrole mais non verifie n eleve rien");

  // Un code faux doit être refusé — sans quoi tout le reste ne prouve rien.
  const faux = codeTotp(enrolement.secret, { pas: -5 });
  let refus;
  try {
    refus = await fournisseur.verifierTotp(jetons, enrolement.facteurId, faux);
  } catch {
    refus = { reussi: false };
  }
  verifier(refus.reussi === false, "un code hors fenetre est refuse");

  // Le bon code, pris confortablement dans sa fenêtre.
  const code = await codeStable(enrolement.secret);
  let verification;
  try {
    verification = await fournisseur.verifierTotp(jetons, enrolement.facteurId, code);
  } catch (erreur) {
    verifier(false, "le code presente est accepte", erreur.message);
    return;
  }
  if (!verifier(verification.reussi === true, "le code presente est accepte")) return;

  // `reussi` n'est vrai que si le fournisseur a effectivement émis des jetons
  // `aal2` : le niveau voyage avec les jetons, pas à côté d'eux.
  verifier(
    verification.jetons?.niveauAssurance === "aal2",
    "les jetons emis portent aal2",
    verification.jetons?.niveauAssurance,
  );

  const { data: eleves } = await client.rpc("auth_elever_assurance", {
    p_empreinte: empreinteHexa(courante.jetonSession),
    p_niveau: "aal2",
  });
  // Le compte a ouvert plusieurs sessions au cours de son activation. Toutes
  // doivent tomber : aucune n'a présenté ce facteur, puisqu'il n'existait pas
  // encore. On vérifie donc « au moins celle-là », pas un compte exact.
  verifier(typeof eleves === "number" && eleves >= 1, "l activation ferme les sessions anterieures", String(eleves));

  const { data: apres } = await client.rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(courante.jetonSession),
  });
  verifier(apres?.[0]?.niveau_assurance === "aal2", "la session est montee en aal2", apres?.[0]?.niveau_assurance);

  const { data: fermee } = await client.rpc("auth_lire_session", {
    p_empreinte: empreinteHexa(ailleurs.jetonSession),
  });
  verifier(
    (fermee?.length ?? 0) === 0 || fermee[0].revoked_at !== null,
    "la session ouverte avant l enrolement n est plus utilisable",
  );

  // Le facteur est retiré : le compte est supprimé juste après, mais on ne
  // laisse pas traîner un facteur chez le fournisseur si la suppression
  // échouait.
  const finaux = (await jetonsDe(courante.jetonSession)) ?? jetons;
  try {
    await fournisseur.retirerFacteur(finaux, enrolement.facteurId);
  } catch {
    /* le compte disparaît de toute façon au nettoyage */
  }

  console.log("  (le secret TOTP n a ete ni affiche, ni ecrit, ni journalise)");
}

/* ========================================================================== */
/* 4. Import de rentrée                                                        */
/* ========================================================================== */

async function importRentree(contexte) {
  console.log("\n4. Import de rentree");

  const client = service();

  const { data: annee } = await client.rpc("etab_assurer_annee", {
    p_acteur: contexte.administrateur,
    p_label: "2026-2027",
    p_debut: "2026-09-01",
    p_fin: "2027-07-15",
  });
  verifier(typeof annee === "string", "annee scolaire preparee");

  const csv = Buffer.from(
    "Nom;Prénom;Classe\nDurand;Amélie;Seconde 1\nBernard;Jean;Seconde 1\nPetit;Léa;Seconde 2\n",
    "utf8",
  );
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes));

  verifier(analyse.resume.valides === 3, "trois lignes exploitables lues", `${analyse.resume.valides}`);
  verifier(analyse.classes.length === 2, "deux classes distinctes detectees", analyse.classes.join(", "));

  // On passe par `appliquerImport`, la fonction que l'action serveur appelle :
  // création des comptes chez le fournisseur, écriture en base, retour arrière
  // en cas d'échec, fiches d'accès et journalisation comprises.
  const resultat = await appliquerImport({
    acteur: contexte.administrateur,
    annee,
    domaineAlias: process.env.STUDENT_ALIAS_DOMAIN,
    // Les identifiants proposés sont suffixés pour ne pas entrer en collision
    // avec ceux d'une exécution précédente restée en base.
    lignes: analyse.valides.map((ligne) => ({ ...ligne, login: `${ligne.login}${SUFFIXE}` })),
    nomFichier: "recette.csv",
  });

  verifier(resultat.crees === 3, "les trois eleves sont crees", `${resultat.crees} cree(s)`);
  verifier(resultat.echecs.length === 0, "aucun echec de creation", JSON.stringify(resultat.echecs));
  verifier(resultat.acces.length === 3, "trois fiches d acces rendues, une seule fois");
  verifier(
    resultat.acces.every((a) => a.motDePasseTemporaire.length >= 16),
    "chaque fiche porte un mot de passe temporaire long",
  );

  // On retrouve l'identifiant interne de chaque élève pour le nettoyage et
  // pour la vérification d'isolation.
  const { data: membres } = await client.rpc("etab_membres", {
    p_acteur: contexte.administrateur,
    p_limite: 100,
  });

  const eleves = resultat.acces.map((acces) => {
    const membre = (membres ?? []).find((m) => m.local_login === acces.login);
    if (membre !== undefined) aNettoyer.profils.push(membre.profile_id);
    return {
      profil: membre?.profile_id,
      login: acces.login,
      secret: acces.motDePasseTemporaire,
      classe: acces.classe,
      resultat: "cree",
    };
  });

  const { data: classes } = await client.rpc("etab_classes", { p_acteur: contexte.administrateur });
  const resume = (classes ?? []).map((c) => `${c.label}:${c.effectif}`).sort().join(" ");
  verifier(
    resume === "Seconde 1:2 Seconde 2:1",
    "deux classes de meme niveau restent independantes",
    resume,
  );

  // Reimport : aucun doublon.
  const premiere = eleves[0];
  const aliasBis = `${randomBytes(8).toString("hex")}@${process.env.STUDENT_ALIAS_DOMAIN}`;
  const compteBis = await client.auth.admin.createUser({
    email: aliasBis,
    password: `Eleve-${randomBytes(8).toString("hex")}`,
    email_confirm: true,
  });
  const { data: rejeu } = await client.rpc("etab_importer_eleve", {
    p_acteur: contexte.administrateur,
    p_annee: annee,
    p_profile: compteBis.data.user.id,
    p_prenom: "Amélie",
    p_nom: "Durand",
    p_login: premiere.login,
    p_alias: aliasBis,
    p_classe_label: "Seconde 1",
    p_identifiant_externe: null,
  });
  verifier(rejeu === "existant", "un reimport ne cree pas de doublon", String(rejeu));
  await client.auth.admin.deleteUser(compteBis.data.user.id).catch(() => undefined);

  return eleves;
}

/* ========================================================================== */
/* 5. Isolation vérifiée par RLS, avec une vraie session d'élève               */
/* ========================================================================== */

async function isolation(contexte, eleves) {
  console.log("\n5. Isolation, verifiee sous RLS avec une vraie session d eleve");

  const client = service();
  const eleve = eleves.find((e) => e.classe === "Seconde 1");

  // Avant activation : la session ne donne acces a rien.
  const connexionAvant = await seConnecter(contexte.code, eleve.login, eleve.secret);
  verifier(connexionAvant.reussi === true, "l eleve se connecte avec son mot de passe temporaire");
  verifier(connexionAvant.activationRequise === true, "l eleve doit choisir son mot de passe");

  const jetonAvant = await jetonAccesDe(connexionAvant.jetonSession);
  const avant = await lireAvecJeton(jetonAvant, "classes", "label");
  verifier(avant.length === 0, "avant activation, l eleve ne lit aucune classe", `${avant.length} ligne(s)`);

  // Activation, puis lecture reelle sous RLS.
  const nouveau = `phrase eleve ${randomBytes(6).toString("hex")}`;
  await changerMotDePasse(jetonAvant, nouveau);
  await client.rpc("auth_activer_compte", {
    p_profile: eleve.profil,
    p_organization: contexte.organisation,
    p_session_conservee: empreinteHexa(connexionAvant.jetonSession),
  });

  const connexionApres = await seConnecter(contexte.code, eleve.login, nouveau);
  verifier(connexionApres.reussi === true, "l eleve se reconnecte apres activation");
  verifier(connexionApres.portee === "etablissement", "session d etablissement", connexionApres.portee);

  const jetonApres = await jetonAccesDe(connexionApres.jetonSession);
  const classes = await lireAvecJeton(jetonApres, "classes", "label");

  verifier(
    classes.length === 1 && classes[0].label === "Seconde 1",
    "l eleve de Seconde 1 ne voit que sa classe",
    classes.map((c) => c.label).join(", ") || "aucune",
  );

  const demandes = await lireAvecJeton(jetonApres, "commercial_requests", "contact_email");
  verifier(demandes.length === 0, "un eleve ne lit aucune demande commerciale");

  const organisations = await lireAvecJeton(jetonApres, "organizations", "name");
  verifier(
    organisations.length <= 1,
    "un eleve ne voit au plus que son etablissement",
    `${organisations.length}`,
  );

  await new DepotSupabase().effacerEchecs(eleve.profil);
}

async function lireAvecJeton(jeton, table, colonnes) {
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  const { data } = await client.from(table).select(colonnes).limit(50);
  return data ?? [];
}

/* ========================================================================== */
/* 6. Journal d'audit                                                          */
/* ========================================================================== */

async function journal(proprietaire) {
  console.log("\n6. Journal d audit");

  const { data } = await service().rpc("admin_journal", { p_acteur: proprietaire, p_limite: 100 });
  const actions = new Set((data ?? []).map((e) => e.action));

  verifier(actions.has("amorcage_exploitant"), "amorcage du proprietaire journalise");
  verifier(actions.has("creation_etablissement"), "creation d etablissement journalisee");
  verifier(actions.has("creation_administrateur"), "creation d administrateur journalisee");
  verifier(actions.has("creation_classe"), "creation de classe journalisee");
  verifier(actions.has("import_rentree"), "import de rentree journalise");
  verifier(actions.has("changement_etat_etablissement"), "changement d etat journalise");
}

/* ========================================================================== */
/* Nettoyage                                                                   */
/* ========================================================================== */

async function nettoyer() {
  console.log("\n7. Nettoyage des donnees de recette");

  const client = service();

  const sql = new pg.Client({
    connectionString: process.env.WORKER_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    application_name: "avecstudy-nettoyage",
  });
  await sql.connect();

  const trace = (ligne) => console.log(ligne);

  try {
    for (const organisation of aNettoyer.organisations) {
      await demonterEtablissement(sql, organisation, { trace });
    }
    await demonterProfils(sql, aNettoyer.profils, { trace });
    await demonterDemandes(sql, { trace });

    // Les comptes de connexion vivent chez le fournisseur, pas en base : les
    // oublier laisserait des identifiants actifs sans profil en face.
    for (const profil of aNettoyer.profils) {
      await client.auth.admin.deleteUser(profil).catch(() => undefined);
    }

    // Le contrôle qui donne sa valeur au reste. Sans lui, un nettoyage
    // inopérant se raconte comme un succes — c'est exactement ce qui s'est
    // produit avant que ce controle existe.
    const restes = await residuDeRecette(sql, {
      organisations: aNettoyer.organisations,
      profils: aNettoyer.profils,
    });

    if (restes.length > 0) {
      echecs += 1;
      console.log("  CRITIQUE : la recette a laisse des traces en production :");
      for (const reste of restes) console.log(`    - ${reste}`);
      console.log("  Les supprimer avant toute autre chose.");
    } else {
      console.log(
        `  ${aNettoyer.demandes.length} demande(s), ${aNettoyer.organisations.length} etablissement(s), ` +
          `${aNettoyer.profils.length} compte(s) supprimes — verifie, plus rien ne reste.`,
      );
    }
  } catch (erreur) {
    echecs += 1;
    console.log(`  CRITIQUE : le nettoyage a echoue — ${erreur.message}`);
  } finally {
    await sql.end().catch(() => {});
  }
}

/* ========================================================================== */

let proprietaire = null;
try {
  proprietaire = await connexionProprietaire();
  await demandeDeDevis();

  if (proprietaire !== null) {
    const contexte = await parcoursEtablissement(proprietaire);
    if (contexte !== null) {
      await secondFacteur(contexte, contexte.motDePasse);
      const eleves = await importRentree(contexte);
      await isolation(contexte, eleves);
      await journal(proprietaire);
    }
  }
} catch (erreur) {
  echecs += 1;
  console.log(`\n  ERREUR INATTENDUE : ${erreur.message}`);
} finally {
  await nettoyer();
}

console.log("\n" + "-".repeat(72));
console.log(echecs === 0 ? "Recette reelle : aucun defaut." : `Recette reelle : ${echecs} defaut(s).`);
process.exitCode = echecs === 0 ? 0 : 1;

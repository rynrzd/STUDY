#!/usr/bin/env node
// =============================================================================
// Vérification du branchement Supabase — AvecStudy
//
//   npm run verifier:base
//
// Répond à trois questions, dans l'ordre où elles bloquent :
//
//   1. L'API du projet répond-elle ? (clé publiable, clé de service)
//   2. Le schéma « study » est-il exposé à PostgREST ?
//   3. La connexion PostgreSQL fonctionne-t-elle, et par quel hôte ?
//
// Aucune clé, aucun mot de passe et aucune URL complète n'est affiché : ce
// script sert à diagnostiquer, pas à recopier des secrets dans un terminal
// partagé ou une capture d'écran.
//
// Le point 3 mérite une explication. `db.<ref>.supabase.co` ne publie plus
// d'enregistrement A : il est joignable en IPv6 uniquement. Une machine sans
// route IPv6 — la plupart des connexions françaises grand public — ne peut
// donc PAS l'atteindre, et voit un délai d'attente qui ressemble à une panne.
// Le pooler Supavisor, lui, répond en IPv4. Ce script trouve le bon hôte de
// pooler tout seul, et distingue clairement « mauvaise région » de « mot de
// passe refusé ».
// =============================================================================

import { Resolver } from "node:dns/promises";
import pg from "pg";
import { chargerEnv, titre } from "./_commun.mjs";

const REGIONS = [
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "sa-east-1", "ca-central-1",
];

const etat = { api: false, schema: false, base: false };

function ligne(ok, texte, detail) {
  console.log(`[${ok ? "OK  " : "NON "}] ${texte}${detail ? `\n         ${detail}` : ""}`);
}

async function principal() {
  chargerEnv();

  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.error("SUPABASE_URL absente. Renseigner .env.local avant de relancer.");
    process.exit(1);
  }

  const ref = new URL(url).hostname.split(".")[0];
  titre(`AvecStudy — verification du branchement Supabase\nprojet : ${ref}`);

  await verifierApi(url);
  await verifierSchema(url);
  await verifierBase(ref);

  console.log("\n" + "-".repeat(72));
  if (etat.api && etat.schema && etat.base) {
    console.log("Tout est en place. `npm run migrations:appliquer` peut etre lance.");
    process.exit(0);
  }

  console.log("Il reste des points a regler, listes ci-dessus.");
  process.exit(1);
}

/* -------------------------------------------------------------------------- */

async function verifierApi(url) {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) return ligne(false, "Cle de service absente (SUPABASE_SECRET_KEY)");

  try {
    const reponse = await fetch(new URL("/auth/v1/admin/users?page=1&per_page=1", url), {
      headers: { apikey: cle, authorization: `Bearer ${cle}` },
    });

    if (!reponse.ok) {
      return ligne(false, `API d'administration refusee (HTTP ${reponse.status})`,
        "La cle de service est invalide, ou le projet est en pause.");
    }

    const donnees = await reponse.json();
    etat.api = true;
    ligne(true, "API du projet joignable",
      `${donnees.users?.length ?? 0} compte(s) sur la premiere page d'authentification.`);
  } catch (erreur) {
    ligne(false, "API du projet injoignable", erreur.message);
  }
}

async function verifierSchema(url) {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) return;

  try {
    const reponse = await fetch(new URL("/rest/v1/organizations?select=id&limit=1", url), {
      headers: {
        apikey: cle,
        authorization: `Bearer ${cle}`,
        "accept-profile": "study",
      },
    });

    if (reponse.ok) {
      etat.schema = true;
      return ligne(true, "Schema « study » expose a PostgREST");
    }

    const corps = await reponse.json().catch(() => ({}));

    if (corps.code === "PGRST106") {
      return ligne(false, "Schema « study » NON expose",
        "Supabase > Settings > API > Exposed schemas : ajouter « study ».\n" +
        "         Ne jamais y ajouter « study_prive ».");
    }

    if (corps.code === "42P01" || reponse.status === 404) {
      return ligne(false, "Schema expose mais tables absentes",
        "Les migrations n'ont pas encore ete appliquees.");
    }

    ligne(false, `Schema « study » : reponse inattendue (HTTP ${reponse.status})`,
      corps.message ?? "");
  } catch (erreur) {
    ligne(false, "Schema « study » : verification impossible", erreur.message);
  }
}

async function verifierBase(ref) {
  const brut = process.env.WORKER_DATABASE_URL;
  if (!brut) {
    return ligne(false, "WORKER_DATABASE_URL absente",
      "Facultative pour faire tourner l'application, indispensable pour migrer.");
  }

  const forme = /^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/(.+)$/.exec(brut);
  if (forme === null) {
    return ligne(false, "WORKER_DATABASE_URL mal formee",
      "Attendu : postgresql://UTILISATEUR:MOTDEPASSE@HOTE:PORT/postgres");
  }

  const [, utilisateur, motDePasse, hote, port, base] = forme;

  if (/^\[.*\]$/.test(motDePasse) || motDePasse.includes("[")) {
    return ligne(false, "Le mot de passe contient encore des crochets",
      "Le gabarit [YOUR-PASSWORD] n'a pas ete entierement remplace.");
  }

  // --- L'hôte direct est-il joignable depuis cette machine ? ---------------
  if (/^db\..*\.supabase\.co$/.test(hote)) {
    const resolveur = new Resolver();
    let ipv4 = [];
    try {
      ipv4 = await resolveur.resolve4(hote);
    } catch {
      ipv4 = [];
    }

    if (ipv4.length === 0) {
      ligne(false, "Hote direct joignable en IPv6 uniquement",
        "Cette machine n'a probablement pas de route IPv6 : la connexion expirera.\n" +
        "         Utiliser le pooler, cherche ci-dessous.");
    }
  }

  // --- Essai direct --------------------------------------------------------
  if (await essayer("hote declare", { hote, port: Number(port), utilisateur, motDePasse, base })) {
    return;
  }

  // --- Recherche du pooler -------------------------------------------------
  console.log("         recherche du pooler IPv4 correspondant…");
  const identifiantPooler = `postgres.${ref}`;
  let regionTrouvee = null;

  for (const prefixe of ["aws-1", "aws-0"]) {
    for (const region of REGIONS) {
      const hotePooler = `${prefixe}-${region}.pooler.supabase.com`;
      const resultat = await tenter({
        hote: hotePooler,
        port: 5432,
        utilisateur: identifiantPooler,
        motDePasse,
        base: "postgres",
      });

      if (resultat.connecte) {
        etat.base = true;
        return ligne(true, `Base joignable par le pooler ${hotePooler}`,
          `Mettre cette URL dans WORKER_DATABASE_URL :\n` +
          `         postgresql://${identifiantPooler}:MOTDEPASSE@${hotePooler}:5432/postgres`);
      }

      if (resultat.mauvaisMotDePasse) regionTrouvee = hotePooler;
    }
  }

  if (regionTrouvee !== null) {
    return ligne(false, "Mot de passe de la base refuse",
      `Le projet est bien sur ${regionTrouvee} — l'hote est donc trouve.\n` +
      "         Seul le mot de passe est faux. Le reinitialiser dans\n" +
      "         Supabase > Settings > Database > Reset database password,\n" +
      `         puis ecrire dans .env.local :\n` +
      `         WORKER_DATABASE_URL=postgresql://${identifiantPooler}:LE_NOUVEAU@${regionTrouvee}:5432/postgres`);
  }

  ligne(false, "Aucun hote n'a accepte la connexion",
    "Verifier que le projet n'est pas en pause dans le tableau de bord Supabase.");
}

async function essayer(nom, options) {
  const resultat = await tenter(options);
  if (resultat.connecte) {
    etat.base = true;
    ligne(true, `Base joignable (${nom})`, `utilisateur ${resultat.utilisateur}`);
    return true;
  }
  ligne(false, `Base injoignable (${nom})`, resultat.message);
  return false;
}

async function tenter({ hote, port, utilisateur, motDePasse, base }) {
  const client = new pg.Client({
    host: hote,
    port,
    user: utilisateur,
    password: motDePasse,
    database: base.split("?")[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    application_name: "avecstudy-verification",
  });

  try {
    await client.connect();
    const { rows } = await client.query("select current_user");
    await client.end();
    return { connecte: true, utilisateur: rows[0].current_user };
  } catch (erreur) {
    await client.end().catch(() => undefined);
    const message = erreur.message ?? "erreur inconnue";
    return {
      connecte: false,
      message,
      mauvaisMotDePasse: /password authentication failed/i.test(message),
      mauvaisLocataire: /tenant or user not found/i.test(message),
    };
  }
}

principal().catch((erreur) => {
  console.error(`verification : ${erreur.message}`);
  process.exit(1);
});

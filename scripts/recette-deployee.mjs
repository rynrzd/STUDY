#!/usr/bin/env node
// =============================================================================
// Recette de bout en bout sur le site DÉPLOYÉ — `npm run recette:deployee`
//
// Dépose une vraie demande de devis depuis le déploiement, exactement comme le
// ferait un navigateur **sans JavaScript** : on renvoie les champs cachés que
// Next place dans le formulaire pour l'amélioration progressive, et le serveur
// exécute l'action. Puis on vérifie que la ligne est bien arrivée dans
// Supabase, et on la supprime.
//
// C'est le seul contrôle qui traverse toute la chaîne déployée : la page,
// l'anti-spam, le garde-fou CSRF, l'action serveur, les variables
// d'environnement de l'hébergeur, la clé de service et la base. Un `200` sur
// la page d'accueil ne prouve rien de tout cela.
//
// Réglage dans .env.local :
//   SITE_BASE=https://…            (déploiement à recetter)
//   VERCEL_AUTOMATION_BYPASS_SECRET=…  (si le déploiement est protégé)
//
// Aucun secret n'est affiché.
// =============================================================================

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chargerEnv, titre, exiger, abandonner } from "./_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");
if (BASE === "") {
  abandonner("SITE_BASE absente : indiquer l'adresse du deploiement a recetter.", ["SITE_BASE"]);
}

exiger(
  ["SUPABASE_URL", "SUPABASE_SECRET_KEY"],
  "verifier que la demande est bien arrivee demande un acces lecture a la base.",
);

const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const ENTETES = BYPASS === "" ? {} : { "x-vercel-protection-bypass": BYPASS };

let echecs = 0;

function verifier(condition, texte, detail) {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  echecs += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

titre(`AvecStudy — recette du site deploye\n${BASE}`);

/* -------------------------------------------------------------------------- */
/* 1. La page et son formulaire                                                */
/* -------------------------------------------------------------------------- */

console.log("1. Page de demande");

const reponsePage = await fetch(`${BASE}/etablissements`, { headers: ENTETES });
if (!verifier(reponsePage.status === 200, "la page repond 200", `HTTP ${reponsePage.status}`)) {
  process.exit(1);
}

const html = await reponsePage.text();

// Les champs cachés que Next pose pour l'amélioration progressive. On les
// renvoie tels quels : c'est ce que fait un navigateur sans JavaScript.
const caches = new Map();
for (const balise of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const nom = /name="([^"]+)"/.exec(balise[0])?.[1];
  const valeur = /value="([^"]*)"/.exec(balise[0])?.[1] ?? "";
  if (nom !== undefined) caches.set(nom, decoderEntites(valeur));
}

verifier(
  [...caches.keys()].some((nom) => nom.startsWith("$ACTION")),
  "le formulaire fonctionne sans JavaScript",
  [...caches.keys()].join(", "),
);
verifier(caches.has("ouverture"), "jeton anti-spam present");

/* -------------------------------------------------------------------------- */
/* 2. L'anti-spam refuse un envoi instantané                                   */
/* -------------------------------------------------------------------------- */

console.log("\n2. Anti-spam");

const marque = randomBytes(3).toString("hex");
const courriel = `recette.deployee.${marque}@exemple.invalid`;

const champs = {
  etablissement: `Lycee de recette deployee ${marque}`,
  type: "public",
  commune: "Roubaix",
  contactNom: "Claude Martin",
  contactFonction: "Proviseur",
  contactEmail: courriel,
  contactTelephone: "",
  effectif: "900",
  besoin: "Depot de recette depuis le site deploye. A supprimer.",
  consentement: "oui",
};

const trop = await envoyer(caches, champs);
verifier(
  trop.includes("Rechargez") || trop.includes("verifi") || trop.includes("vérifi"),
  "un envoi instantane est refuse",
  extraireMessage(trop),
);

/* -------------------------------------------------------------------------- */
/* 3. Un envoi humain passe                                                    */
/* -------------------------------------------------------------------------- */

console.log("\n3. Depot d'une vraie demande");
console.log("   (attente de quatre secondes, comme une personne qui remplit le formulaire)");
await new Promise((resoudre) => setTimeout(resoudre, 4000));

// Le jeton d'ouverture du premier chargement a servi : on reprend la page pour
// en obtenir un neuf, comme le ferait quelqu'un qui recharge.
const secondHtml = await (await fetch(`${BASE}/etablissements`, { headers: ENTETES })).text();
const cachesNeufs = new Map();
for (const balise of secondHtml.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const nom = /name="([^"]+)"/.exec(balise[0])?.[1];
  const valeur = /value="([^"]*)"/.exec(balise[0])?.[1] ?? "";
  if (nom !== undefined) cachesNeufs.set(nom, decoderEntites(valeur));
}

await new Promise((resoudre) => setTimeout(resoudre, 4000));
const resultat = await envoyer(cachesNeufs, champs);

const reference = /AS-\d{4}-[A-Z2-9]{5}/.exec(resultat)?.[0] ?? null;
verifier(reference !== null, "le site rend une reference", extraireMessage(resultat));

/* -------------------------------------------------------------------------- */
/* 4. La demande est-elle réellement en base ?                                 */
/* -------------------------------------------------------------------------- */

console.log("\n4. Verification en base");

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

const { data, error } = await client
  .from("commercial_requests")
  .select("id, reference, establishment_name, state, source")
  .eq("contact_email", courriel);

if (error !== null) {
  verifier(false, "lecture en base", error.message);
} else if ((data?.length ?? 0) === 0) {
  verifier(
    false,
    "la demande est arrivee dans Supabase",
    "aucune ligne — verifier SUPABASE_URL et SUPABASE_SECRET_KEY chez l'hebergeur",
  );
} else {
  const ligne = data[0];
  verifier(true, `la demande est arrivee dans Supabase (${ligne.reference})`);
  verifier(
    reference === ligne.reference,
    "la reference affichee est celle enregistree",
    `affichee ${reference}, en base ${ligne.reference}`,
  );
  verifier(ligne.state === "nouvelle", "etat initial « nouvelle »", ligne.state);
  verifier(ligne.source === "site", "source « site »", ligne.source);

  await client.from("commercial_requests").delete().eq("id", ligne.id);
  console.log("  ok   ligne de recette supprimee");
}

console.log("\n" + "-".repeat(72));
if (echecs === 0) {
  console.log("Le site deploye ecrit reellement dans Supabase.");
  console.log("Les variables d'environnement de l'hebergeur sont bonnes.");
} else {
  console.log(`${echecs} defaut(s).`);
}
process.exitCode = echecs === 0 ? 0 : 1;

/* -------------------------------------------------------------------------- */

async function envoyer(cachesForm, visibles) {
  const corps = new FormData();
  for (const [nom, valeur] of cachesForm) corps.append(nom, valeur);
  for (const [nom, valeur] of Object.entries(visibles)) corps.append(nom, valeur);
  corps.append("organisme", ""); // champ leurre, laissé vide

  const reponse = await fetch(`${BASE}/etablissements`, {
    method: "POST",
    headers: { ...ENTETES, Origin: BASE },
    body: corps,
    redirect: "manual",
  });

  return reponse.text();
}

function extraireMessage(corps) {
  const message = /(Votre demande[^<"\\]{0,120}|Cette page[^<"\\]{0,120}|Le formulaire[^<"\\]{0,120}|Quelques informations[^<"\\]{0,120})/.exec(corps);
  return message ? message[1].trim() : `${corps.length} octets`;
}

function decoderEntites(valeur) {
  return valeur
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

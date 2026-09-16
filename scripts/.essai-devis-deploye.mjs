/**
 * Dépose une vraie demande de devis depuis le site DÉPLOYÉ, en appelant son
 * action serveur comme le ferait le navigateur, puis vérifie que la ligne est
 * bien arrivée dans Supabase — et la supprime.
 *
 * C'est le seul contrôle qui prouve que les variables d'environnement du projet
 * Vercel sont bonnes : il traverse la page, l'action serveur, la clé de service
 * et la base.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chargerEnv } from "./_commun.mjs";

chargerEnv();

const BASE = process.env.SITE_BASE;
const ENTETES = { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET };
const MARQUE = randomBytes(3).toString("hex");

/* --- 1. La page, et son jeton d'ouverture --------------------------------- */

const html = await (await fetch(`${BASE}/etablissements`, { headers: ENTETES })).text();
const ouverture = /name="ouverture"[^>]*value="([^"]*)"/.exec(html)?.[1];

if (!ouverture) {
  console.error("Aucun jeton d'ouverture sur la page deployee.");
  process.exit(1);
}
console.log("1. Page /etablissements servie, jeton d'ouverture present.");

/* --- 2. Identifiants d'action, lus dans le bundle -------------------------- */

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const ids = new Set();

for (const src of scripts) {
  const js = await (await fetch(new URL(src, BASE), { headers: ENTETES })).text();
  for (const m of js.matchAll(/"([0-9a-f]{40,42})"/g)) ids.add(m[1]);
}
console.log(`2. ${ids.size} identifiant(s) d'action trouve(s) dans le bundle.`);

/* --- 3. Le formulaire, envoyé comme le navigateur l'envoie ------------------ */

// L'anti-spam refuse un envoi en moins de trois secondes : on attend, comme
// une personne qui remplit le formulaire.
console.log("3. Attente de trois secondes (l'anti-spam refuse plus rapide)…");
await new Promise((resoudre) => setTimeout(resoudre, 3500));

const champs = {
  ouverture,
  organisme: "",
  etablissement: `Lycee de recette deployee ${MARQUE}`,
  type: "public",
  commune: "Roubaix",
  contactNom: "Claude Martin",
  contactFonction: "Proviseur",
  contactEmail: `recette.deployee.${MARQUE}@exemple.invalid`,
  contactTelephone: "",
  effectif: "900",
  besoin: "Depot de recette depuis le site deploye, a supprimer.",
  consentement: "oui",
};

let reponse = null;
let identifiantRetenu = null;

for (const id of ids) {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) corps.append(nom, valeur);

  const essai = await fetch(`${BASE}/etablissements`, {
    method: "POST",
    headers: { ...ENTETES, "Next-Action": id, Origin: BASE },
    body: corps,
    redirect: "manual",
  });

  if (essai.status === 200 || essai.status === 303) {
    const texte = await essai.text();
    if (texte.includes("etat") || texte.includes("reference") || texte.includes("AS-")) {
      reponse = texte;
      identifiantRetenu = id;
      break;
    }
  }
}

if (reponse === null) {
  console.error("\nAucune action serveur n'a accepte l'envoi.");
  console.error("Les identifiants essayes :", [...ids].join(", "));
  process.exit(1);
}

console.log(`4. Action serveur acceptee (${identifiantRetenu.slice(0, 12)}…).`);

const reference = /AS-\d{4}-[A-Z2-9]{5}/.exec(reponse)?.[0] ?? null;
console.log(`5. Reference rendue par le site deploye : ${reference ?? "(aucune)"}`);

/* --- 4. La ligne est-elle bien dans Supabase ? ----------------------------- */

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

const { data, error } = await client
  .from("commercial_requests")
  .select("id, reference, establishment_name, contact_email, state, source")
  .eq("contact_email", champs.contactEmail);

if (error !== null) {
  console.error(`6. Lecture en base impossible : ${error.message}`);
  process.exit(1);
}

if ((data?.length ?? 0) === 0) {
  console.error("\n6. AUCUNE ligne en base : le site deploye n'a pas pu ecrire dans Supabase.");
  console.error("   Verifier SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY et SUPABASE_SECRET_KEY");
  console.error("   dans les variables du projet Vercel.");
  process.exit(1);
}

const ligne = data[0];
console.log("6. Ligne trouvee dans Supabase :");
console.log(`     reference     : ${ligne.reference}`);
console.log(`     etablissement : ${ligne.establishment_name}`);
console.log(`     etat          : ${ligne.state}`);
console.log(`     source        : ${ligne.source}`);
console.log(
  reference !== null && reference === ligne.reference
    ? "     la reference affichee est bien celle enregistree"
    : "     ATTENTION : la reference affichee ne correspond pas a celle en base",
);

await client.from("commercial_requests").delete().eq("id", ligne.id);
console.log("7. Ligne de recette supprimee.");

console.log(
  "\n=> Le site deploye atteint Supabase. Les cles du projet Vercel sont bonnes.",
);

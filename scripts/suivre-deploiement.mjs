#!/usr/bin/env node
// =============================================================================
// Suit le déploiement Vercel d'un commit, sans accès à Vercel : Vercel publie
// l'état de chaque déploiement sur GitHub (API publique du dépôt).
//
//   node scripts/suivre-deploiement.mjs <sha> [--production] [--attendre]
//
// Affiche l'environnement, l'état (pending, in_progress, success, failure,
// error) et l'adresse du déploiement. --attendre relit toutes les 15 s jusqu'à
// un état final (20 minutes au plus). Ne déclenche, n'annule et ne promeut
// rien : le retour à la version précédente reste une action Vercel.
// =============================================================================

const DEPOT = "rynrzd/STUDY";
const [sha] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const production = process.argv.includes("--production");
const attendre = process.argv.includes("--attendre");
if (!/^[0-9a-f]{7,40}$/.test(sha ?? "")) {
  console.error("Usage : node scripts/suivre-deploiement.mjs <sha> [--production] [--attendre]");
  process.exit(1);
}

const api = async (chemin) => {
  const r = await fetch(`https://api.github.com/repos/${DEPOT}/${chemin}`, { headers: { accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
  return r.json();
};

// Le filtre de l'API exige le SHA complet.
const complet = (await api(`commits/${sha}`)).sha;
const FINAUX = new Set(["success", "failure", "error", "inactive"]);
const limite = Date.now() + 20 * 60_000;
for (;;) {
  const deploiements = (await api(`deployments?sha=${complet}&per_page=10`)).filter((d) => !production || d.environment === "Production");
  const lignes = [];
  let fini = deploiements.length > 0;
  for (const d of deploiements) {
    const [etat] = await api(`deployments/${d.id}/statuses?per_page=1`);
    lignes.push(`${d.environment.padEnd(10)} ${(etat?.state ?? "en attente").padEnd(11)} ${etat?.environment_url ?? ""}`);
    if (!FINAUX.has(etat?.state)) fini = false;
  }
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${sha.slice(0, 7)}\n  ${lignes.join("\n  ") || "aucun deploiement publie pour ce commit (encore)"}`);
  if (!attendre || fini || Date.now() > limite) {
    process.exitCode = lignes.some((l) => /failure|error/.test(l)) ? 1 : 0;
    break;
  }
  await new Promise((r) => setTimeout(r, 15_000));
}

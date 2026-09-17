import { createClient } from "@supabase/supabase-js";
import { chargerEnv } from "./_commun.mjs";
chargerEnv();

const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }, db: { schema: "study" },
});

const { data: orgs } = await c.from("organizations").select("id, name, public_code, state");
console.log("Etablissements :");
for (const o of orgs ?? []) console.log(`  ${o.public_code.padEnd(14)} ${o.state.padEnd(12)} ${o.name}`);

const { data: membres } = await c.from("organization_memberships")
  .select("organization_id, local_login, roles, account_state, state, must_change_password");
console.log("\nComptes :");
for (const m of membres ?? []) {
  const org = (orgs ?? []).find((o) => o.id === m.organization_id);
  console.log(`  ${(org?.public_code ?? "(hors etab)").padEnd(14)} ${m.local_login.padEnd(18)} ` +
    `roles=${String(m.roles)} compte=${m.account_state} adhesion=${m.state} mdp_a_changer=${m.must_change_password}`);
}

const { data: staff } = await c.from("editor_staff").select("profile_id, roles, state");
console.log("\nExploitation :", (staff ?? []).map((s) => `${s.roles}/${s.state}`).join(", ") || "(aucun)");

// Ce que fait reellement la resolution a la connexion, pour chaque compte.
console.log("\nResolution d identifiant (ce que voit la connexion) :");
for (const m of membres ?? []) {
  const org = (orgs ?? []).find((o) => o.id === m.organization_id);
  const code = org?.public_code ?? "AVECSTUDY";
  const { data, error } = await c.rpc("auth_resoudre_identifiant", {
    p_code: code, p_identifiant: m.local_login,
  });
  const ligne = Array.isArray(data) ? data[0] : null;
  console.log(`  ${code}/${m.local_login} -> ` +
    (error ? `ERREUR ${error.code}` : ligne ? `resolu (portee=${ligne.portee}, etat=${ligne.account_state})` : "AUCUNE LIGNE"));
}

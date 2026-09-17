import { createClient } from "@supabase/supabase-js";
import { chargerEnv } from "./_commun.mjs";

chargerEnv();

const password = process.env.NOUVEAU_MDP;

if (!password || password.length < 15) {
  console.error("ERREUR : mot de passe de 15 caractères minimum.");
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("ERREUR : configuration Supabase manquante.");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { error } = await supabase.auth.admin.updateUserById(
  "5e825fb1-9a8c-4979-a88d-54d4034db8d7",
  { password }
);

if (error) {
  console.error("ERREUR SUPABASE :", error.message);
  process.exit(1);
}

console.log("OK - Mot de passe AvecStudy modifie.");

import test from "node:test";
import assert from "node:assert/strict";
import { identifierProfesseur, type ProfesseurConnu } from "../../src/lib/identifier-professeur.ts";
import { erreurTailleDepot, TAILLE_MAX_DEPOT } from "../../src/lib/limites-depot.ts";
import { creerSignalementActivite } from "../../src/lib/signalement-activite.ts";

const prof: ProfesseurConnu = { profile_id: "prof-1", local_login: "lea.martin", prenom: "Léa", nom: "Martin", email: null };
test("réimport professeur sans email : réutilise son identité, y compris avec espaces et casse", () => {
  assert.equal(identifierProfesseur({ prenom: " LÉA ", nom: "Martin", email: null }, [prof]).profil?.profile_id, "prof-1");
});
test("réimport professeur : email stable malgré changement de nom", () => {
  assert.equal(identifierProfesseur({ prenom: "Léa", nom: "Durand", email: "LEA@EXAMPLE.TEST" }, [{ ...prof, email: "lea@example.test" }]).profil?.profile_id, "prof-1");
});
test("homonymes ou email contradictoire : pas de fusion arbitraire", () => {
  assert.ok(identifierProfesseur(prof, [prof, { ...prof, profile_id: "prof-2" }]).erreur);
  assert.ok(identifierProfesseur({ ...prof, email: "autre@example.test" }, [{ ...prof, email: "lea@example.test" }]).erreur);
  const parEmail = identifierProfesseur({ ...prof, email: "autre@example.test" }, [prof, { ...prof, profile_id: "prof-2", email: "autre@example.test" }]);
  assert.equal(parEmail.profil?.profile_id, "prof-2");
});
test("nouveau professeur : création possible sans correspondance", () => {
  assert.deepEqual(identifierProfesseur({ prenom: "Paul", nom: "Durand", email: null }, [prof]), { profil: null, erreur: null });
});
test("transport : fichier de plus de 1 Mo et jusqu’à 4 Mo accepté", () => {
  const f = new FormData();
  f.set("fichier", new File([new Uint8Array(TAILLE_MAX_DEPOT)], "cours.pdf"));
  assert.equal(erreurTailleDepot(f), null);
});
test("transport : contrôle du cumul avant envoi et conservation des fichiers", () => {
  const f = new FormData();
  f.append("fichiers", new File([new Uint8Array(2_500_000)], "classe-a.xlsx"));
  f.append("fichiers", new File([new Uint8Array(2_500_000)], "classe-b.xlsx"));
  assert.match(erreurTailleDepot(f)!, /4 Mo/);
  assert.equal(f.getAll("fichiers").length, 2);
});
test("transport : les champs volumineux comptent aussi", () => {
  const f = new FormData();
  f.set("fichier", new File([new Uint8Array(TAILLE_MAX_DEPOT)], "cours.pdf"));
  f.set("texte", "é".repeat(200_000));
  assert.ok(erreurTailleDepot(f));
});

test("session : pas de ping sans geste, en arrière-plan ou synthétique ; gestes limités à un par minute", async () => {
  let temps = 0;
  let visible = true;
  let appels = 0;
  const signaler = creerSignalementActivite({ visible: () => visible, maintenant: () => temps, envoyer: async () => { appels++; return { status: 204, ok: true }; } });
  assert.equal(appels, 0);
  await signaler({ isTrusted: false });
  visible = false;
  await signaler({ isTrusted: true });
  assert.equal(appels, 0);
  visible = true;
  await signaler({ isTrusted: true });
  temps = 59_999;
  await signaler({ isTrusted: true });
  assert.equal(appels, 1);
  temps = 60_000;
  await signaler({ isTrusted: true });
  assert.equal(appels, 2);
});

test("session : une panne se réessaie sur un prochain geste, une session expirée ne se réveille pas", async () => {
  let temps = 0;
  let appels = 0;
  const signaler = creerSignalementActivite({ visible: () => true, maintenant: () => temps, envoyer: async () => ({ status: ++appels === 1 ? 503 : 401, ok: false }) });
  await signaler({ isTrusted: true });
  temps = 5000;
  await signaler({ isTrusted: true });
  temps = 120_000;
  await signaler({ isTrusted: true });
  assert.equal(appels, 2);
});

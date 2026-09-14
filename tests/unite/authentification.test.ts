// =============================================================================
// Tests unitaires — connexion BFF (ch. 37, AUTH-03) et chiffrement du magasin
// de sessions.
//
// Ces tests s'exécutent sans Supabase : le fournisseur d'identité et le dépôt
// sont remplacés par des doublures. Ce qu'ils prouvent est justement ce qui ne
// dépend pas du fournisseur — la non-divulgation, le blocage d'activation, la
// limitation des tentatives, et le fait qu'aucun secret ne fuite.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  tenterConnexion,
  delaiApresEchecs,
  messageDeRefus,
  SEUIL_ECHECS,
  type DepotAuthentification,
  type IdentiteResolue,
  type SessionACreer,
} from "../../src/lib/authentification.ts";
import {
  FournisseurAbsent,
  FournisseurNonConfigure,
  genererAliasTechnique,
  aliasEstOpaque,
  genererMotDePasseTemporaire,
  type FournisseurIdentite,
  type ResultatVerification,
} from "../../src/lib/identite.ts";
import {
  chiffrer,
  dechiffrer,
  lireCles,
  versionDe,
  egalConstant,
  ChiffrementImpossible,
} from "../../src/lib/chiffrement.ts";

/* -------------------------------------------------------------------------- */
/* Doublures                                                                  */
/* -------------------------------------------------------------------------- */

const IDENTITE_ACTIVE: IdentiteResolue = {
  profileId: "aaaaaaaa-2222-4000-8000-000000000001",
  organizationId: "aaaaaaaa-0000-4000-8000-000000000001",
  alias: "a1f4c8e2b9d7f0a3@eleves.exemple.invalid",
  mustChangePassword: false,
  accountState: "actif",
  membershipState: "active",
  mfaObligatoire: false,
};

const CLES = lireCles({ SESSION_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
const chiffrerPourTest = (clair: string) => chiffrer(clair, CLES);

class DepotDoublure implements DepotAuthentification {
  identite: IdentiteResolue | null = IDENTITE_ACTIVE;
  echecs = 0;
  sessionsCreees: SessionACreer[] = [];
  echecsEnregistres: Array<{ profileId: string | null; code: string }> = [];
  appelsResolution = 0;

  async resoudreIdentifiant(): Promise<IdentiteResolue | null> {
    this.appelsResolution += 1;
    return this.identite;
  }

  async compterEchecsRecents(): Promise<number> {
    return this.echecs;
  }

  async enregistrerEchec(profileId: string | null, code: string): Promise<void> {
    this.echecsEnregistres.push({ profileId, code });
  }

  async creerSession(session: SessionACreer): Promise<string> {
    this.sessionsCreees.push(session);
    return "session-creee";
  }

  async revoquerSessions(): Promise<void> {}
}

class FournisseurDoublure implements FournisseurIdentite {
  secretAttendu = "bon-mot-de-passe-assez-long";
  niveau: "aal1" | "aal2" = "aal1";
  identitesVerifiees: string[] = [];

  disponible(): boolean {
    return true;
  }

  async verifierSecret(identite: string, secret: string): Promise<ResultatVerification> {
    this.identitesVerifiees.push(identite);
    if (secret !== this.secretAttendu) return { reussi: false };
    return {
      reussi: true,
      identifiantFournisseur: "fournisseur-123",
      jetons: {
        accessToken: "access-token-de-test",
        refreshToken: "refresh-token-de-test",
        expireLe: new Date("2026-09-14T12:00:00Z"),
        niveauAssurance: this.niveau,
      },
    };
  }

  async creerCompte(): Promise<string> {
    return "fournisseur-123";
  }
  async revoquerSessions(): Promise<void> {}
  async renouveler(): Promise<never> {
    throw new Error("non utilise dans ces tests");
  }
}

function options(surcharge: Partial<Parameters<typeof tenterConnexion>[0]> = {}) {
  return {
    codeEtablissement: "TESTA1",
    identifiant: "rayan.dupont",
    secret: "bon-mot-de-passe-assez-long",
    appareil: "personnel" as const,
    ...surcharge,
  };
}

/* -------------------------------------------------------------------------- */
/* Non-divulgation                                                            */
/* -------------------------------------------------------------------------- */

test("un identifiant inconnu et un mot de passe faux donnent exactement le meme refus", async () => {
  const fournisseur = new FournisseurDoublure();

  const inconnu = new DepotDoublure();
  inconnu.identite = null;
  const refusInconnu = await tenterConnexion(options(), {
    depot: inconnu, fournisseur, chiffrer: chiffrerPourTest,
  });

  const mauvaisSecret = new DepotDoublure();
  const refusSecret = await tenterConnexion(options({ secret: "mauvais" }), {
    depot: mauvaisSecret, fournisseur, chiffrer: chiffrerPourTest,
  });

  assert.deepEqual(refusInconnu, refusSecret, "les deux refus sont indiscernables");
  assert.equal(refusInconnu.reussi, false);
  assert.equal(messageDeRefus(refusInconnu as never), messageDeRefus(refusSecret as never));
});

test("un identifiant inconnu declenche quand meme une verification, pour ne pas repondre plus vite", async () => {
  const depot = new DepotDoublure();
  depot.identite = null;
  const fournisseur = new FournisseurDoublure();

  await tenterConnexion(options(), { depot, fournisseur, chiffrer: chiffrerPourTest });

  assert.equal(fournisseur.identitesVerifiees.length, 1,
    "le fournisseur est sollicite meme pour un compte inconnu");
  assert.ok(!fournisseur.identitesVerifiees[0]!.includes("rayan.dupont"),
    "l identifiant saisi n est pas transmis tel quel");
});

test("un compte suspendu ou sorti donne le meme refus quun mot de passe faux", async () => {
  const fournisseur = new FournisseurDoublure();

  for (const etat of ["suspendu", "sorti", "en_suppression"] as const) {
    const depot = new DepotDoublure();
    depot.identite = { ...IDENTITE_ACTIVE, accountState: etat };

    const resultat = await tenterConnexion(options(), {
      depot, fournisseur, chiffrer: chiffrerPourTest,
    });

    assert.equal(resultat.reussi, false, etat);
    assert.equal((resultat as { motif: string }).motif, "identifiants_invalides",
      `${etat} ne doit pas se distinguer`);
    assert.equal(depot.sessionsCreees.length, 0, "aucune session creee");
  }
});

test("une adhesion terminee ne permet pas de se connecter", async () => {
  const depot = new DepotDoublure();
  depot.identite = { ...IDENTITE_ACTIVE, membershipState: "terminee" };

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, false);
  assert.equal(depot.sessionsCreees.length, 0);
});

/* -------------------------------------------------------------------------- */
/* Activation                                                                 */
/* -------------------------------------------------------------------------- */

test("un compte a activer ouvre une session dactivation, et rien dautre", async () => {
  const depot = new DepotDoublure();
  depot.identite = {
    ...IDENTITE_ACTIVE, mustChangePassword: true, accountState: "a_activer",
  };

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, true);
  const succes = resultat as { portee: string; activationRequise: boolean; dureeSecondes: number };
  assert.equal(succes.portee, "activation");
  assert.equal(succes.activationRequise, true);

  const session = depot.sessionsCreees[0]!;
  assert.equal(session.scope, "activation");
  // Fenêtre courte : une session d'activation ne traîne pas.
  assert.ok(succes.dureeSecondes <= 3600, "au plus une heure");
});

test("un compte active ouvre une session detablissement de duree normale", async () => {
  const depot = new DepotDoublure();

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, true);
  const succes = resultat as { portee: string; activationRequise: boolean };
  assert.equal(succes.portee, "etablissement");
  assert.equal(succes.activationRequise, false);
  assert.equal(depot.sessionsCreees[0]!.scope, "etablissement");
});

/* -------------------------------------------------------------------------- */
/* Session : ce qui est stocké, et ce qui ne l'est pas                        */
/* -------------------------------------------------------------------------- */

test("la session stocke une empreinte, jamais le jeton ni les secrets", async () => {
  const depot = new DepotDoublure();

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, true);
  const jeton = (resultat as { jetonSession: string }).jetonSession;
  const session = depot.sessionsCreees[0]!;

  assert.equal(session.tokenSha256.length, 32);
  const serialise = JSON.stringify({ ...session, tokenSha256: session.tokenSha256.toString("hex") });

  assert.ok(!serialise.includes(jeton), "le jeton en clair n atteint jamais la base");
  assert.ok(!serialise.includes("bon-mot-de-passe-assez-long"), "le mot de passe non plus");
  assert.ok(!serialise.includes("access-token-de-test"), "les jetons du fournisseur sont chiffres");
  assert.ok(!serialise.includes("refresh-token-de-test"));

  // Ils restent dechiffrables par le serveur, evidemment.
  const clair = JSON.parse(dechiffrer(session.jetonsChiffres, CLES));
  assert.equal(clair.access, "access-token-de-test");
});

test("le niveau dassurance vient de la session, pas dune capacite du compte", async () => {
  const depotSansMfa = new DepotDoublure();
  depotSansMfa.identite = { ...IDENTITE_ACTIVE, mfaObligatoire: true };
  const fournisseurAal1 = new FournisseurDoublure();

  await tenterConnexion(options(), {
    depot: depotSansMfa, fournisseur: fournisseurAal1, chiffrer: chiffrerPourTest,
  });

  assert.equal(
    depotSansMfa.sessionsCreees[0]!.niveauAssurance,
    "aal1",
    "un compte soumis a MFA qui n a pas passe son second facteur reste en aal1",
  );

  const depotAvecMfa = new DepotDoublure();
  depotAvecMfa.identite = { ...IDENTITE_ACTIVE, mfaObligatoire: true };
  const fournisseurAal2 = new FournisseurDoublure();
  fournisseurAal2.niveau = "aal2";

  await tenterConnexion(options(), {
    depot: depotAvecMfa, fournisseur: fournisseurAal2, chiffrer: chiffrerPourTest,
  });

  assert.equal(depotAvecMfa.sessionsCreees[0]!.niveauAssurance, "aal2");
});

test("un compte administratif recoit une fenetre plus courte, meme sur son appareil", async () => {
  const depot = new DepotDoublure();
  depot.identite = { ...IDENTITE_ACTIVE, mfaObligatoire: true };

  await tenterConnexion(options({ appareil: "personnel" }), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  const session = depot.sessionsCreees[0]!;
  const inactiviteMinutes =
    (session.idleExpiresAt.getTime() - Date.now()) / 60000;
  assert.ok(inactiviteMinutes <= 16, `${Math.round(inactiviteMinutes)} minutes : fenetre admin`);
});

test("un poste partage recoit une session plus courte", async () => {
  const depot = new DepotDoublure();

  await tenterConnexion(options({ appareil: "partage" }), {
    depot, fournisseur: new FournisseurDoublure(), chiffrer: chiffrerPourTest,
  });

  const session = depot.sessionsCreees[0]!;
  assert.equal(session.deviceKind, "partage");
  const inactiviteMinutes = (session.idleExpiresAt.getTime() - Date.now()) / 60000;
  assert.ok(inactiviteMinutes <= 31);
});

/* -------------------------------------------------------------------------- */
/* Limitation des tentatives (ABUSE-01)                                       */
/* -------------------------------------------------------------------------- */

test("la temporisation croit apres le seuil, et reste plafonnee", () => {
  assert.equal(delaiApresEchecs(0), 0);
  assert.equal(delaiApresEchecs(SEUIL_ECHECS - 1), 0, "sous le seuil, aucun delai");
  assert.equal(delaiApresEchecs(SEUIL_ECHECS), 30);
  assert.equal(delaiApresEchecs(SEUIL_ECHECS + 1), 60);
  assert.equal(delaiApresEchecs(SEUIL_ECHECS + 2), 120);
  assert.equal(delaiApresEchecs(SEUIL_ECHECS + 20), 900, "plafonne a 15 minutes");
});

test("au-dela du seuil, le fournisseur nest plus sollicite du tout", async () => {
  const depot = new DepotDoublure();
  depot.echecs = SEUIL_ECHECS;
  const fournisseur = new FournisseurDoublure();

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur, chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, false);
  assert.equal((resultat as { motif: string }).motif, "trop_de_tentatives");
  assert.ok((resultat as { reprendreDansSecondes: number }).reprendreDansSecondes > 0);
  assert.equal(fournisseur.identitesVerifiees.length, 0,
    "study. ne sert pas d oracle de mots de passe");
});

/* -------------------------------------------------------------------------- */
/* Absence de fournisseur : erreur contrôlée, jamais de repli                  */
/* -------------------------------------------------------------------------- */

test("sans fournisseur configure, la connexion echoue proprement et ne cree rien", async () => {
  const depot = new DepotDoublure();

  const resultat = await tenterConnexion(options(), {
    depot, fournisseur: new FournisseurAbsent(), chiffrer: chiffrerPourTest,
  });

  assert.equal(resultat.reussi, false);
  assert.equal((resultat as { motif: string }).motif, "service_indisponible");
  assert.equal(depot.sessionsCreees.length, 0);
  assert.equal(depot.appelsResolution, 0, "on n interroge meme pas la base");
});

test("le fournisseur absent explique ce qui manque plutot que de se rabattre ailleurs", async () => {
  const fournisseur = new FournisseurAbsent();
  await assert.rejects(
    () => fournisseur.verifierSecret("x", "y"),
    (erreur: unknown) => {
      assert.ok(erreur instanceof FournisseurNonConfigure);
      assert.match(erreur.message, /pas raccorde/);
      assert.match(erreur.message, /Aucun repli local/);
      return true;
    },
  );
});

/* -------------------------------------------------------------------------- */
/* Alias techniques et secrets temporaires                                    */
/* -------------------------------------------------------------------------- */

test("un alias technique est opaque et ne laisse rien deviner", () => {
  const alias = genererAliasTechnique("eleves.exemple.invalid");

  assert.match(alias, /^[a-f0-9]{16}@eleves\.exemple\.invalid$/);
  assert.ok(aliasEstOpaque(alias, ["Rayan", "Dupont", "Seconde 1"]));

  // Deux alias consecutifs different : ils ne sont pas derives de l identite.
  assert.notEqual(alias, genererAliasTechnique("eleves.exemple.invalid"));

  // Un alias bavard est rejete par le controle defensif.
  assert.ok(!aliasEstOpaque("rayan.dupont@eleves.exemple.invalid", ["Rayan"]));
  assert.ok(!aliasEstOpaque("seconde1eleve@eleves.exemple.invalid", ["Seconde1"]));
});

test("un domaine dalias douteux est refuse", () => {
  assert.throws(() => genererAliasTechnique("pas un domaine"), /invalide/);
  assert.throws(() => genererAliasTechnique("eleves@exemple.test"), /invalide/);
});

test("le mot de passe temporaire respecte le ch. 12", () => {
  const secret = genererMotDePasseTemporaire();

  assert.ok(secret.length >= 16, "au moins 16 caracteres");
  assert.doesNotMatch(secret, /[O0Il1]/, "pas de caracteres confondables sur une fiche imprimee");
  assert.notEqual(secret, genererMotDePasseTemporaire());
  assert.throws(() => genererMotDePasseTemporaire(12), /16 caracteres/);

  // Repartition : sur 200 tirages, on attend une grande diversite.
  const tirages = new Set(Array.from({ length: 200 }, () => genererMotDePasseTemporaire()));
  assert.equal(tirages.size, 200, "aucun doublon sur 200 tirages");
});

/* -------------------------------------------------------------------------- */
/* Chiffrement du magasin de sessions                                         */
/* -------------------------------------------------------------------------- */

test("le chiffrement est authentifie : une valeur alteree est refusee", () => {
  const scelle = chiffrer("jeton-sensible", CLES);
  assert.equal(dechiffrer(scelle, CLES), "jeton-sensible");

  const parties = scelle.split(".");
  const altere = Buffer.from(parties[2]!, "base64url");
  altere[0] = altere[0]! ^ 0xff;
  const falsifie = [parties[0], parties[1], altere.toString("base64url")].join(".");

  assert.throws(() => dechiffrer(falsifie, CLES), ChiffrementImpossible);
});

test("deux chiffrements du meme texte different", () => {
  assert.notEqual(chiffrer("identique", CLES), chiffrer("identique", CLES));
});

test("une rotation de cle laisse dechiffrer lancien", () => {
  const ancienne = randomBytes(32).toString("base64");
  const nouvelle = randomBytes(32).toString("base64");

  const clesV1 = lireCles({ SESSION_ENCRYPTION_KEY: ancienne, SESSION_ENCRYPTION_KEY_VERSION: "1" });
  const scelleV1 = chiffrer("jeton-d-avant-rotation", clesV1);
  assert.equal(versionDe(scelleV1), 1);

  const clesV2 = lireCles({
    SESSION_ENCRYPTION_KEY: nouvelle,
    SESSION_ENCRYPTION_KEY_VERSION: "2",
    SESSION_ENCRYPTION_KEY_PRECEDENTE: ancienne,
  });

  assert.equal(dechiffrer(scelleV1, clesV2), "jeton-d-avant-rotation",
    "pendant la rotation, les sessions existantes survivent");
  assert.equal(versionDe(chiffrer("nouveau", clesV2)), 2);

  // Sans l ancienne cle, la valeur d avant n est plus dechiffrable.
  const clesSeulesV2 = lireCles({
    SESSION_ENCRYPTION_KEY: nouvelle, SESSION_ENCRYPTION_KEY_VERSION: "2",
  });
  assert.throws(() => dechiffrer(scelleV1, clesSeulesV2), ChiffrementImpossible);
});

test("une cle absente ou mal dimensionnee echoue clairement", () => {
  assert.throws(() => lireCles({}), /SESSION_ENCRYPTION_KEY absente/);
  assert.throws(
    () => lireCles({ SESSION_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") }),
    /32 octets/,
  );
});

test("la comparaison a temps constant refuse les longueurs differentes", () => {
  assert.ok(egalConstant("TESTA1", "TESTA1"));
  assert.ok(!egalConstant("TESTA1", "TESTA2"));
  assert.ok(!egalConstant("TESTA1", "TESTA1-plus-long"));
  assert.ok(!egalConstant("", "x"));
});

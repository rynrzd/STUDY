import "server-only";

import {
  type EnrolementTotp,
  type FacteurTotp,
  type FournisseurIdentite,
  type JetonsFournisseur,
  type NiveauAssurance,
  type ResultatVerification,
} from "./identite.ts";
import { lireGroupe } from "./config.ts";
import { baseConfiguree, clientAuthentification, clientExploitation } from "./supabase-serveur.ts";

/**
 * Fournisseur d'identité Supabase — implémentation de l'interface du ch. 37.
 *
 * AvecStudy ne stocke aucun mot de passe. Cette classe est le seul endroit du
 * code qui en voit un passer, et elle le transmet immédiatement au fournisseur
 * sans le journaliser, le hacher localement ni le conserver.
 *
 * Le niveau d'assurance renvoyé vaut `aal1` après une vérification par mot de
 * passe seul — et il ne doit pas être surclassé ici. Un compte qui *peut*
 * faire du second facteur n'a pas *fait* de second facteur : c'est la session
 * qui porte le niveau, pas le compte.
 */
export class FournisseurSupabase implements FournisseurIdentite {
  disponible(): boolean {
    return baseConfiguree();
  }

  async verifierSecret(identite: string, secret: string): Promise<ResultatVerification> {
    const client = clientAuthentification();

    const { data, error } = await client.auth.signInWithPassword({
      email: identite,
      password: secret,
    });

    // Un échec ne dit pas pourquoi : identité inconnue, mot de passe faux et
    // compte désactivé chez le fournisseur donnent le même résultat.
    if (error !== null || data.session === null || data.user === null) {
      return { reussi: false };
    }

    const session = data.session;

    return {
      reussi: true,
      identifiantFournisseur: data.user.id,
      jetons: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expireLe: echeance(session.expires_at, session.expires_in),
        // Mot de passe seul : aal1. Le second facteur, quand il existera,
        // relèvera le niveau sur CETTE session, pas sur le compte.
        niveauAssurance: NIVEAU_MOT_DE_PASSE,
      },
    };
  }

  async creerCompte(
    identite: string,
    options: { motDePasseTemporaire: string },
  ): Promise<string> {
    const client = clientExploitation("administration_des_comptes");

    const { data, error } = await client.auth.admin.createUser({
      email: identite,
      password: options.motDePasseTemporaire,
      // Aucun courrier n'est envoyé : ni confirmation, ni invitation. L'adresse
      // d'un élève est un alias technique, pas une boîte aux lettres, et la
      // « confirmer » ne prouve rien — c'est nous qui l'avons fabriquée.
      email_confirm: true,
    });

    if (error !== null || data.user === null) {
      throw new Error(`Creation de compte refusee par le fournisseur (${error?.code ?? "inconnu"})`);
    }

    return data.user.id;
  }

  async revoquerSessions(identifiantFournisseur: string): Promise<void> {
    const client = clientExploitation("administration_des_comptes");
    // `signOut` global chez le fournisseur : les jetons d'accès déjà émis
    // cessent d'être renouvelables. La révocation qui compte immédiatement
    // reste la nôtre, dans study_prive.sessions, parce qu'un jeton d'accès
    // Supabase reste valide jusqu'à son expiration.
    const { error } = await client.auth.admin.signOut(identifiantFournisseur, "global");
    if (error !== null) {
      throw new Error(`Revocation refusee par le fournisseur (${error.code ?? "inconnu"})`);
    }
  }

  async renouveler(refreshToken: string): Promise<JetonsFournisseur> {
    const client = clientAuthentification();
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });

    if (error !== null || data.session === null) {
      throw new Error("Renouvellement de jetons refuse");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expireLe: echeance(data.session.expires_at, data.session.expires_in),
      niveauAssurance: NIVEAU_MOT_DE_PASSE,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Second facteur                                                          */
  /*                                                                         */
  /* Ces quatre opérations agissent **au nom d'une session**, jamais au nom   */
  /* du service : elles reposent le couple de jetons de la personne sur un    */
  /* client neuf. Passer par la clé privilégiée permettrait d'enrôler un      */
  /* facteur sur le compte de n'importe qui, ce qui retournerait la mesure    */
  /* contre son but.                                                         */
  /* ---------------------------------------------------------------------- */

  async listerFacteurs(jetons: JetonsFournisseur): Promise<FacteurTotp[]> {
    const client = await clientDeLaSession(jetons);
    const { data, error } = await client.auth.mfa.listFactors();

    if (error !== null || data === null) return [];

    return (data.all ?? [])
      .filter((facteur) => facteur.factor_type === "totp")
      .map((facteur) => ({ id: facteur.id, verifie: facteur.status === "verified" }));
  }

  async enrolerTotp(jetons: JetonsFournisseur): Promise<EnrolementTotp> {
    const client = await clientDeLaSession(jetons);

    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      // Ce libellé apparaît dans l'application d'authentification de la
      // personne. Il doit dire de quel service il s'agit, sans dire qui elle
      // est : un téléphone perdu ne doit pas annoncer le compte qu'il ouvre.
      friendlyName: `AvecStudy ${new Date().toISOString().slice(0, 10)}`,
    });

    if (error !== null || data === null) {
      throw new Error("Enrolement du second facteur refuse");
    }

    return {
      facteurId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  }

  async verifierTotp(
    jetons: JetonsFournisseur,
    facteurId: string,
    code: string,
  ): Promise<ResultatVerification> {
    const client = await clientDeLaSession(jetons);

    // Le fournisseur veut un défi avant la réponse : c'est lui qui borne la
    // fenêtre de validité du code, et non nous.
    const defi = await client.auth.mfa.challenge({ factorId: facteurId });
    if (defi.error !== null || defi.data === null) return { reussi: false };

    const { data, error } = await client.auth.mfa.verify({
      factorId: facteurId,
      challengeId: defi.data.id,
      code,
    });

    if (error !== null || data === null) return { reussi: false };

    // Les jetons rendus ici portent `aal2`. On ne le suppose pas : on relit
    // ce que le fournisseur a effectivement émis.
    const apres = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const niveau: NiveauAssurance = apres.data?.currentLevel === "aal2" ? "aal2" : "aal1";

    return {
      reussi: niveau === "aal2",
      identifiantFournisseur: data.user?.id,
      jetons: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        // La vérification d'un facteur rend `expires_in` mais pas
        // `expires_at` : on laisse le repli calculer l'échéance.
        expireLe: echeance(undefined, data.expires_in),
        niveauAssurance: niveau,
      },
    };
  }

  async retirerFacteur(jetons: JetonsFournisseur, facteurId: string): Promise<void> {
    const client = await clientDeLaSession(jetons);
    await client.auth.mfa.unenroll({ factorId: facteurId });
  }

}

/**
 * Un client qui agit au nom d'une personne, et d'elle seule.
 *
 * On repose explicitement le couple de jetons : sans cela le client Supabase
 * n'a pas de session, et `auth.mfa.*` repond « pas d'utilisateur ». Ce n'est
 * pas la cle privilegiee qui est employee ici — elle permettrait d'enroler un
 * facteur sur le compte de n'importe qui, ce qui retournerait la mesure
 * contre son but.
 */
async function clientDeLaSession(jetons: JetonsFournisseur) {
  const client = clientAuthentification();

  const { error } = await client.auth.setSession({
    access_token: jetons.accessToken,
    refresh_token: jetons.refreshToken,
  });

  if (error !== null) {
    throw new Error("Session du fournisseur illisible");
  }

  return client;
}

/**
 * Change le mot de passe de la personne connectée.
 *
 * Volontairement hors de `FournisseurIdentite` : cette opération agit au nom
 * d'une session précise, avec son jeton d'accès, et non au nom du service. Un
 * changement de mot de passe qui passerait par la clé privilégiée permettrait
 * de changer celui de n'importe qui.
 */
export async function changerMotDePasse(
  jetonAcces: string,
  nouveauMotDePasse: string,
): Promise<boolean> {
  const config = lireGroupe("donnees");

  // Appel direct à l'API d'authentification, avec le jeton de la personne.
  // `supabase-js` lirait la session depuis son magasin interne, que nous ne
  // remplissons pas : passer par l'en-tête est ici plus sûr et plus lisible
  // qu'un aller-retour par `setSession`.
  const reponse = await fetch(new URL("/auth/v1/user", config.SUPABASE_URL!), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      apikey: config.SUPABASE_PUBLISHABLE_KEY!,
      authorization: `Bearer ${jetonAcces}`,
    },
    body: JSON.stringify({ password: nouveauMotDePasse }),
  });

  if (reponse.ok) return true;

  // Le corps de la réponse peut contenir le motif exact du refus (mot de passe
  // trop court, identique au précédent). Il ne remonte pas à l'appelant : la
  // page affiche une consigne, pas un message du fournisseur.
  console.warn(
    JSON.stringify({ niveau: "avertissement", contexte: "changement_mot_de_passe", statut: reponse.status }),
  );
  return false;
}

/* -------------------------------------------------------------------------- */

function echeance(expiresAt: number | undefined, expiresIn: number | undefined): Date {
  if (typeof expiresAt === "number") return new Date(expiresAt * 1000);
  if (typeof expiresIn === "number") return new Date(Date.now() + expiresIn * 1000);
  // Repli prudent : une heure. Une échéance trop courte force un
  // renouvellement inutile ; une échéance trop longue laisserait croire qu'un
  // jeton périmé est encore bon.
  return new Date(Date.now() + 3_600_000);
}

/** Vérification par mot de passe seul : le niveau atteint est aal1, jamais plus. */
const NIVEAU_MOT_DE_PASSE: NiveauAssurance = "aal1";

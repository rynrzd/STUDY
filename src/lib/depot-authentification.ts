import "server-only";

import type {
  DepotAuthentification,
  IdentiteResolue,
  SessionACreer,
} from "./authentification.ts";
import { lireCles } from "./chiffrement.ts";
import { FENETRE_ECHECS_MINUTES } from "./authentification.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Dépôt d'authentification adossé à Supabase.
 *
 * Il ne fait aucune requête libre sur `study_prive` : il appelle les fonctions
 * `study.auth_*` de la migration 0015, dont l'exécution est réservée au rôle de
 * service. Le schéma privé reste donc inaccessible même si quelqu'un obtenait
 * la clé publiable.
 *
 * Aucune méthode ne journalise un identifiant saisi, un mot de passe ni un
 * jeton de session.
 */
export class DepotSupabase implements DepotAuthentification {
  private client() {
    return clientExploitation("administration_des_comptes");
  }

  async resoudreIdentifiant(
    codeEtablissement: string,
    identifiant: string,
  ): Promise<IdentiteResolue | null> {
    const { data, error } = await this.client().rpc("auth_resoudre_identifiant", {
      p_code: codeEtablissement,
      p_identifiant: identifiant,
    });

    if (error !== null) {
      journaliser("resolution_identifiant", error.code);
      return null;
    }

    const ligne = Array.isArray(data) ? data[0] : null;
    if (ligne === null || ligne === undefined) return null;

    return {
      profileId: ligne.profile_id,
      organizationId: ligne.organization_id,
      alias: ligne.alias,
      mustChangePassword: ligne.must_change_password === true,
      accountState: ligne.account_state,
      membershipState: ligne.membership_state,
      mfaObligatoire: ligne.mfa_obligatoire === true,
      portee: ligne.portee === 'editeur' ? 'editeur' : 'etablissement',
    };
  }

  async compterEchecsRecents(profileId: string): Promise<number> {
    const { data, error } = await this.client().rpc("auth_compter_echecs", {
      p_profile: profileId,
      p_fenetre_minutes: FENETRE_ECHECS_MINUTES,
    });

    if (error !== null) {
      journaliser("comptage_echecs", error.code);
      // En cas de doute, on considère qu'il y a eu des échecs : mieux vaut
      // ralentir une personne légitime que d'ouvrir un compte au forçage.
      return Number.MAX_SAFE_INTEGER;
    }

    return typeof data === "number" ? data : 0;
  }

  async enregistrerEchec(profileId: string | null, codeEtablissement: string): Promise<void> {
    const { error } = await this.client().rpc("auth_enregistrer_echec", {
      p_profile: profileId,
      p_code: codeEtablissement,
    });
    if (error !== null) journaliser("enregistrement_echec", error.code);
  }

  async effacerEchecs(profileId: string): Promise<void> {
    const { error } = await this.client().rpc("auth_effacer_echecs", { p_profile: profileId });
    if (error !== null) journaliser("effacement_echecs", error.code);
  }

  async creerSession(session: SessionACreer): Promise<string> {
    const cles = lireCles();
    const versionCourante = cles[0]?.version ?? 1;

    const { data, error } = await this.client().rpc("auth_creer_session", {
      p_profile: session.profileId,
      p_organization: session.organizationId,
      // PostgREST attend du `bytea` en hexadécimal préfixé.
      p_empreinte: enHexa(session.tokenSha256),
      p_scope: session.scope,
      p_appareil: session.deviceKind,
      p_niveau_assurance: session.niveauAssurance,
      p_idle_expire: session.idleExpiresAt.toISOString(),
      p_absolu_expire: session.absoluteExpiresAt.toISOString(),
      p_jetons_chiffres: enHexa(Buffer.from(session.jetonsChiffres, "utf8")),
      p_cle_version: versionCourante,
    });

    if (error !== null) {
      journaliser("creation_session", error.code);
      throw new Error("La session n'a pas pu etre creee.");
    }

    return String(data);
  }

  async revoquerSessions(profileId: string, motif: string): Promise<void> {
    const { error } = await this.client().rpc("auth_revoquer_sessions_profil", {
      p_profile: profileId,
      p_motif: motif,
    });
    if (error !== null) journaliser("revocation_sessions", error.code);
  }

  /** Révoque une session précise, à partir de l'empreinte de son cookie. */
  async revoquerSession(empreinte: Buffer, motif: string): Promise<void> {
    const { error } = await this.client().rpc("auth_revoquer_session", {
      p_empreinte: enHexa(empreinte),
      p_motif: motif,
    });
    if (error !== null) journaliser("revocation_session", error.code);
  }

  async lireSession(empreinte: Buffer): Promise<LigneSession | null> {
    const { data, error } = await this.client().rpc("auth_lire_session", {
      p_empreinte: enHexa(empreinte),
    });

    if (error !== null) {
      journaliser("lecture_session", error.code);
      return null;
    }

    const ligne = Array.isArray(data) ? data[0] : null;
    return ligne ?? null;
  }

  /**
   * Remplace les jetons du fournisseur sur une session vivante.
   *
   * Sert au renouvellement : le jeton d'accès expire au bout d'une heure, et
   * sans cela une personne au travail depuis plus longtemps verrait ses pages
   * cesser de charger sans explication.
   */
  async remplacerJetons(empreinte: Buffer, jetonsChiffres: string): Promise<void> {
    const cles = lireCles();
    const { error } = await this.client().rpc("auth_remplacer_jetons", {
      p_empreinte: enHexa(empreinte),
      p_jetons_chiffres: enHexa(Buffer.from(jetonsChiffres, "utf8")),
      p_cle_version: cles[0]?.version ?? 1,
    });
    if (error !== null) journaliser("remplacement_jetons", error.code);
  }

  async prolongerSession(empreinte: Buffer, nouvelleEcheance: Date): Promise<void> {
    const { error } = await this.client().rpc("auth_prolonger_session", {
      p_empreinte: enHexa(empreinte),
      p_nouvelle_idle: nouvelleEcheance.toISOString(),
    });
    if (error !== null) journaliser("prolongation_session", error.code);
  }

  /**
   * L'alias technique de la personne, pour verifier son mot de passe actuel.
   *
   * Necessaire au changement de mot de passe depuis les parametres : le
   * fournisseur d'identite ne connait pas les identifiants locaux, il ne
   * connait que cet alias. Il ne sort d'ici que pour la personne elle-meme.
   */
  async aliasCourant(profileId: string, organizationId: string): Promise<string | null> {
    const { data, error } = await this.client().rpc("auth_alias_courant", {
      p_profile: profileId,
      p_organisation: organizationId,
    });

    if (error !== null) {
      journaliser("alias_courant", error.code);
      return null;
    }
    return typeof data === "string" && data !== "" ? data : null;
  }

  async activerCompte(
    profileId: string,
    organizationId: string,
    sessionConservee: Buffer,
  ): Promise<void> {
    const { error } = await this.client().rpc("auth_activer_compte", {
      p_profile: profileId,
      p_organization: organizationId,
      p_session_conservee: enHexa(sessionConservee),
    });

    if (error !== null) {
      journaliser("activation_compte", error.code);
      throw new Error("L'activation n'a pas pu etre enregistree.");
    }
  }
}

export interface LigneSession {
  readonly id: string;
  readonly profile_id: string;
  readonly organization_id: string | null;
  readonly scope: "etablissement" | "editeur" | "activation";
  readonly device_kind: "personnel" | "partage";
  readonly niveau_assurance: "aal1" | "aal2";
  readonly idle_expires_at: string;
  readonly absolute_expires_at: string;
  readonly revoked_at: string | null;
  readonly provider_tokens_chiffres: string | null;
  readonly cle_version: number | null;
  readonly must_change_password: boolean;
  readonly roles: string[];
  readonly prenom: string;
  readonly nom: string;
  readonly organisation: string | null;
}

/** `bytea` attend une chaîne hexadécimale préfixée par `\x`. */
function enHexa(valeur: Buffer): string {
  return `\\x${valeur.toString("hex")}`;
}

/** Journal technique : un contexte et un code, jamais une donnée. */
function journaliser(contexte: string, code: string | undefined): void {
  console.error(
    JSON.stringify({ niveau: "erreur", contexte: `auth.${contexte}`, code: code ?? "inconnu" }),
  );
}

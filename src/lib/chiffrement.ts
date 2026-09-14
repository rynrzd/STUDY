import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Chiffrement du magasin de sessions — chapitre 37.
 *
 * « Conserver access/refresh tokens chiffrés côté serveur. Les colonnes
 * chiffrées utilisent une clé extérieure à la base, versionnée pour rotation. »
 *
 * AES-256-GCM : chiffrement authentifié. Un octet modifié dans la base fait
 * échouer le déchiffrement au lieu de produire un contenu altéré — ce qui
 * compte quand ce contenu est un jeton d'accès.
 *
 * Le format stocké est auto-descriptif :
 *
 *     v<version>.<iv base64url>.<contenu+tag base64url>
 *
 * Il porte sa propre version de clé, donc une rotation peut se faire sans
 * réécrire toutes les lignes d'un coup : on déchiffre avec l'ancienne clé, on
 * rechiffre avec la nouvelle au passage suivant.
 */

const ALGORITHME = "aes-256-gcm";
const TAILLE_IV = 12; // 96 bits, recommandé pour GCM
const TAILLE_TAG = 16;

export interface CleVersionnee {
  readonly version: number;
  readonly octets: Buffer;
}

export class ChiffrementImpossible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChiffrementImpossible";
  }
}

/**
 * Lit les clés depuis la configuration.
 *
 * `SESSION_ENCRYPTION_KEY` porte la clé courante. Pendant une rotation,
 * `SESSION_ENCRYPTION_KEY_PRECEDENTE` garde l'ancienne, le temps que les
 * sessions existantes expirent ou soient rechiffrées.
 */
export function lireCles(source: Record<string, string | undefined> = process.env): CleVersionnee[] {
  const cles: CleVersionnee[] = [];

  const courante = source.SESSION_ENCRYPTION_KEY;
  if (courante === undefined || courante.trim() === "") {
    throw new ChiffrementImpossible(
      "SESSION_ENCRYPTION_KEY absente : aucune session ne peut etre ouverte. " +
        "Ce n'est pas une panne, c'est une configuration manquante (ch. 35).",
    );
  }

  const version = Number.parseInt(source.SESSION_ENCRYPTION_KEY_VERSION ?? "1", 10);
  cles.push({ version: Number.isFinite(version) ? version : 1, octets: decoderCle(courante) });

  const precedente = source.SESSION_ENCRYPTION_KEY_PRECEDENTE;
  if (precedente !== undefined && precedente.trim() !== "") {
    cles.push({ version: cles[0]!.version - 1, octets: decoderCle(precedente) });
  }

  return cles;
}

function decoderCle(valeur: string): Buffer {
  const octets = Buffer.from(valeur, "base64");
  if (octets.length !== 32) {
    throw new ChiffrementImpossible(
      "La cle de chiffrement de session doit faire 32 octets une fois decodee en base64.",
    );
  }
  return octets;
}

/** Chiffre avec la clé courante et étiquette le résultat de sa version. */
export function chiffrer(clair: string, cles: CleVersionnee[]): string {
  const cle = cles[0];
  if (cle === undefined) throw new ChiffrementImpossible("Aucune cle de chiffrement disponible.");

  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv(ALGORITHME, cle.octets, iv);
  const contenu = Buffer.concat([chiffreur.update(clair, "utf8"), chiffreur.final()]);
  const tag = chiffreur.getAuthTag();

  return [
    `v${cle.version}`,
    iv.toString("base64url"),
    Buffer.concat([contenu, tag]).toString("base64url"),
  ].join(".");
}

/**
 * Déchiffre. Essaie la clé de la version indiquée, puis les autres — une
 * rotation en cours ne doit pas déconnecter tout le monde.
 */
export function dechiffrer(scelle: string, cles: CleVersionnee[]): string {
  const parties = scelle.split(".");
  if (parties.length !== 3 || !parties[0]!.startsWith("v")) {
    throw new ChiffrementImpossible("Format de valeur chiffree non reconnu.");
  }

  const version = Number.parseInt(parties[0]!.slice(1), 10);
  const iv = Buffer.from(parties[1]!, "base64url");
  const bloc = Buffer.from(parties[2]!, "base64url");

  if (bloc.length <= TAILLE_TAG) {
    throw new ChiffrementImpossible("Valeur chiffree tronquee.");
  }

  const contenu = bloc.subarray(0, bloc.length - TAILLE_TAG);
  const tag = bloc.subarray(bloc.length - TAILLE_TAG);

  // La clé de la bonne version d'abord, les autres ensuite.
  const candidates = [
    ...cles.filter((cle) => cle.version === version),
    ...cles.filter((cle) => cle.version !== version),
  ];

  for (const cle of candidates) {
    try {
      const dechiffreur = createDecipheriv(ALGORITHME, cle.octets, iv);
      dechiffreur.setAuthTag(tag);
      return Buffer.concat([dechiffreur.update(contenu), dechiffreur.final()]).toString("utf8");
    } catch {
      // Mauvaise clé ou contenu altéré : on essaie la suivante.
    }
  }

  throw new ChiffrementImpossible(
    "Dechiffrement impossible : aucune cle connue ne correspond, ou la valeur a ete alteree.",
  );
}

/** Version de clé utilisée par une valeur scellée, pour savoir quoi rechiffrer. */
export function versionDe(scelle: string): number | null {
  const marque = scelle.split(".")[0];
  if (marque === undefined || !marque.startsWith("v")) return null;
  const version = Number.parseInt(marque.slice(1), 10);
  return Number.isFinite(version) ? version : null;
}

/**
 * Comparaison à temps constant de deux chaînes.
 *
 * Utilisée là où une différence de durée révélerait une information : par
 * exemple pour comparer un code établissement saisi à celui attendu.
 */
export function egalConstant(a: string, b: string): boolean {
  const octetsA = Buffer.from(a, "utf8");
  const octetsB = Buffer.from(b, "utf8");
  if (octetsA.length !== octetsB.length) return false;
  return timingSafeEqual(octetsA, octetsB);
}

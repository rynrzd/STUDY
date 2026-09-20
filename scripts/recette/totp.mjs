// =============================================================================
// TOTP — RFC 6238, pour la recette uniquement.
//
// Pourquoi ce fichier existe : depuis la migration 0039, l'exploitant et les
// administrateurs d'établissement doivent présenter un second facteur. Une
// recette automatisée qui joue ces parcours doit donc savoir produire un code
// — sinon la moitié du produit devient intestable, et une fonctionnalité
// intestable finit par ne plus être testée du tout.
//
// Ce que ce fichier **n'est pas** : il ne vit pas dans `src/`, il n'est jamais
// embarqué dans l'application, et il ne sert qu'aux comptes jetables de la
// recette. Le secret d'un compte réel ne passe jamais par ici : il est affiché
// une fois à l'écran d'enrôlement et n'est écrit nulle part.
//
// Les secrets manipulés ici vivent en mémoire, le temps d'une recette, sur des
// comptes supprimés à la fin. Aucun n'est écrit sur disque ni journalisé.
// =============================================================================

import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Décode un secret en base32 (l'encodage des URI `otpauth:`).
 *
 * Le remplissage `=` et les espaces que certaines applications ajoutent pour
 * la lisibilité sont ignorés : le secret affiché à l'écran doit pouvoir être
 * recopié tel quel.
 */
export function depuisBase32(secret) {
  const propre = secret.replace(/[\s=]/g, "").toUpperCase();

  let bits = 0;
  let valeur = 0;
  const octets = [];

  for (const caractere of propre) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) throw new Error(`secret base32 invalide : caractere « ${caractere} »`);

    valeur = (valeur << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      octets.push((valeur >> bits) & 0xff);
    }
  }

  return Buffer.from(octets);
}

/**
 * Le code à six chiffres valable à l'instant donné.
 *
 * `instant` est en millisecondes, pour se caler sur `Date.now()`. Le décalage
 * `pas` permet de demander la fenêtre précédente ou suivante — utile quand on
 * veut délibérément présenter un code périmé.
 */
export function codeTotp(secret, { instant = Date.now(), pas = 0, periode = 30, chiffres = 6 } = {}) {
  const compteur = Math.floor(instant / 1000 / periode) + pas;

  const bloc = Buffer.alloc(8);
  bloc.writeUInt32BE(Math.floor(compteur / 2 ** 32), 0);
  bloc.writeUInt32BE(compteur >>> 0, 4);

  const empreinte = createHmac("sha1", depuisBase32(secret)).update(bloc).digest();

  // Troncature dynamique (RFC 4226 §5.3) : les quatre derniers bits désignent
  // l'octet de départ, et le bit de poids fort est masqué pour rester positif.
  const decalage = empreinte[empreinte.length - 1] & 0x0f;
  const nombre =
    ((empreinte[decalage] & 0x7f) << 24) |
    ((empreinte[decalage + 1] & 0xff) << 16) |
    ((empreinte[decalage + 2] & 0xff) << 8) |
    (empreinte[decalage + 3] & 0xff);

  return String(nombre % 10 ** chiffres).padStart(chiffres, "0");
}

/**
 * Le nombre de millisecondes restant dans la fenêtre courante.
 *
 * Un code présenté à la toute fin d'une fenêtre peut expirer entre la saisie
 * et la vérification. La recette attend plutôt que de produire un échec qui
 * ressemblerait à un défaut du produit.
 */
export function finDeFenetre(periode = 30) {
  return periode * 1000 - (Date.now() % (periode * 1000));
}

/**
 * Un code confortablement valable : si la fenêtre expire dans moins de trois
 * secondes, on attend la suivante.
 */
export async function codeStable(secret) {
  const reste = finDeFenetre();
  if (reste < 3000) {
    await new Promise((resoudre) => setTimeout(resoudre, reste + 250));
  }
  return codeTotp(secret);
}

/** Extrait le secret d'une URI `otpauth://totp/...?secret=...`. */
export function secretDeLUri(uri) {
  const trouve = /[?&]secret=([^&]+)/i.exec(uri);
  if (trouve === null) throw new Error("aucun secret dans l URI otpauth");
  return trouve[1];
}

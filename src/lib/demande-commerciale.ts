import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Demande de démonstration ou de devis — section 5.2 du cahier de finition.
 *
 * Un seul parcours pour /etablissements : validation serveur, anti-spam
 * discret, insertion en base, référence lisible, écran de confirmation
 * sincère. **Aucun courrier n'est envoyé** : la référence affichée à l'écran
 * est la seule preuve de dépôt que le demandeur emporte, ce qui oblige à la
 * rendre lisible et à ne jamais la perdre.
 *
 * Ce module ne parle pas à la base : il valide, normalise et calcule. Il est
 * donc testable sans Supabase.
 */

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const texteCourt = z.string().trim().min(1).max(120);

export const TYPES_ETABLISSEMENT = [
  { valeur: "public", libelle: "Établissement public" },
  { valeur: "prive", libelle: "Établissement privé sous contrat" },
  { valeur: "autre", libelle: "Autre structure" },
] as const;

export const schemaDemande = z.object({
  etablissement: texteCourt.describe("Nom de l'établissement"),
  type: z.enum(["public", "prive", "autre"]),
  commune: texteCourt,
  contactNom: texteCourt,
  contactFonction: texteCourt,
  // Adresse professionnelle : c'est le seul moyen de rappeler la personne,
  // puisque le service n'envoie pas de courrier automatique.
  contactEmail: z.string().trim().toLowerCase().email().max(180),
  contactTelephone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+().\s-]*$/, "Numéro de téléphone invalide")
    .optional()
    .or(z.literal("")),
  effectif: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(10000)])
    .optional(),
  besoin: z.string().trim().min(10).max(2000),
  consentement: z.literal("oui", { message: "Le consentement est nécessaire pour vous recontacter." }),
});

export type Demande = z.infer<typeof schemaDemande>;

/** Messages de champ, en français, sans jargon de validation. */
export const MESSAGES: Record<string, string> = {
  etablissement: "Indiquez le nom de l'établissement.",
  type: "Choisissez le type d'établissement.",
  commune: "Indiquez la commune.",
  contactNom: "Indiquez votre nom.",
  contactFonction: "Indiquez votre fonction.",
  contactEmail: "Indiquez une adresse professionnelle valide.",
  contactTelephone: "Ce numéro de téléphone n'est pas valide.",
  effectif: "Indiquez un nombre d'élèves entre 0 et 10 000.",
  besoin: "Décrivez votre besoin en quelques mots (10 caractères minimum).",
  consentement: "Cochez la case pour que nous puissions vous recontacter.",
};

/* -------------------------------------------------------------------------- */
/* Anti-spam discret                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Deux contrôles, tous deux invisibles pour une personne réelle :
 *
 *  1. un champ leurre qui doit rester vide — les robots remplissent tout ;
 *  2. un jeton d'ouverture signé, qui date l'affichage du formulaire. Un envoi
 *     en moins de trois secondes n'est pas humain ; au-delà de deux heures, le
 *     jeton est périmé et la page doit être rechargée.
 *
 * Pas de CAPTCHA : il pénalise les personnes concernées — un proviseur pressé,
 * un lecteur d'écran — bien plus que les robots.
 */

export const DELAI_MINIMUM_MS = 3_000;
export const DELAI_MAXIMUM_MS = 2 * 60 * 60 * 1000;

function cleFormulaire(secretBase64: string): Buffer {
  // Clé dérivée : le secret de session ne sert jamais directement à deux usages.
  return createHmac("sha256", Buffer.from(secretBase64, "base64"))
    .update("avecstudy/formulaire-commercial/v1")
    .digest();
}

export function jetonOuverture(secretBase64: string, maintenant = Date.now()): string {
  const horodatage = String(maintenant);
  const signature = createHmac("sha256", cleFormulaire(secretBase64))
    .update(horodatage)
    .digest("base64url");
  return `${horodatage}.${signature}`;
}

export type VerdictOuverture = "valide" | "trop_rapide" | "perime" | "invalide";

export function verifierOuverture(
  jeton: string,
  secretBase64: string,
  maintenant = Date.now(),
): VerdictOuverture {
  const separateur = jeton.indexOf(".");
  if (separateur <= 0) return "invalide";

  const horodatage = jeton.slice(0, separateur);
  const signature = jeton.slice(separateur + 1);

  const attendue = createHmac("sha256", cleFormulaire(secretBase64))
    .update(horodatage)
    .digest("base64url");

  const recue = Buffer.from(signature);
  const reference = Buffer.from(attendue);
  if (recue.length !== reference.length || !timingSafeEqual(recue, reference)) return "invalide";

  const ouvert = Number.parseInt(horodatage, 10);
  if (!Number.isFinite(ouvert)) return "invalide";

  const ecoule = maintenant - ouvert;
  if (ecoule < 0) return "invalide";
  if (ecoule < DELAI_MINIMUM_MS) return "trop_rapide";
  if (ecoule > DELAI_MAXIMUM_MS) return "perime";
  return "valide";
}

/* -------------------------------------------------------------------------- */
/* Référence et déduplication                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Alphabet sans caractère ambigu : ni O ni 0, ni I ni 1. La référence est lue
 * à voix haute au téléphone, ou recopiée depuis une capture d'écran.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Référence lisible, de la forme `AS-2609-K7QP4`.
 *
 * Le mois d'émission y figure : il permet de retrouver une demande sans avoir
 * à chercher dans toute la table, et il indique au demandeur que sa référence
 * date. Le reste est aléatoire — jamais un compteur, qui révélerait combien de
 * demandes ont été reçues.
 */
export function genererReference(
  aleatoire: (octets: number) => Uint8Array,
  maintenant = new Date(),
): string {
  const annee = String(maintenant.getUTCFullYear()).slice(2);
  const mois = String(maintenant.getUTCMonth() + 1).padStart(2, "0");

  const octets = aleatoire(5);
  let suffixe = "";
  for (const octet of octets) {
    suffixe += ALPHABET[octet % ALPHABET.length];
  }

  return `AS-${annee}${mois}-${suffixe}`;
}

/**
 * Empreinte de déduplication.
 *
 * Un double clic, ou un envoi répété faute de courrier de confirmation, ne doit
 * pas créer deux demandes. L'empreinte porte sur ce qui identifie réellement la
 * demande — établissement et adresse de contact — et non sur le texte du
 * besoin, qu'une personne peut reformuler en réessayant.
 *
 * Elle est hachée : la table peut être exportée pour analyse sans révéler
 * l'adresse de contact par l'index.
 */
export function empreinteDeduplication(demande: Pick<Demande, "etablissement" | "contactEmail">): string {
  const normalise = `${demande.etablissement.trim().toLowerCase()}|${demande.contactEmail.trim().toLowerCase()}`;
  return createHash("sha256").update(normalise).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* États                                                                       */
/* -------------------------------------------------------------------------- */

export const ETATS = [
  { valeur: "nouvelle", libelle: "Nouvelle" },
  { valeur: "contactee", libelle: "Contactée" },
  { valeur: "devis_envoye", libelle: "Devis envoyé" },
  { valeur: "gagnee", libelle: "Gagnée" },
  { valeur: "perdue", libelle: "Perdue" },
] as const;

export type Etat = (typeof ETATS)[number]["valeur"];

export function libelleEtat(etat: string): string {
  return ETATS.find((element) => element.valeur === etat)?.libelle ?? etat;
}

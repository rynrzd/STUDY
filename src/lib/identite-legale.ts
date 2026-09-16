/**
 * Identité légale de l'éditeur — source unique.
 *
 * Le cahier de finition est catégorique : « Le SIRET ne doit jamais être
 * deviné. » Aucune valeur officielle n'est donc écrite en dur ailleurs que
 * dans ce fichier, et celles qui manquent restent `null`.
 *
 * Une valeur `null` n'est jamais rendue comme un numéro plausible ni comme un
 * tiret discret : les pages légales affichent explicitement que la mention est
 * en cours de publication. C'est moins joli qu'un faux SIRET, et c'est la seule
 * option honnête — un numéro inventé sur une page de mentions légales est une
 * fausse déclaration.
 *
 * Pour compléter : remplacer les `null` ci-dessous par les valeurs exactes du
 * justificatif INPI/INSEE, puis relancer `npm run legal:verifier`.
 */

export interface IdentiteLegale {
  /** Personne physique ou morale qui édite le service. */
  readonly editeur: string;
  readonly formeJuridique: string;
  /** Nom commercial du service. */
  readonly nomCommercial: string;
  readonly siren: string | null;
  readonly siret: string | null;
  readonly tvaIntracommunautaire: string | null;
  readonly adresse: string | null;
  readonly contactEmail: string | null;
  readonly contactTelephone: string | null;
  readonly directeurPublication: string;
  readonly hebergeur: Hebergeur;
  readonly sousTraitants: readonly SousTraitant[];
}

export interface Hebergeur {
  readonly nom: string;
  readonly raisonSociale: string | null;
  readonly adresse: string | null;
  readonly role: string;
}

export interface SousTraitant {
  readonly nom: string;
  readonly role: string;
  readonly donnees: string;
}

export const IDENTITE: IdentiteLegale = {
  editeur: "Nouh Tifouti",
  formeJuridique: "Entrepreneur individuel",
  nomCommercial: "AvecStudy",

  // À renseigner d'après le justificatif INPI/INSEE. Ne jamais deviner.
  siren: null,
  siret: null,
  tvaIntracommunautaire: null,
  adresse: null,
  contactEmail: null,
  contactTelephone: null,

  directeurPublication: "Nouh Tifouti",

  hebergeur: {
    nom: "Vercel",
    // Les coordonnées légales exactes sont à vérifier avant publication.
    raisonSociale: null,
    adresse: null,
    role: "Hébergement de l'application web",
  },

  sousTraitants: [
    {
      nom: "Vercel",
      role: "Hébergement de l'application web",
      donnees: "Journaux techniques de requêtes",
    },
    {
      nom: "Supabase",
      role: "Base de données, authentification et stockage de fichiers",
      donnees:
        "Identité scolaire, inscriptions, contenus pédagogiques, copies, comptes et traces techniques",
    },
  ],
};

/** Les mentions obligatoires sont-elles complètes ? */
export function mentionsCompletes(identite: IdentiteLegale = IDENTITE): boolean {
  return (
    identite.siren !== null &&
    identite.siret !== null &&
    identite.adresse !== null &&
    identite.contactEmail !== null &&
    identite.hebergeur.raisonSociale !== null &&
    identite.hebergeur.adresse !== null
  );
}

/** Champs encore attendus, par leur nom lisible. Sert au contrôle avant mise en ligne. */
export function mentionsManquantes(identite: IdentiteLegale = IDENTITE): string[] {
  const manquantes: string[] = [];
  if (identite.siren === null) manquantes.push("SIREN");
  if (identite.siret === null) manquantes.push("SIRET");
  if (identite.adresse === null) manquantes.push("adresse professionnelle");
  if (identite.contactEmail === null) manquantes.push("adresse de contact publique");
  if (identite.hebergeur.raisonSociale === null) manquantes.push("raison sociale de l'hébergeur");
  if (identite.hebergeur.adresse === null) manquantes.push("adresse de l'hébergeur");
  return manquantes;
}

/**
 * Rend une mention légale.
 *
 * Quand la valeur manque, on le dit — au lieu d'afficher un tiret qu'un
 * lecteur pressé prendrait pour « sans objet ».
 */
export function mention(valeur: string | null): string {
  return valeur ?? "En cours de publication";
}

/**
 * Durées de conservation, telles qu'annoncées publiquement.
 *
 * Elles engagent : elles sont donc écrites ici, une seule fois, et reprises
 * telles quelles par la page de confidentialité et par le contrat.
 */
export const CONSERVATION = [
  {
    donnees: "Demandes commerciales",
    duree: "3 ans après le dernier contact",
    precision: "sauf obligation légale différente",
  },
  {
    donnees: "Comptes et contenus scolaires",
    duree: "Durée du contrat de l'établissement",
    precision: "puis suppression ou restitution selon ce que le contrat prévoit",
  },
  {
    donnees: "Journaux de sécurité",
    duree: "6 mois",
    precision: "conservés pour détecter et traiter les incidents",
  },
  {
    donnees: "Journaux techniques",
    duree: "30 jours",
    precision: "diagnostic de panne uniquement",
  },
] as const;

/** Nom du service, à utiliser partout plutôt qu'une chaîne recopiée. */
export const MARQUE = "AvecStudy";

/** Domaine canonique. Sert aux URL absolues, au sitemap et aux métadonnées. */
export const DOMAINE = "https://avecstudy.fr";

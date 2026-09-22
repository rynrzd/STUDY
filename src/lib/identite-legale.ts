/**
 * Identité légale de l'éditeur — source unique.
 *
 * Aucune valeur officielle n'est écrite en dur ailleurs que dans ce fichier.
 * Les pages légales, le pied de page et les documents commerciaux la lisent
 * ici : une immatriculation recopiée à deux endroits finit par diverger, et
 * c'est alors la page la moins relue qui ment.
 *
 * **Une seule entreprise.** AvecStudy est un **nom commercial**, pas une
 * société. L'entreprise qui l'exploite est l'entreprise individuelle de Nouh
 * Tifouti — la même que celle qui exploite Nireo. Il n'existe donc qu'un SIREN
 * et qu'un SIRET, et présenter AvecStudy comme une personne morale distincte
 * serait une fausse déclaration.
 *
 * **Ce qui manque reste `null`.** Une valeur absente n'est jamais rendue comme
 * un numéro plausible ni comme un tiret discret : la page le dit. C'est moins
 * joli qu'un faux SIRET, et c'est la seule option honnête.
 *
 * `npm run verifier:legal` relit la page **servie** et compare chaque mention
 * à ce fichier. Une valeur corrigée ici sans déploiement s'y voit.
 */

export interface IdentiteLegale {
  /** Personne physique ou morale qui édite le service. */
  readonly editeur: string;
  readonly formeJuridique: string;
  /** Nom commercial du service. */
  readonly nomCommercial: string;
  readonly siren: string | null;
  readonly siret: string | null;
  /** Code d'activité principale exercée, tel que l'INSEE l'a attribué. */
  readonly codeApe: string | null;
  /**
   * Le numéro de TVA intracommunautaire, quand il y en a un.
   *
   * Une micro-entreprise en franchise en base n'en a pas d'office : elle doit
   * le demander. Tant qu'il n'est pas attribué, ce champ vaut `null` — et
   * c'est `regimeTva` qui porte la mention obligatoire.
   */
  readonly tvaIntracommunautaire: string | null;
  /**
   * La mention de régime, obligatoire sur les documents commerciaux.
   *
   * Ce n'est pas un numéro et ça ne s'écrit pas à sa place : « TVA non
   * applicable, article 293 B du CGI » dit qu'aucune TVA n'est facturée, ce
   * qu'un champ vide laisserait deviner de travers.
   */
  readonly regimeTva: string | null;
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

  // Valeurs officielles de l'entreprise individuelle. Un seul établissement,
  // un seul SIREN : AvecStudy et Nireo sont deux noms commerciaux de la même
  // entreprise, et non deux sociétés.
  siren: "979 992 443",
  siret: "979 992 443 00023",
  codeApe: "62.01Z — Programmation informatique",

  // Aucun numéro de TVA intracommunautaire : la franchise en base n'en
  // attribue pas d'office. C'est `regimeTva` qui porte la mention due.
  tvaIntracommunautaire: null,
  regimeTva: "TVA non applicable, article 293 B du Code général des impôts",

  adresse: "1 avenue d'Alsace, 90000 Belfort, France",
  contactEmail: "nireo.contacte@gmail.com",
  contactTelephone: "07 81 69 74 77",

  directeurPublication: "Nouh Tifouti",

  hebergeur: {
    nom: "Vercel",
    // Relevées le 20 septembre 2026 sur les deux pages légales de l'hébergeur
    // — conditions d'utilisation et politique de confidentialité — qui portent
    // la même entité et la même adresse. Elles ne sont pas écrites de mémoire :
    // publier une adresse d'hébergeur fausse est une fausse déclaration comme
    // une autre.
    raisonSociale: "Vercel Inc.",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
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

/**
 * Les mentions obligatoires sont-elles complètes ?
 *
 * `tvaIntracommunautaire` n'en fait volontairement pas partie : une entreprise
 * en franchise en base n'en a pas, et l'exiger ferait tenir la page pour
 * incomplète alors qu'elle est exacte. C'est `regimeTva` qui est dû.
 */
export function mentionsCompletes(identite: IdentiteLegale = IDENTITE): boolean {
  return (
    identite.siren !== null &&
    identite.siret !== null &&
    identite.regimeTva !== null &&
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
  if (identite.regimeTva === null) manquantes.push("régime de TVA");
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

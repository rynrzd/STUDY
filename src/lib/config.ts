import { z } from "zod";

/**
 * Configuration de l'application — chapitre 40.
 *
 * Trois règles tenues ici :
 *
 *  1. **Aucune clé privilégiée dans une variable NEXT_PUBLIC.** Le module
 *     refuse de démarrer s'il en détecte une, plutôt que de laisser un secret
 *     partir dans le bundle du navigateur.
 *  2. **Échec propre au démarrage** si une clé requise manque : un message qui
 *     nomme les variables absentes, et rien d'autre.
 *  3. **Jamais de valeur dans un message, un journal ou un diagnostic.** Ce
 *     module n'expose que des états : « présente », « absente », « invalide ».
 *
 * Les noms suivent la convention du ch. 40. Ils sont applicatifs : ils seront
 * adaptés aux fournisseurs réellement retenus, qui ne le sont pas encore.
 */

const environnement = z.enum(["developpement", "recette", "production"]);

/**
 * Ce qui est exigé en permanence. Le reste est exigé par fonctionnalité :
 * l'absence de worker n'empêche pas de consulter un cours, elle empêche
 * d'importer une classe — et le produit doit le dire, pas le simuler.
 *
 * Le courrier électronique ne figure plus ici : AvecStudy n'envoie aucun message.
 * Élèves comme adultes se connectent avec un identifiant remis par leur
 * établissement, et une réinitialisation se fait sur place. Voir ch. 37 et
 * docs/08-sans-courrier.md.
 */
const schemaBase = z.object({
  APP_ORIGIN: z.string().url("APP_ORIGIN doit etre une URL absolue"),
  APP_ENV: environnement,
});

const schemaDonnees = z.object({
  SUPABASE_URL: z.string().url(),
  // Clé destinée au navigateur chez le fournisseur. Elle n'est pas un secret,
  // mais dans l'architecture BFF elle ne quitte jamais le serveur non plus.
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  // Clé privilégiée : provisionnement et Admin Auth uniquement (ch. 40).
  SUPABASE_SECRET_KEY: z.string().min(20),
});

const schemaSessions = z.object({
  // 32 octets en base64. La clé vit hors de la base et se version pour la
  // rotation : study_prive.sessions.cle_version pointe la version utilisée.
  SESSION_ENCRYPTION_KEY: z
    .string()
    .refine((valeur) => {
      try {
        return Buffer.from(valeur, "base64").length === 32;
      } catch {
        return false;
      }
    }, "SESSION_ENCRYPTION_KEY doit contenir 32 octets encodes en base64"),
});

const schemaWorker = z.object({
  // Rôle SQL restreint, distinct de celui de l'application.
  WORKER_DATABASE_URL: z.string().startsWith("postgres"),
});

const schemaCollaboration = z.object({
  COLLAB_ORIGIN: z.string().url(),
  COLLAB_TICKET_KEY: z.string().min(32),
});

/**
 * Facturation — décision du 15 septembre 2026 : **vente sur devis uniquement**.
 *
 * Plus aucun prestataire de paiement, donc plus aucune clé de prestataire, plus
 * aucun webhook entrant, et plus aucun secret de signature à protéger. Il ne
 * reste qu'un choix de circuit, qui n'est pas un secret.
 */
const schemaFacturation = z.object({
  BILLING_MODE: z.enum(["manual_public", "external_invoice"]),
});

const schemaTaches = z.object({
  CRON_SECRET: z.string().min(32),
});

/** Domaine des alias techniques élèves (ch. 37). Contrôlé par l'éditeur. */
const schemaAlias = z.object({
  STUDENT_ALIAS_DOMAIN: z.string().regex(/^[a-z0-9.-]+$/),
});

export type Groupe =
  | "base"
  | "donnees"
  | "sessions"
  | "worker"
  | "collaboration"
  | "facturation"
  | "taches"
  | "alias";

const SCHEMAS: Record<Groupe, z.ZodObject<z.ZodRawShape>> = {
  base: schemaBase,
  donnees: schemaDonnees,
  sessions: schemaSessions,
  worker: schemaWorker,
  collaboration: schemaCollaboration,
  facturation: schemaFacturation,
  taches: schemaTaches,
  alias: schemaAlias,
};

export const LIBELLES: Record<Groupe, string> = {
  base: "Origine et environnement",
  donnees: "Base de données et identité",
  sessions: "Chiffrement du magasin de sessions",
  worker: "Worker et file de travaux",
  collaboration: "Service temps réel du brouillon partagé",
  facturation: "Facturation sur devis",
  taches: "Tâches planifiées",
  alias: "Alias techniques élèves",
};

/** Ce sans quoi l'application ne peut pas démarrer du tout. */
const GROUPES_REQUIS: readonly Groupe[] = ["base"];

export interface EtatGroupe {
  readonly groupe: Groupe;
  readonly libelle: string;
  readonly complet: boolean;
  /** Noms des variables manquantes ou invalides. Jamais leurs valeurs. */
  readonly manquantes: readonly string[];
  readonly invalides: readonly string[];
}

function evaluerGroupe(groupe: Groupe, source: Record<string, string | undefined>): EtatGroupe {
  const schema = SCHEMAS[groupe];
  const attendues = Object.keys(schema.shape);
  const manquantes = attendues.filter((nom) => {
    const valeur = source[nom];
    return valeur === undefined || valeur.trim() === "";
  });

  const resultat = schema.safeParse(source);
  const invalides =
    resultat.success
      ? []
      : resultat.error.issues
          .map((probleme) => String(probleme.path[0]))
          .filter((nom) => !manquantes.includes(nom));

  return {
    groupe,
    libelle: LIBELLES[groupe],
    complet: manquantes.length === 0 && invalides.length === 0,
    manquantes,
    invalides: [...new Set(invalides)],
  };
}

/**
 * Détecte une clé privilégiée exposée au navigateur.
 *
 * Le ch. 40 l'interdit sans condition. On ne se contente pas de ne pas en
 * écrire : on vérifie qu'il n'y en a pas, parce qu'une variable ajoutée
 * plus tard dans un tableau de bord d'hébergeur ne passerait par aucune
 * relecture de code.
 */
const MOTIFS_PRIVILEGIES = [
  /SECRET/i,
  /PASSWORD/i,
  /PRIVATE/i,
  /SERVICE_ROLE/i,
  /_KEY$/i,
  /DATABASE_URL/i,
];

export function clesPubliquesSuspectes(source: Record<string, string | undefined> = process.env): string[] {
  return Object.keys(source)
    .filter((nom) => nom.startsWith("NEXT_PUBLIC_"))
    .filter((nom) => {
      const reste = nom.replace("NEXT_PUBLIC_", "");
      // PUBLISHABLE_KEY est explicitement une clé publique (ch. 40) : elle ne
      // doit pas déclencher d'alerte au seul motif qu'elle finit par _KEY.
      if (/PUBLISHABLE/i.test(reste)) return false;
      return MOTIFS_PRIVILEGIES.some((motif) => motif.test(reste));
    });
}

export interface Diagnostic {
  readonly environnement: string;
  readonly groupes: readonly EtatGroupe[];
  readonly clesPubliquesSuspectes: readonly string[];
  readonly demarrable: boolean;
}

/** État complet de la configuration. Ne contient aucune valeur. */
export function diagnostiquer(source: Record<string, string | undefined> = process.env): Diagnostic {
  const groupes = (Object.keys(SCHEMAS) as Groupe[]).map((groupe) =>
    evaluerGroupe(groupe, source),
  );
  const suspectes = clesPubliquesSuspectes(source);
  const requisComplets = groupes
    .filter((etat) => GROUPES_REQUIS.includes(etat.groupe))
    .every((etat) => etat.complet);

  return {
    environnement: source.APP_ENV ?? "(non defini)",
    groupes,
    clesPubliquesSuspectes: suspectes,
    demarrable: requisComplets && suspectes.length === 0,
  };
}

export class ConfigurationInvalide extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationInvalide";
  }
}

/**
 * Vérifie au démarrage. Échoue proprement : un message qui nomme les variables
 * en cause, sans jamais montrer une valeur.
 */
export function verifierAuDemarrage(source: Record<string, string | undefined> = process.env): void {
  const etat = diagnostiquer(source);

  if (etat.clesPubliquesSuspectes.length > 0) {
    throw new ConfigurationInvalide(
      "Cle privilegiee exposee au navigateur : " +
        `${etat.clesPubliquesSuspectes.join(", ")}. ` +
        "Aucune cle privilegiee ne doit porter le prefixe NEXT_PUBLIC_ (ch. 40).",
    );
  }

  const defauts = etat.groupes
    .filter((groupe) => GROUPES_REQUIS.includes(groupe.groupe))
    .filter((groupe) => !groupe.complet);

  if (defauts.length > 0) {
    const details = defauts
      .map((groupe) => {
        const parties: string[] = [];
        if (groupe.manquantes.length > 0) parties.push(`absentes : ${groupe.manquantes.join(", ")}`);
        if (groupe.invalides.length > 0) parties.push(`invalides : ${groupe.invalides.join(", ")}`);
        return `${groupe.libelle} — ${parties.join(" ; ")}`;
      })
      .join(" | ");

    throw new ConfigurationInvalide(
      `Configuration incomplete, demarrage refuse. ${details}. ` +
        "Voir .env.example et docs/05-mise-en-service.md.",
    );
  }
}

/**
 * Un groupe est-il utilisable ?
 *
 * Sert à décider si une fonctionnalité est disponible. Le ch. 35 est explicite :
 * l'absence de configuration doit produire une erreur contrôlée, jamais un
 * repli silencieux. Une fonctionnalité dont le groupe est incomplet est
 * affichée comme indisponible, pas simulée.
 */
export function groupeUtilisable(groupe: Groupe, source: Record<string, string | undefined> = process.env): boolean {
  return evaluerGroupe(groupe, source).complet;
}

/** Lecture typée d'un groupe, après vérification. Lève si le groupe est incomplet. */
export function lireGroupe<T extends Groupe>(
  groupe: T,
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const resultat = SCHEMAS[groupe].safeParse(source);
  if (!resultat.success) {
    const noms = [...new Set(resultat.error.issues.map((probleme) => String(probleme.path[0])))];
    throw new ConfigurationInvalide(
      `${LIBELLES[groupe]} : configuration absente ou invalide (${noms.join(", ")}).`,
    );
  }
  return resultat.data as Record<string, string>;
}

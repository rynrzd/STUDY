import "server-only";

import {
  analyserFichier,
  attribuerIdentifiants,
  classeNormalisee,
  construirePlan,
  fichierRejete,
  type ColonneReconnue,
  type Correspondance,
  type FichierAnalyse,
  type LigneEleve,
  type PlanImport,
} from "./assistant-rentree.ts";
import { genererAliasTechnique, genererMotDePasseTemporaire } from "./identite.ts";
import { FichierIllisible, lireTableur, TAILLE_MAXIMALE } from "./tableur.ts";
import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Le lot de rentrée, côté serveur — cahier V5, §5.
 *
 * L'analyse est **mise en attente**, pas appliquée : les fichiers déposés
 * produisent un lot, des jobs et des lignes dans `study.import_*`, et rien
 * d'autre. Aucune classe, aucun compte n'existe tant que l'administrateur n'a
 * pas relu et validé.
 *
 * Pourquoi persister plutôt que garder le plan en mémoire : la vérification
 * peut durer — dix fichiers, huit cents élèves, un coup de fil au secrétariat.
 * Redemander les fichiers à chaque correction serait intenable, et garder tout
 * dans la page rendrait la moindre fermeture d'onglet coûteuse.
 *
 * Les lignes en attente portent une date de purge : des noms d'élèves ne
 * traînent pas indéfiniment dans une table d'attente pour un import
 * abandonné.
 */

/**
 * Ce qui est mis en attente d'une ligne : le strict nécessaire pour créer le
 * compte plus tard, et rien du fichier d'origine. Le cahier (§11) interdit
 * d'accepter un mot de passe dans un fichier ; garder la ligne brute
 * reviendrait à en stocker un quand il s'y trouve.
 */
interface PayloadLigne {
  readonly nom: string;
  readonly prenom: string;
  readonly classe: string;
  readonly email: string | null;
  readonly identifiantExterne: string | null;
  readonly fichier: string;
}

const PURGE_JOURS = 30;

/** Élèves traités par appel : sous le délai d'une requête, même à 1 000 élèves (IMP-12). */
const TRANCHE = 150;

/* -------------------------------------------------------------------------- */
/* Analyse                                                                     */
/* -------------------------------------------------------------------------- */

export interface FichierDepose {
  readonly nom: string;
  readonly contenu: Buffer;
  /**
   * Correspondance choisie par l'administrateur à l'étape « Vérifier les
   * colonnes » (ch. 17). Absente : la reconnaissance automatique s'applique.
   * Les index hors du tableau sont écartés, jamais devinés.
   */
  readonly correspondance?: Correspondance;
}

/** Ne garde de la correspondance choisie que les colonnes qui existent. */
export function correspondanceBornee(correspondance: Correspondance | undefined, colonnes: number): Correspondance | undefined {
  if (correspondance === undefined) return undefined;
  const sortie: Correspondance = {};
  for (const [champ, index] of Object.entries(correspondance) as [keyof Correspondance, number | undefined][]) {
    if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < colonnes) sortie[champ] = index;
  }
  return sortie;
}

/**
 * Lit les fichiers déposés et enregistre le lot en attente.
 *
 * Un fichier illisible est rejeté **seul** : les neuf autres continuent, et
 * l'écran dit lequel a échoué et pourquoi (§5.1). C'est la différence entre un
 * import qui s'arrête à la première anomalie et un import qu'on peut terminer.
 */
export async function analyserLot(options: {
  acteur: string;
  organisation: string;
  annee: string;
  fichiers: readonly FichierDepose[];
}): Promise<{ lot: string; plan: PlanImport } | { erreur: string }> {
  if (options.fichiers.length === 0) {
    return { erreur: "Déposez au moins un fichier." };
  }

  const analyses: FichierAnalyse[] = [];

  for (const fichier of options.fichiers) {
    if (fichier.contenu.length > TAILLE_MAXIMALE) {
      analyses.push(
        fichierRejete(
          fichier.nom,
          fichier.contenu.length,
          `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE / (1024 * 1024))} Mo.`,
        ),
      );
      continue;
    }

    try {
      const tableau = lireTableur(fichier.nom, fichier.contenu);
      analyses.push(
        analyserFichier({
          nom: fichier.nom,
          octets: fichier.contenu.length,
          tableau,
          correspondance: correspondanceBornee(fichier.correspondance, tableau.entetes.length),
        }),
      );
    } catch (erreur) {
      analyses.push(
        fichierRejete(
          fichier.nom,
          fichier.contenu.length,
          erreur instanceof FichierIllisible
            ? erreur.message
            : "Ce fichier n'a pas pu être lu. Déposez un .xlsx ou un .csv.",
        ),
      );
    }
  }

  const plan = construirePlan(analyses);
  const client = clientExploitation("administration_des_comptes");

  const { data: lotCree, error } = await client.rpc("lot_ouvrir", {
    p_acteur: options.acteur,
    p_annee: options.annee,
    p_kind: "eleves",
  });

  if (error !== null || typeof lotCree !== "string") {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "lot.ouvrir", code: error?.code }));
    return { erreur: "Le lot n'a pas pu être ouvert." };
  }

  const purge = new Date(Date.now() + PURGE_JOURS * 86_400_000).toISOString();

  // Ce qui n'a pas pu être enregistré est dit, pas tu.
  //
  // Ces erreurs étaient ignorées : une insertion refusée faisait `continue`,
  // et l'écran de vérification s'ouvrait sur « Fichiers lus : 0 » sans
  // expliquer pourquoi. C'est exactement ce qui est arrivé en production —
  // une contrainte d'unicité refusait chaque fichier, en silence.
  const refus: string[] = [];

  for (const analyse of analyses) {
    const { data: job, error: refusJob } = await client
      .from("import_jobs")
      .insert({
        organization_id: options.organisation,
        academic_year_id: options.annee,
        kind: "eleves",
        state: analyse.erreur === null ? "apercu_pret" : "echoue",
        created_by: options.acteur,
        batch_id: lotCree,
        file_name: analyse.nom,
        classe_detectee: analyse.classe.nom,
        classe_source: analyse.classe.source === "inconnue" ? null : analyse.classe.source,
        mapping: {
          correspondance: analyse.correspondance,
          colonnes: analyse.colonnes,
          erreur: analyse.erreur,
        },
        rows_total: analyse.lignes.length,
        purge_after: purge,
      })
      .select("id")
      .single();

    const jobId = (job as { id: string } | null)?.id ?? null;

    if (jobId === null) {
      console.error(
        JSON.stringify({
          niveau: "erreur",
          contexte: "lot.enregistrer_fichier",
          fichier: analyse.nom,
          code: refusJob?.code ?? "inconnu",
        }),
      );
      refus.push(analyse.nom);
      continue;
    }

    const lignesDuFichier = plan.lignes.filter((ligne) => ligne.fichier === analyse.nom);
    if (lignesDuFichier.length === 0) continue;

    const { error: refusLignes } = await client.from("import_rows").insert(
      lignesDuFichier.map((ligne) => ({
        organization_id: options.organisation,
        import_job_id: jobId,
        row_number: ligne.numero,
        payload: enPayload(ligne),
        // Trois sorts possibles, pas deux. Une ligne en double exact - meme
        // nom, meme prenom, meme classe - n est ni valide ni fautive : elle
        // est deja couverte par la premiere. La creer produirait deux comptes
        // pour une personne, ce que le §5.8 interdit dans l esprit comme dans
        // la lettre. Elle est donc ecartee, et l ecran le dit.
        state: ligne.anomalies.some((a) => a.gravite === "bloquante")
          ? "rejete"
          : ligne.anomalies.some((a) => a.code === "doublon_fichier")
            ? "ignore"
            : "valide",
        issue_code: ligne.anomalies[0]?.code ?? null,
        issue_detail: ligne.anomalies.map((a) => a.message).join(" ") || null,
      })),
    );

    if (refusLignes !== null) {
      console.error(
        JSON.stringify({
          niveau: "erreur",
          contexte: "lot.enregistrer_lignes",
          fichier: analyse.nom,
          code: refusLignes.code,
        }),
      );
      refus.push(analyse.nom);
    }
  }

  // Aucun fichier enregistré : l'écran suivant serait vide et muet. Mieux vaut
  // le dire ici, là où la personne vient d'agir.
  if (refus.length === analyses.length) {
    return {
      erreur:
        "Aucun fichier n'a pu être enregistré. Réessayez dans un instant ; " +
        "si cela se reproduit, signalez-le à votre interlocuteur AvecStudy.",
    };
  }

  return { lot: lotCree, plan };
}

function enPayload(ligne: LigneEleve): PayloadLigne {
  return {
    nom: ligne.nom,
    prenom: ligne.prenom,
    classe: ligne.classe,
    email: ligne.email,
    identifiantExterne: ligne.identifiantExterne,
    fichier: ligne.fichier,
  };
}

/* -------------------------------------------------------------------------- */
/* Relecture                                                                   */
/* -------------------------------------------------------------------------- */

export interface FichierDuLot {
  readonly jobId: string;
  readonly nom: string;
  readonly etat: string;
  readonly classeDetectee: string | null;
  readonly classeSource: string | null;
  readonly colonnes: readonly ColonneReconnue[];
  readonly correspondance: Correspondance;
  readonly erreur: string | null;
  readonly lignes: number;
}

export interface LigneDuLot {
  readonly id: string;
  readonly numero: number;
  readonly fichier: string;
  readonly nom: string;
  readonly prenom: string;
  readonly classe: string;
  readonly email: string | null;
  /**
   * L'identifiant national, quand le fichier en portait un.
   *
   * Il était lu puis jeté au moment d'appliquer. C'est pourtant la seule
   * clé stable d'une année sur l'autre : sans lui, reconnaître quelqu'un
   * revient à comparer des noms.
   */
  readonly identifiantExterne: string | null;
  /**
   * Le sort de la ligne.
   *
   * « ignoree » est le cas du doublon exact : rien à corriger, rien à
   * créer non plus. Le confondre avec « à corriger » ferait clignoter un
   * bloquant pour une ligne qui ne demande aucune action.
   */
  readonly etat: "valide" | "a_corriger" | "ignoree" | "appliquee";
  readonly probleme: string | null;
}

export interface LotComplet {
  readonly id: string;
  readonly etat: string;
  readonly fichiers: readonly FichierDuLot[];
  readonly lignes: readonly LigneDuLot[];
  readonly classes: readonly { nom: string; effectif: number }[];
  readonly compte: {
    readonly fichiersLus: number;
    readonly fichiersRejetes: number;
    readonly lignesLues: number;
    readonly valides: number;
    readonly ignorees: number;
    readonly bloquantes: number;
  };
  readonly blocages: readonly string[];
  readonly rapport: Record<string, number> | null;
}

/** Relit un lot en attente, pour l'écran de vérification (§5.5). */
export async function lireLot(acteur: string, lot: string): Promise<LotComplet | null> {
  const client = clientExploitation("administration_des_comptes");

  const { data: enTete } = await client
    .from("import_batches")
    .select("id, state, organization_id, created_by, rapport")
    .eq("id", lot)
    .maybeSingle();

  const entree = enTete as
    | { id: string; state: string; organization_id: string; created_by: string; rapport: unknown }
    | null;

  // Le lot appartient-il à cet administrateur ? La question se pose ici parce
  // que l'identifiant vient de l'adresse. `etab_contexte` recalcule son
  // établissement, et un lot d'ailleurs ne ressort pas.
  if (entree === null) return null;

  const { data: contexte } = await client.rpc("etab_contexte", { p_acteur: acteur });
  const organisation = (Array.isArray(contexte) ? contexte[0] : null)?.organization_id ?? null;
  if (organisation === null || organisation !== entree.organization_id) return null;

  const { data: jobs } = await client
    .from("import_jobs")
    .select("id, file_name, state, classe_detectee, classe_source, mapping, rows_total")
    .eq("batch_id", lot)
    .order("file_name");

  const fichiers: FichierDuLot[] = (
    (jobs ?? []) as unknown as {
      id: string;
      file_name: string;
      state: string;
      classe_detectee: string | null;
      classe_source: string | null;
      mapping: { correspondance?: Correspondance; colonnes?: ColonneReconnue[]; erreur?: string | null } | null;
      rows_total: number;
    }[]
  ).map((job) => ({
    jobId: job.id,
    nom: job.file_name ?? "(sans nom)",
    etat: job.state,
    classeDetectee: job.classe_detectee,
    classeSource: job.classe_source,
    colonnes: job.mapping?.colonnes ?? [],
    correspondance: job.mapping?.correspondance ?? {},
    erreur: job.mapping?.erreur ?? null,
    lignes: job.rows_total,
  }));

  // Toutes les lignes, par pages : une limite fixe tronquait en silence les
  // lots de plus de 2 000 élèves (DATA-09, IMP-12).
  const rows: unknown[] = [];
  for (let debut = 0; ; debut += 1000) {
    const { data: page } = await client
      .from("import_rows")
      .select("id, row_number, payload, state, issue_detail, import_job_id")
      .in("import_job_id", fichiers.map((fichier) => fichier.jobId))
      .order("import_job_id")
      .order("row_number")
      .range(debut, debut + 999);
    rows.push(...(page ?? []));
    if ((page ?? []).length < 1000 || debut >= 20_000) break;
  }

  const lignes: LigneDuLot[] = (
    rows as {
      id: string;
      row_number: number;
      payload: PayloadLigne;
      state: string;
      issue_detail: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    numero: row.row_number,
    fichier: row.payload.fichier,
    nom: row.payload.nom,
    prenom: row.payload.prenom,
    classe: row.payload.classe,
    email: row.payload.email,
    identifiantExterne: row.payload.identifiantExterne ?? null,
    etat:
      row.state === "valide"
        ? "valide"
        : row.state === "ignore"
          ? "ignoree"
          : row.state === "applique"
            ? "appliquee"
            : "a_corriger",
    probleme: row.issue_detail,
  }));

  const bloquantes = lignes.filter((ligne) => ligne.etat === "a_corriger").length;
  const ignorees = lignes.filter((ligne) => ligne.etat === "ignoree").length;
  const retenues = lignes.filter((ligne) => ligne.etat === "valide");

  // Le regroupement se fait sur la forme **comparée**, pas sur la forme
  // écrite. C'est la règle de tout l'assistant : « 2nde 4 » et « SECONDE 4 »
  // désignent une seule classe, et `study.lot_classe` n'en créera qu'une.
  //
  // Grouper sur le libellé brut faisait mentir l'écran : il annonçait deux
  // classes là où une seule allait naître. Un aperçu qui ne correspond pas à
  // ce qui sera créé ôte tout intérêt à la vérification.
  //
  // Le nom affiché reste la première écriture rencontrée : l'établissement
  // doit se reconnaître dans ce qu'il a écrit.
  const parClasse = new Map<string, { nom: string; effectif: number }>();
  for (const ligne of retenues) {
    if (ligne.classe === "") continue;
    const cle = classeNormalisee(ligne.classe);
    const entree = parClasse.get(cle);
    if (entree === undefined) {
      parClasse.set(cle, { nom: ligne.classe, effectif: 1 });
    } else {
      entree.effectif += 1;
    }
  }

  const blocages: string[] = [];

  for (const fichier of fichiers) {
    if (fichier.erreur !== null) continue;
    if (fichier.correspondance.nom === undefined || fichier.correspondance.prenom === undefined) {
      blocages.push(`${fichier.nom} : le nom ou le prénom n'a pas été reconnu.`);
    }
  }
  if (bloquantes > 0) {
    blocages.push(
      `${bloquantes} ligne${bloquantes > 1 ? "s" : ""} à corriger avant de créer les comptes.`,
    );
  }
  if (lignes.length === 0) {
    blocages.push("Aucun élève n'a été lu.");
  }

  return {
    id: entree.id,
    etat: entree.state,
    fichiers,
    lignes,
    classes: [...parClasse.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    compte: {
      fichiersLus: fichiers.filter((fichier) => fichier.erreur === null).length,
      fichiersRejetes: fichiers.filter((fichier) => fichier.erreur !== null).length,
      lignesLues: lignes.length,
      valides: retenues.length,
      ignorees,
      bloquantes,
    },
    blocages,
    rapport: (entree.rapport as Record<string, number> | null) ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Correction                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Corrige une ligne en attente (§5.5).
 *
 * Après correction, la ligne est réévaluée : si nom, prénom et classe sont là,
 * elle redevient valide et les compteurs de l'écran suivent. Une correction qui
 * ne recalculerait pas le compte laisserait le bouton « Créer » fermé sans
 * raison visible.
 */
export async function corrigerLigne(options: {
  acteur: string;
  ligne: string;
  nom: string;
  prenom: string;
  classe: string;
}): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");

  const { data } = await client
    .from("import_rows")
    .select("id, payload, organization_id")
    .eq("id", options.ligne)
    .maybeSingle();

  const row = data as { id: string; payload: PayloadLigne; organization_id: string } | null;
  if (row === null) return false;

  const { data: contexte } = await client.rpc("etab_contexte", { p_acteur: options.acteur });
  const organisation = (Array.isArray(contexte) ? contexte[0] : null)?.organization_id ?? null;
  if (organisation === null || organisation !== row.organization_id) return false;

  const nom = options.nom.trim();
  const prenom = options.prenom.trim();
  const classe = options.classe.trim();
  const complet = nom !== "" && prenom !== "" && classe !== "";

  const { error } = await client
    .from("import_rows")
    .update({
      payload: { ...row.payload, nom, prenom, classe },
      state: complet ? "valide" : "rejete",
      issue_detail: complet ? null : "Nom, prénom et classe sont obligatoires.",
      corrige: true,
    })
    .eq("id", options.ligne);

  return error === null;
}

/** Fixe la classe d'un fichier, quand la détection a échoué ou s'est trompée. */
export async function definirClasse(options: {
  acteur: string;
  job: string;
  classe: string;
}): Promise<boolean> {
  const client = clientExploitation("administration_des_comptes");
  const classe = options.classe.trim();
  if (classe === "") return false;

  const { data } = await client
    .from("import_jobs")
    .select("id, organization_id")
    .eq("id", options.job)
    .maybeSingle();

  const job = data as { id: string; organization_id: string } | null;
  if (job === null) return false;

  const { data: contexte } = await client.rpc("etab_contexte", { p_acteur: options.acteur });
  const organisation = (Array.isArray(contexte) ? contexte[0] : null)?.organization_id ?? null;
  if (organisation === null || organisation !== job.organization_id) return false;

  await client
    .from("import_jobs")
    .update({ classe_detectee: classe, classe_source: "saisie" })
    .eq("id", options.job);

  // Les lignes du fichier qui n'avaient pas de classe reçoivent celle-ci, et
  // redeviennent valides si rien d'autre ne manque.
  const { data: rows } = await client
    .from("import_rows")
    .select("id, payload")
    .eq("import_job_id", options.job)
    .limit(2000);

  for (const brut of ((rows ?? []) as unknown as { id: string; payload: PayloadLigne }[])) {
    if (brut.payload.classe !== "") continue;
    const complet = brut.payload.nom !== "" && brut.payload.prenom !== "";
    await client
      .from("import_rows")
      .update({
        payload: { ...brut.payload, classe },
        state: complet ? "valide" : "rejete",
        issue_detail: complet ? null : "Nom et prénom sont obligatoires.",
      })
      .eq("id", brut.id);
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Application                                                                 */
/* -------------------------------------------------------------------------- */

export interface AccesCree {
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string;
  readonly login: string;
  readonly motDePasseTemporaire: string;
}

export interface RapportLot {
  readonly cree: number;
  readonly existant: number;
  readonly reinscrit: number;
  readonly erreurs: number;
  /** Lignes « à confirmer » écartées faute d'accord (IMP-02) : rien n'a été fusionné. */
  readonly ecartes: number;
  /** Élèves encore à traiter : l'application se fait par tranches (IMP-12). */
  readonly restantes: number;
  readonly acces: readonly AccesCree[];
  readonly echecs: readonly { ligne: number; raison: string }[];
}

/**
 * Applique un lot : c'est le seul endroit où des comptes apparaissent.
 *
 * Chaque ligne est traitée séparément — compte chez le fournisseur d'identité,
 * puis écriture en base — et rend son sort. Une ligne qui échoue n'annule pas
 * les précédentes : le §5.6 demande un état cohérent et reprenable, pas un
 * tout-ou-rien qui punirait sept cents élèves corrects pour une ligne fautive.
 * Le lot rejoué après correction ne recrée rien, l'identifiant local servant
 * de clé.
 */
export async function appliquerLot(options: {
  acteur: string;
  organisation: string;
  annee: string;
  lot: string;
  domaineAlias: string;
  /** L'administrateur a confirmé que les lignes « à confirmer » sont les mêmes élèves. */
  confirmerConflits?: boolean;
}): Promise<RapportLot | { erreur: string }> {
  const complet = await lireLot(options.acteur, options.lot);
  if (complet === null) return { erreur: "Ce lot est introuvable." };
  if (complet.etat === "applique") return { erreur: "Ce lot a déjà été appliqué." };
  // Les blocages se vérifient avant de commencer. Une fois des lignes
  // appliquées, une ligne en échec d'une tranche précédente n'empêche pas de
  // finir les autres : elle reste signalée, à corriger à part.
  const commence = complet.lignes.some((ligne) => ligne.etat === "appliquee");
  if (!commence && complet.blocages.length > 0) {
    return { erreur: "Des erreurs restent à corriger avant de créer les comptes." };
  }

  const client = clientExploitation("administration_des_comptes");

  // IMP-02 : même nom qu'un élève d'une autre classe, sans INE pour trancher.
  // Sans accord explicite, ces lignes ne sont pas appliquées : on ne fusionne
  // pas deux homonymes, et on ne déplace pas un élève sur une supposition.
  const ecarter = new Set<string>();
  if (!options.confirmerConflits) {
    const { data: rappro, error: refusRappro } = await client.rpc("etab_lot_rapprochement", { p_acteur: options.acteur, p_lot: options.lot });
    if (refusRappro !== null) return { erreur: "Le rapprochement avec les élèves existants n'a pas pu être fait. Rien n'a été créé." };
    for (const r of (rappro ?? []) as { ligne: string; statut: string }[]) if (r.statut === "conflit") ecarter.add(r.ligne);
  }

  // Par tranches (IMP-12) : chaque ligne traitée est marquée « applique » ;
  // une interruption ne perd rien, la reprise ne recrée rien.
  const candidates = complet.lignes.filter((ligne) => ligne.etat === "valide" && !ecarter.has(ligne.id));
  const tranche = candidates.slice(0, TRANCHE);
  const restantes = candidates.length - tranche.length;
  const identifiantDe = new Map<LigneEleve, string>();
  const aTraiter: LigneEleve[] = tranche
    .map((ligne) => ({
      fichier: ligne.fichier,
      numero: ligne.numero,
      nom: ligne.nom,
      prenom: ligne.prenom,
      classe: ligne.classe,
      email: ligne.email,
      identifiantExterne: ligne.identifiantExterne,
      anomalies: [],
      __id: ligne.id,
    }))
    .map(({ __id, ...l }) => {
      identifiantDe.set(l, __id);
      return l;
    });
  const marquer = async (ligne: LigneEleve, etat: "applique" | "rejete", detail: string | null) => {
    const id = identifiantDe.get(ligne);
    if (id !== undefined) await client.from("import_rows").update({ state: etat, issue_detail: detail }).eq("id", id);
  };

  // On propose une **racine**, pas un identifiant définitif.
  //
  // Le suffixe était calculé ici, à partir des identifiants déjà pris. Cela
  // cassait le réimport : au second passage, « zofia.swiatek » était prise —
  // par Zofia — donc on proposait « zofia.swiatek2 », que la base ne
  // reconnaissait pas et qu'elle créait. Chaque réimport fabriquait une
  // personne de plus.
  //
  // C'est désormais la base qui identifie la personne, puis cherche un
  // identifiant libre si elle doit vraiment la créer.
  const attribues = attribuerIdentifiants(aTraiter, new Set<string>());

  let cree = 0;
  let existant = 0;
  let reinscrit = 0;
  const acces: AccesCree[] = [];
  const echecs: { ligne: number; raison: string }[] = [];

  for (const { ligne, login } of attribues) {
    const motDePasse = genererMotDePasseTemporaire(16);
    const alias = genererAliasTechnique(options.domaineAlias);

    const creation = await client.auth.admin.createUser({
      email: alias,
      password: motDePasse,
      email_confirm: true,
    });

    if (creation.error !== null || creation.data.user === null) {
      echecs.push({ ligne: ligne.numero, raison: "Compte de connexion non créé" });
      await marquer(ligne, "rejete", "Compte de connexion non créé : réessayez cette ligne.");
      continue;
    }

    const profileId = creation.data.user.id;

    const { data, error } = await client.rpc("lot_inscrire_eleve", {
      p_acteur: options.acteur,
      p_lot: options.lot,
      p_annee: options.annee,
      p_profile: profileId,
      p_prenom: ligne.prenom,
      p_nom: ligne.nom,
      p_login: login,
      p_alias: alias,
      p_classe_label: ligne.classe,
      p_identifiant_externe: ligne.identifiantExterne,
    });

    if (error !== null) {
      await client.auth.admin.deleteUser(profileId).catch(() => undefined);
      const raison = error.code === "23505" ? "Identifiant déjà utilisé" : "Écriture refusée";
      echecs.push({ ligne: ligne.numero, raison });
      await marquer(ligne, "rejete", raison);
      continue;
    }

    const resultat = (Array.isArray(data) ? data[0] : null)?.resultat ?? "erreur";

    await marquer(ligne, "applique", null);
    if (resultat === "cree") {
      cree += 1;

      // L'identifiant imprimé est celui que la base a écrit, pas celui
      // qu'on a proposé : elle a pu le suffixer pour éviter un homonyme.
      // Imprimer la proposition enverrait l'élève se connecter avec un
      // identifiant qui n'existe pas.
      const { data: reel } = await client.rpc("etab_login_de", {
        p_acteur: options.acteur,
        p_profile: profileId,
      });

      acces.push({
        prenom: ligne.prenom,
        nom: ligne.nom,
        classe: ligne.classe,
        login: typeof reel === "string" && reel !== "" ? reel : login,
        motDePasseTemporaire: motDePasse,
      });
      continue;
    }

    // La personne existait déjà : le compte fournisseur créé à l'instant n'a
    // plus de raison d'être, et l'alias doit être libéré.
    await client.auth.admin.deleteUser(profileId).catch(() => undefined);
    if (resultat === "reinscrit") reinscrit += 1;
    else existant += 1;
  }

  const rapport: RapportLot = {
    cree,
    existant,
    reinscrit,
    erreurs: echecs.length,
    ecartes: ecarter.size,
    restantes,
    acces,
    echecs,
  };

  // Le compte rendu écrit en base ne contient ni mot de passe ni identité :
  // seulement des nombres.
  // Le lot ne se clôt qu'une fois tout traité.
  if (restantes === 0) {
    await client.rpc("lot_clore", {
      p_acteur: options.acteur,
      p_lot: options.lot,
      p_rapport: { cree, existant, reinscrit, erreur: echecs.length, ecarte: ecarter.size },
    });
  }

  return rapport;
}

/** L'historique des imports, pour l'écran d'administration (§9). */
export async function historiqueImports(acteur: string) {
  const client = clientExploitation("administration_des_comptes");
  const { data, error } = await client.rpc("lot_historique", { p_acteur: acteur, p_limite: 30 });
  if (error !== null) return [];
  return (data ?? []) as {
    id: string;
    kind: string;
    state: string;
    created_at: string;
    applied_at: string | null;
    rapport: Record<string, number> | null;
  }[];
}

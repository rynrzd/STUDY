import "server-only";

import { clientExploitation } from "./supabase-serveur.ts";

/**
 * Drain de la file de travaux — cahier « Refonte fidèle », T03, T04, T08.
 *
 * Le worker du chapitre 39 reste la bonne façon de traiter une file : un
 * processus qui tourne, prend un job, le fait, recommence. Il lui manque un
 * hébergement, et tant qu'il n'en a pas, un import de cours ne se termine
 * jamais. Ce module est la seconde voie : **le serveur de l'application draine
 * la file lui-même**, avec un budget de temps.
 *
 * Ce n'est pas un second système. C'est la même file, les mêmes états, le même
 * bail : `scripts/worker.mjs` et ce module peuvent tourner en même temps sans
 * se marcher dessus — `prendre_job` fait un `FOR UPDATE SKIP LOCKED`, deux
 * preneurs n'obtiennent jamais le même travail.
 *
 * Le budget de temps est la précaution qui compte. Une fonction sans serveur a
 * une durée bornée : on prend des travaux tant qu'il reste de la marge, puis on
 * rend la main. Ce qui reste attend le tour suivant — c'est exactement ce à
 * quoi sert une file durable.
 */

/** Ce qu'un gestionnaire reçoit. Rien d'autre que ce dont il a besoin. */
export interface Travail {
  readonly id: string;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly maxAttempts: number;
}

/**
 * Ce qu'un gestionnaire rend.
 *
 * `refus` distingue le cas courant du cas anormal : un professeur qui dépose un
 * scan n'est pas une panne. Le travail est marqué terminé, parce que le rejouer
 * trois fois donnerait trois fois le même refus.
 */
export type ResultatTravail = { readonly ok: true } | { readonly ok: false; readonly refus: string };

export type Gestionnaire = (travail: Travail) => Promise<ResultatTravail>;

/**
 * Les types traités depuis le BFF.
 *
 * Volontairement restreint à l'import de cours. Les autres types de la file —
 * comptes, notifications, factures — dépendent de services qui ne sont pas
 * raccordés ; les prendre ici ne ferait que les faire échouer plus vite.
 */
export const TYPES_TRAITES = ["import_cours"] as const;

const GESTIONNAIRES: Record<string, Gestionnaire> = {
  async import_cours(travail) {
    const { document, fichier, proprietaire, organisation } = travail.payload as Record<
      string,
      string | undefined
    >;

    if (!document || !fichier || !proprietaire || !organisation) {
      throw new Error("job import_cours incomplet");
    }

    const { convertir } = await import("./studio-documents.ts");
    const resultat = await convertir({ organisation, document, fichier, proprietaire });

    return resultat.ok ? { ok: true } : { ok: false, refus: resultat.message };
  },
};

export interface Bilan {
  readonly pris: number;
  readonly termines: number;
  readonly refuses: number;
  readonly echoues: number;
  /** Vrai si la file n'était pas vide quand on a rendu la main. */
  readonly reste: boolean;
}

const BAIL_SECONDES = 120;

/**
 * Draine la file jusqu'à épuisement du budget.
 *
 * `budgetMs` doit rester nettement sous la durée maximale de la fonction : on
 * s'arrête avant de commencer un travail qu'on ne pourrait pas finir, plutôt
 * que d'être coupé au milieu et de laisser un bail à expirer.
 */
export async function drainer(options: { budgetMs?: number; nom?: string } = {}): Promise<Bilan> {
  const budget = options.budgetMs ?? 20_000;
  const nom = options.nom ?? `bff-${process.pid}`;
  const echeance = Date.now() + budget;

  const client = clientExploitation("tache_planifiee");

  let pris = 0;
  let termines = 0;
  let refuses = 0;
  let echoues = 0;
  let reste = false;

  // On ne démarre un travail que s'il reste de quoi en faire un : la durée
  // observée d'une conversion est de l'ordre de la seconde, on garde cinq.
  while (Date.now() + 5_000 < echeance) {
    const { data, error } = await client.rpc("travaux_prendre", {
      p_types: [...TYPES_TRAITES],
      p_worker: nom,
      p_bail_secondes: BAIL_SECONDES,
    });

    if (error !== null) {
      console.error(JSON.stringify({ niveau: "erreur", contexte: "travaux.prendre", code: error.code }));
      break;
    }

    const ligne = (Array.isArray(data) ? data[0] : null) as
      | { id: string; kind: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }
      | null
      | undefined;

    if (ligne == null || ligne.id == null) break;

    pris += 1;
    const travail: Travail = {
      id: ligne.id,
      kind: ligne.kind,
      payload: ligne.payload ?? {},
      attempts: ligne.attempts,
      maxAttempts: ligne.max_attempts,
    };

    const gestionnaire = GESTIONNAIRES[travail.kind];

    if (gestionnaire === undefined) {
      await client.rpc("travaux_echouer", {
        p_job: travail.id,
        p_motif: `type de travail inconnu : ${travail.kind}`,
      });
      echoues += 1;
      continue;
    }

    try {
      const resultat = await gestionnaire(travail);
      await client.rpc("travaux_terminer", { p_job: travail.id });

      if (resultat.ok) {
        termines += 1;
      } else {
        refuses += 1;
        // Un refus n'est pas une panne : il est déjà écrit sur le document que
        // le professeur consulte. On le note au journal technique, sans détail
        // de contenu, et on passe.
        console.warn(
          JSON.stringify({ niveau: "info", contexte: "travaux.refus", kind: travail.kind }),
        );
      }
    } catch (erreur) {
      echoues += 1;
      const motif = erreur instanceof Error ? erreur.message : "erreur inconnue";
      await client.rpc("travaux_echouer", { p_job: travail.id, p_motif: motif });
      console.error(
        JSON.stringify({ niveau: "erreur", contexte: "travaux.execution", kind: travail.kind }),
      );
    }
  }

  // S'il restait quelque chose quand le budget s'est épuisé, on le dit : la
  // tâche planifiée suivante le prendra, et la supervision voit la file monter.
  if (Date.now() + 5_000 >= echeance) reste = true;

  return { pris, termines, refuses, echoues, reste };
}

/**
 * Réveille le drain sans attendre la tâche planifiée.
 *
 * Appelé juste après un dépôt de document : le professeur vient de cliquer, il
 * regarde l'écran de progression, et attendre la minute suivante pour commencer
 * serait absurde. L'appel ne bloque pas la réponse et n'échoue jamais bruyamment
 * — si le réveil ne part pas, la tâche planifiée fera le travail.
 */
export function reveiller(): void {
  const origine = (process.env.APP_ORIGIN ?? "").trim();
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (origine === "" || secret === "") return;

  void fetch(new URL("/api/v1/travaux", origine), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    // On ne veut pas de la réponse : seulement que le traitement démarre.
    keepalive: true,
  }).catch(() => undefined);
}

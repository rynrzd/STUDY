"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assuranceSuffisante, REFUS_ASSURANCE } from "@/lib/garde-assurance";
import { moderer } from "@/lib/moderation";
import { sessionCourante } from "@/lib/session-serveur";

import type { EtatModeration } from "./etats";

/**
 * Les décisions de modération — cahier V5, §7.
 *
 * **Qui décide.** L'administrateur de l'établissement. Pas le professeur du
 * cours : il participe à l'entraide, et lui confier l'arbitrage d'un conflit
 * entre ses propres élèves mélangerait deux rôles. Il garde ce qu'il avait
 * déjà — masquer un contenu de son cours — mais ce geste-là ne clôt aucun
 * signalement et ne répond à personne.
 *
 * **La vérification est ici, pas dans l'écran.** Une action serveur est une
 * route : elle s'atteint directement, sans passer par la page. Le rôle et le
 * second facteur sont donc relus au début de chaque appel.
 *
 * La base refait le même contrôle de son côté, dans `moderer_signalement` :
 * deux barrières, parce que celle-ci protège contre une route atteinte
 * directement, et celle-là contre une erreur de ce fichier.
 */

const REFUS: EtatModeration = { etat: "erreur", message: "Action refusée." };

async function moderateur(): Promise<{ profileId: string; organisation: string } | null> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return null;
  if (!personne.roles.includes("admin_etablissement")) return null;
  if (personne.organizationId === null) return null;

  if (!(await assuranceSuffisante(personne))) return null;

  return { profileId: personne.profileId, organisation: personne.organizationId };
}

export async function deciderDUnSignalement(
  _precedent: EtatModeration,
  donnees: FormData,
): Promise<EtatModeration> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) return REFUS;
  if (!(await assuranceSuffisante(personne))) {
    return { etat: "erreur", message: REFUS_ASSURANCE };
  }

  const qui = await moderateur();
  if (qui === null) return REFUS;

  const analyse = z
    .object({
      signalement: z.string().uuid(),
      decision: z.enum(["masquer", "restaurer", "classer_sans_suite"]),
      justification: z.string().trim().min(10).max(2000),
    })
    .safeParse({
      signalement: donnees.get("signalement"),
      decision: donnees.get("decision"),
      justification: donnees.get("justification") ?? "",
    });

  if (!analyse.success) {
    return {
      etat: "erreur",
      message:
        "Écrivez en une phrase ce qui motive cette décision. Elle sera conservée, et c'est ce qui permet d'y répondre plus tard.",
    };
  }

  const resultat = await moderer({
    moderateur: qui.profileId,
    signalement: analyse.data.signalement,
    decision: analyse.data.decision,
    justification: analyse.data.justification,
  });

  if (!resultat.ok) return { etat: "erreur", message: resultat.message };

  revalidatePath("/admin/moderation");

  const MESSAGES: Record<string, string> = {
    masquer: "Message masqué. Il n'est plus lisible par la classe, et la décision est journalisée.",
    restaurer: "Message rétabli. Il redevient lisible par la classe.",
    classer_sans_suite:
      "Signalement classé sans suite. Le message reste en place, et la décision est journalisée.",
  };

  return { etat: "ok", message: MESSAGES[analyse.data.decision] ?? "Décision enregistrée." };
}

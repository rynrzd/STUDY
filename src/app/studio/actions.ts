"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { deposerSupport } from "@/lib/documents";
import { dupliquerSeance } from "@/lib/duplication";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import type { EtatStudio } from "./etats";

/**
 * Actions du Studio — cahier V2, §9.
 *
 * Chacune agit **avec le jeton du professeur**, jamais avec la clé de service.
 * L'autorisation n'est donc pas une vérification écrite ici, qu'on pourrait
 * oublier sur une action future : c'est la base qui refuse. Une action sur un
 * cours qu'on n'enseigne pas n'écrit rien et répond comme si l'objet
 * n'existait pas.
 *
 * Chaque action renvoie un message destiné à l'écran, jamais le message du
 * moteur : il révélerait la structure de la base.
 */

async function jetonDuProfesseur(): Promise<string | null> {
  const personne = await sessionCourante();
  if (personne === null) return null;
  if (personne.activationRequise) return null;
  if (!personne.roles.includes("professeur")) return null;
  return jetonAccesDe(personne);
}

const REFUS: EtatStudio = {
  etat: "erreur",
  message: "Cette action n'a pas pu être effectuée.",
};

/* ========================================================================== */
/* Chapitres                                                                   */
/* ========================================================================== */

export async function creerChapitre(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const analyse = z
    .object({
      cours: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
    })
    .safeParse({ cours: donnees.get("cours"), label: donnees.get("label") });

  if (!analyse.success) {
    return { etat: "erreur", message: "Donnez un titre au chapitre." };
  }

  const client = clientUtilisateur(jeton);

  // La position suit le dernier chapitre du cours. On la lit sous RLS : si le
  // cours n'est pas le nôtre, la lecture ne renvoie rien et l'insertion sera
  // refusée juste après.
  const { data: dernier } = await client
    .from("chapters")
    .select("position")
    .eq("teaching_space_id", analyse.data.cours)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await client
    .from("chapters")
    .insert({
      organization_id: await organisationDuCours(jeton, analyse.data.cours),
      teaching_space_id: analyse.data.cours,
      label: analyse.data.label,
      position: ((dernier as { position: number } | null)?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error !== null) return REFUS;

  revalidatePath("/studio");
  return { etat: "ok", message: "Chapitre créé.", cree: data.id };
}

export async function renommerChapitre(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const analyse = z
    .object({ id: z.string().uuid(), label: z.string().trim().min(1).max(120) })
    .safeParse({ id: donnees.get("id"), label: donnees.get("label") });

  if (!analyse.success) return { etat: "erreur", message: "Titre invalide." };

  const { error } = await clientUtilisateur(jeton)
    .from("chapters")
    .update({ label: analyse.data.label })
    .eq("id", analyse.data.id);

  if (error !== null) return REFUS;

  revalidatePath("/studio");
  return { etat: "ok", message: "Chapitre renommé." };
}

/* ========================================================================== */
/* Séances                                                                     */
/* ========================================================================== */

export async function creerSeance(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const personne = await sessionCourante();
  const jeton = await jetonDuProfesseur();
  if (jeton === null || personne === null) return REFUS;

  const analyse = z
    .object({
      cours: z.string().uuid(),
      chapitre: z.string().uuid().optional().or(z.literal("")),
      titre: z.string().trim().min(1).max(160),
      date: z.string().trim().optional().or(z.literal("")),
    })
    .safeParse({
      cours: donnees.get("cours"),
      chapitre: donnees.get("chapitre") ?? "",
      titre: donnees.get("titre"),
      date: donnees.get("date") ?? "",
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Donnez un titre à la séance." };
  }

  const { data, error } = await clientUtilisateur(jeton)
    .from("lessons")
    .insert({
      organization_id: await organisationDuCours(jeton, analyse.data.cours),
      teaching_space_id: analyse.data.cours,
      chapter_id: analyse.data.chapitre === "" ? null : analyse.data.chapitre,
      title: analyse.data.titre,
      // Brouillon par défaut : une séance n'est jamais visible tant qu'elle
      // n'a pas été publiée (§9.3).
      state: "brouillon",
      scheduled_for:
        analyse.data.date === "" || analyse.data.date === undefined
          ? null
          : new Date(`${analyse.data.date}T08:00:00`).toISOString(),
      created_by: personne.profileId,
    })
    .select("id")
    .single();

  if (error !== null) return REFUS;

  revalidatePath("/studio");
  return { etat: "ok", message: "Séance créée.", cree: data.id };
}

export async function majSeance(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const analyse = z
    .object({
      id: z.string().uuid(),
      titre: z.string().trim().min(1).max(160),
      objectif: z.string().trim().max(400).optional().or(z.literal("")),
      chapitre: z.string().uuid().optional().or(z.literal("")),
      date: z.string().trim().optional().or(z.literal("")),
    })
    .safeParse({
      id: donnees.get("id"),
      titre: donnees.get("titre"),
      objectif: donnees.get("objectif") ?? "",
      chapitre: donnees.get("chapitre") ?? "",
      date: donnees.get("date") ?? "",
    });

  if (!analyse.success) return { etat: "erreur", message: "Vérifiez le titre." };

  const { error } = await clientUtilisateur(jeton)
    .from("lessons")
    .update({
      title: analyse.data.titre,
      objective: analyse.data.objectif === "" ? null : analyse.data.objectif,
      chapter_id: analyse.data.chapitre === "" ? null : analyse.data.chapitre,
      scheduled_for:
        analyse.data.date === "" || analyse.data.date === undefined
          ? null
          : new Date(`${analyse.data.date}T08:00:00`).toISOString(),
    })
    .eq("id", analyse.data.id);

  if (error !== null) return REFUS;

  revalidatePath(`/studio/${analyse.data.id}`);
  return { etat: "ok", message: "Enregistré." };
}

/**
 * Publier ou dépublier une séance — cahier V2, §9.5.
 *
 * Publier n'est pas un simple changement d'état : la base exige qu'une séance
 * publiée porte une **version figée** de son contenu
 * (`lessons_published_needs_version`). C'est ce qui donne son sens à la
 * publication — ce que la classe a vu ce jour-là reste consultable même si le
 * professeur remanie sa séance ensuite.
 *
 * L'ordre compte : la version est scellée d'abord, la séance bascule ensuite.
 * L'inverse laisserait, le temps d'un aller-retour, une séance annoncée publiée
 * sans contenu figé — et la base la refuserait de toute façon.
 *
 * Dépublier ne détruit pas la version : elle reste attachée, et la séance
 * redevient un brouillon. Une publication effacée serait une trace effacée.
 */
export async function publierSeance(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return REFUS;
  if (!personne.roles.includes("professeur")) return REFUS;

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return REFUS;

  const analyse = z
    .object({ id: z.string().uuid(), publier: z.enum(["oui", "non"]) })
    .safeParse({ id: donnees.get("id"), publier: donnees.get("publier") });

  if (!analyse.success) return REFUS;

  const publier = analyse.data.publier === "oui";
  const client = clientUtilisateur(jeton);

  if (!publier) {
    const { error } = await client
      .from("lessons")
      .update({ state: "brouillon", published_at: null })
      .eq("id", analyse.data.id);

    if (error !== null) return REFUS;

    revalidatePath(`/studio/${analyse.data.id}`);
    revalidatePath("/eleve");
    return { etat: "ok", message: "Séance dépubliée : elle redevient un brouillon." };
  }

  // Relecture sous RLS : une séance qui n'est pas la nôtre ne revient pas.
  const { data: laSeance } = await client
    .from("lessons")
    .select("organization_id, teaching_space_id")
    .eq("id", analyse.data.id)
    .maybeSingle();

  const contexte = laSeance as { organization_id: string; teaching_space_id: string } | null;
  if (contexte === null) return REFUS;

  const { data: blocs } = await client
    .from("lesson_blocks")
    .select("kind, position, contenu, file_id, assignment_id")
    .eq("lesson_id", analyse.data.id)
    .order("position");

  const { count } = await client
    .from("lesson_publications")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", analyse.data.id);

  const maintenant = new Date().toISOString();

  const { data: version, error: erreurVersion } = await client
    .from("content_versions")
    .insert({
      organization_id: contexte.organization_id,
      body: { blocs: blocs ?? [] },
      version_number: (count ?? 0) + 1,
      sealed_at: maintenant,
      created_by: personne.profileId,
    })
    .select("id")
    .single();

  if (erreurVersion !== null || version === null) return REFUS;

  const versionId = (version as { id: string }).id;

  const { error } = await client
    .from("lessons")
    .update({ state: "publiee", published_at: maintenant, content_version_id: versionId })
    .eq("id", analyse.data.id);

  if (error !== null) return REFUS;

  // Trace de la publication. Elle ne conditionne pas le succès : la séance est
  // publiée, et perdre la trace ne doit pas faire croire le contraire au
  // professeur. L'échec part au journal technique.
  const { error: erreurTrace } = await client.from("lesson_publications").insert({
    organization_id: contexte.organization_id,
    lesson_id: analyse.data.id,
    content_version_id: versionId,
    teaching_space_id: contexte.teaching_space_id,
    published_by: personne.profileId,
    published_at: maintenant,
  });

  if (erreurTrace !== null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "studio.publication", code: erreurTrace.code }),
    );
  }

  revalidatePath(`/studio/${analyse.data.id}`);
  revalidatePath("/eleve");
  revalidatePath("/eleve/cours");

  return { etat: "ok", message: "Séance publiée : la classe y a accès." };
}

/* ========================================================================== */
/* Blocs                                                                       */
/* ========================================================================== */

export async function ajouterBloc(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const personne = await sessionCourante();
  const jeton = await jetonDuProfesseur();
  if (jeton === null || personne === null) return REFUS;

  const type = String(donnees.get("type") ?? "");
  const seanceId = String(donnees.get("seance") ?? "");

  if (!z.string().uuid().safeParse(seanceId).success) return REFUS;

  const client = clientUtilisateur(jeton);

  // On relit la séance sous RLS : elle donne l'établissement, et son absence
  // signifie que la personne n'y a pas droit.
  const { data: laSeance } = await client
    .from("lessons")
    .select("id, organization_id, teaching_space_id")
    .eq("id", seanceId)
    .maybeSingle();

  if (laSeance === null) return REFUS;
  const contexte = laSeance as unknown as {
    organization_id: string;
    teaching_space_id: string;
  };

  const { data: dernier } = await client
    .from("lesson_blocks")
    .select("position")
    .eq("lesson_id", seanceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = ((dernier as { position: number } | null)?.position ?? -1) + 1;

  const commun = {
    organization_id: contexte.organization_id,
    lesson_id: seanceId,
    position,
    created_by: personne.profileId,
  };

  if (type === "texte" || type === "exercice") {
    const texte = String(donnees.get("texte") ?? "").trim();
    if (texte === "") {
      return { etat: "erreur", message: "Écrivez quelque chose avant d'ajouter le bloc." };
    }
    if (texte.length > 5000) {
      return { etat: "erreur", message: "Ce bloc est trop long : 5 000 caractères au maximum." };
    }

    const { error } = await client.from("lesson_blocks").insert({
      ...commun,
      kind: type,
      contenu: type === "texte" ? { texte } : { consigne: texte },
    });

    if (error !== null) return REFUS;
  } else if (type === "lien") {
    const url = String(donnees.get("url") ?? "").trim();
    const titre = String(donnees.get("titre") ?? "").trim();

    if (!/^https?:\/\/.+/.test(url)) {
      return { etat: "erreur", message: "L'adresse doit commencer par http:// ou https://" };
    }

    const { error } = await client.from("lesson_blocks").insert({
      ...commun,
      kind: "lien",
      contenu: { url, titre: titre === "" ? url : titre },
    });

    if (error !== null) return REFUS;
  } else if (type === "devoir") {
    const titre = String(donnees.get("titre") ?? "").trim();
    const consigne = String(donnees.get("consigne") ?? "").trim();
    const echeance = String(donnees.get("echeance") ?? "").trim();

    if (titre === "") return { etat: "erreur", message: "Donnez un titre au devoir." };

    // Le devoir est un objet à part entière : il apparaît chez l'élève dans
    // « À faire », pas seulement au milieu de la séance. Le bloc ne fait que
    // le rattacher au cours où il a été donné.
    const { data: devoir, error: erreurDevoir } = await client
      .from("assignments")
      .insert({
        organization_id: contexte.organization_id,
        teaching_space_id: contexte.teaching_space_id,
        lesson_id: seanceId,
        title: titre,
        instructions: { blocs: consigne === "" ? [] : [{ type: "texte", texte: consigne }] },
        due_at: echeance === "" ? null : new Date(`${echeance}T23:59:00`).toISOString(),
        state: "publiee",
        published_at: new Date().toISOString(),
        created_by: personne.profileId,
      })
      .select("id")
      .single();

    if (erreurDevoir !== null || devoir === null) return REFUS;

    const { error } = await client.from("lesson_blocks").insert({
      ...commun,
      kind: "devoir",
      assignment_id: devoir.id,
      contenu: { titre, consigne },
    });

    if (error !== null) {
      // Le bloc n'a pas pu être posé : on retire le devoir pour ne pas
      // laisser un devoir orphelin visible chez les élèves.
      await client.from("assignments").delete().eq("id", devoir.id);
      return REFUS;
    }

    const destinataires = await inscrireDestinataires(client, {
      organisation: contexte.organization_id,
      cours: contexte.teaching_space_id,
      devoir: devoir.id,
    });

    // Un devoir sans destinataire n'apparaît chez personne : la politique
    // `assignments_student_read` exige une ligne « concerné ». Mieux vaut le
    // dire que laisser le professeur croire son devoir donné.
    if (destinataires === 0) {
      return {
        etat: "ok",
        message:
          "Devoir ajouté, mais aucun élève n'est inscrit dans cette classe : " +
          "personne ne le verra tant que l'inscription n'est pas faite.",
      };
    }
  } else if (type === "document") {
    const fichier = donnees.get("fichier");

    if (!(fichier instanceof File) || fichier.size === 0) {
      return { etat: "erreur", message: "Choisissez un fichier à joindre." };
    }

    const depot = await deposerSupport({
      jeton,
      organisation: contexte.organization_id,
      seance: seanceId,
      proprietaire: personne.profileId,
      fichier,
    });

    if (depot.etat === "refus") {
      return { etat: "erreur", message: depot.message };
    }

    const { error } = await client.from("lesson_blocks").insert({
      ...commun,
      kind: "document",
      file_id: depot.support.fileId,
      contenu: {
        nom: depot.support.nom,
        taille: depot.support.taille,
        format: depot.support.type.libelle,
      },
    });

    if (error !== null) {
      // Le bloc n'a pas pu être posé : le fichier déposé n'a plus rien à faire
      // là. On le marque supprimé plutôt que de laisser une ligne orpheline
      // référencer un objet que plus aucun écran n'atteint.
      await client
        .from("files")
        .update({ state: "supprime", deleted_at: new Date().toISOString() })
        .eq("id", depot.support.fileId);
      return REFUS;
    }
  } else {
    return REFUS;
  }

  revalidatePath(`/studio/${seanceId}`);
  return { etat: "ok", message: "Bloc ajouté." };
}

export async function modifierBloc(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const id = String(donnees.get("id") ?? "");
  const seanceId = String(donnees.get("seance") ?? "");
  const texte = String(donnees.get("texte") ?? "").trim();

  if (!z.string().uuid().safeParse(id).success) return REFUS;
  if (texte === "") return { etat: "erreur", message: "Le bloc ne peut pas être vide." };
  if (texte.length > 5000) {
    return { etat: "erreur", message: "Ce bloc est trop long : 5 000 caractères au maximum." };
  }

  const client = clientUtilisateur(jeton);

  const { data: bloc } = await client
    .from("lesson_blocks")
    .select("kind, contenu")
    .eq("id", id)
    .maybeSingle();

  if (bloc === null) return REFUS;
  const actuel = bloc as unknown as { kind: string; contenu: Record<string, unknown> };

  const contenu =
    actuel.kind === "texte"
      ? { ...actuel.contenu, texte }
      : { ...actuel.contenu, consigne: texte };

  const { error } = await client.from("lesson_blocks").update({ contenu }).eq("id", id);
  if (error !== null) return REFUS;

  revalidatePath(`/studio/${seanceId}`);
  return { etat: "ok", message: "Bloc modifié." };
}

export async function supprimerBloc(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const id = String(donnees.get("id") ?? "");
  const seanceId = String(donnees.get("seance") ?? "");
  if (!z.string().uuid().safeParse(id).success) return REFUS;

  const client = clientUtilisateur(jeton);

  // Un bloc emporte ce qu'il rattachait. Un devoir laissé derrière vivrait dans
  // « À faire » sans être nulle part dans le cours ; un document laissé derrière
  // resterait téléchargeable par toute la classe alors qu'il a disparu de
  // l'écran. Dans les deux cas, ce que la personne voit cesserait d'être vrai.
  const { data: bloc } = await client
    .from("lesson_blocks")
    .select("assignment_id, file_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await client.from("lesson_blocks").delete().eq("id", id);
  if (error !== null) return REFUS;

  const rattache = bloc as { assignment_id: string | null; file_id: string | null } | null;

  if (rattache?.assignment_id != null) {
    await client.from("assignments").delete().eq("id", rattache.assignment_id);
  }

  if (rattache?.file_id != null) {
    // Le fichier est retiré, pas effacé : la trace du dépôt demeure. Les octets
    // restent dans le stockage jusqu'à la purge, mais plus rien ne les sert.
    await client
      .from("files")
      .update({ state: "supprime", deleted_at: new Date().toISOString() })
      .eq("id", rattache.file_id);
  }

  revalidatePath(`/studio/${seanceId}`);
  revalidatePath("/eleve");
  return { etat: "ok", message: "Bloc supprimé." };
}

export async function deplacerBloc(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const jeton = await jetonDuProfesseur();
  if (jeton === null) return REFUS;

  const seanceId = String(donnees.get("seance") ?? "");
  const id = String(donnees.get("id") ?? "");
  const sens = String(donnees.get("sens") ?? "");

  if (!z.string().uuid().safeParse(seanceId).success) return REFUS;
  if (sens !== "haut" && sens !== "bas") return REFUS;

  const client = clientUtilisateur(jeton);

  const { data } = await client
    .from("lesson_blocks")
    .select("id")
    .eq("lesson_id", seanceId)
    .order("position")
    .limit(200);

  const ordre = ((data ?? []) as { id: string }[]).map((bloc) => bloc.id);
  const index = ordre.indexOf(id);
  if (index === -1) return REFUS;

  const cible = sens === "haut" ? index - 1 : index + 1;
  if (cible < 0 || cible >= ordre.length) return { etat: "ok" };

  [ordre[index], ordre[cible]] = [ordre[cible]!, ordre[index]!];

  // L'ordre complet part en une seule transaction : un déplacement ne doit
  // pas pouvoir laisser la séance à moitié réordonnée.
  const { error } = await client.rpc("studio_reordonner_blocs", {
    p_lesson: seanceId,
    p_blocs: ordre,
  });

  if (error !== null) return REFUS;

  revalidatePath(`/studio/${seanceId}`);
  return { etat: "ok" };
}

/* -------------------------------------------------------------------------- */

/** Établissement d'un cours, relu sous RLS. */
/**
 * Inscrit les élèves du cours comme destinataires d'un devoir.
 *
 * Sans ces lignes, le devoir n'existe pour aucun élève : la politique
 * `assignments_student_read` ne montre un devoir qu'à qui en est destinataire
 * « concerné ». C'est volontaire — un devoir se donne à des personnes, pas à
 * une salle — mais cela veut dire que la liste doit être écrite au moment où
 * le devoir est créé.
 *
 * La liste vient des inscriptions de la classe, lues sous RLS : un professeur
 * ne peut y faire entrer que les élèves qu'il a déjà le droit de voir.
 *
 * Renvoie le nombre de destinataires inscrits.
 */
async function inscrireDestinataires(
  client: ReturnType<typeof clientUtilisateur>,
  options: { organisation: string; cours: string; devoir: string },
): Promise<number> {
  const { data: espace } = await client
    .from("teaching_spaces")
    .select("class_id, group_id")
    .eq("id", options.cours)
    .maybeSingle();

  const cible = espace as { class_id: string | null; group_id: string | null } | null;
  if (cible === null) return 0;

  const eleves =
    cible.class_id !== null
      ? await client.from("class_enrollments").select("profile_id").eq("class_id", cible.class_id).is("ends_on", null)
      : await client.from("group_memberships").select("profile_id").eq("group_id", cible.group_id!);

  const profils = ((eleves.data ?? []) as { profile_id: string }[]).map((l) => l.profile_id);
  if (profils.length === 0) return 0;

  const { error } = await client.from("assignment_recipients").insert(
    profils.map((profil) => ({
      organization_id: options.organisation,
      assignment_id: options.devoir,
      profile_id: profil,
      status: "concerne",
    })),
  );

  if (error !== null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "studio.destinataires", code: error.code }),
    );
    return 0;
  }

  return profils.length;
}

async function organisationDuCours(jeton: string, cours: string): Promise<string | null> {
  const { data } = await clientUtilisateur(jeton)
    .from("teaching_spaces")
    .select("organization_id")
    .eq("id", cours)
    .maybeSingle();

  return (data as { organization_id: string } | null)?.organization_id ?? null;
}

/* ========================================================================== */
/* Dupliquer vers une autre classe — cahier V5, §4.5                          */
/* ========================================================================== */

/**
 * Recopie une séance dans une autre classe du professeur.
 *
 * Seule action du Studio qui n'agit pas avec le jeton : elle doit écrire dans
 * deux cours à la fois. La contrepartie est en base — `studio_dupliquer_seance`
 * revérifie les deux affectations à partir des lignes réelles, et l'identité
 * vient de la session, jamais du formulaire.
 *
 * La copie naît en brouillon, sans devoir. Ce qui appartient aux élèves — les
 * cases « fait », les questions, les remises — reste dans le cours d'origine.
 */
export async function dupliquerVersUneClasse(
  _precedent: EtatStudio,
  donnees: FormData,
): Promise<EtatStudio> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return REFUS;
  if (!personne.roles.includes("professeur")) return REFUS;

  const analyse = z
    .object({
      seance: z.string().uuid(),
      cours: z.string().uuid(),
      titre: z.string().trim().max(160).optional(),
    })
    .safeParse({
      seance: donnees.get("seance"),
      cours: donnees.get("cours"),
      titre: donnees.get("titre") ?? undefined,
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Choisissez la classe de destination." };
  }

  const resultat = await dupliquerSeance({
    acteur: personne.profileId,
    seance: analyse.data.seance,
    coursCible: analyse.data.cours,
    titre: analyse.data.titre ?? null,
  });

  if ("erreur" in resultat) {
    return { etat: "erreur", message: resultat.erreur };
  }

  revalidatePath("/studio");

  const devoirs =
    resultat.devoirsIgnores === 0
      ? ""
      : ` ${resultat.devoirsIgnores} bloc${resultat.devoirsIgnores > 1 ? "s" : ""} de devoir non ` +
        `recopié${resultat.devoirsIgnores > 1 ? "s" : ""} : un devoir a ses propres dates.`;

  return {
    etat: "ok",
    message:
      `Copie créée en brouillon, ${resultat.blocsCopies} bloc` +
      `${resultat.blocsCopies > 1 ? "s" : ""} repris.${devoirs}`,
    cree: resultat.seance,
  };
}

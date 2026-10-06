import { NextResponse } from "next/server";
import { deposerPieceJointe, retirerPieceJointe } from "@/lib/documents";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * POST /api/v6/messages/:message/pieces — joindre un fichier à son message (E09, §9.2).
 *
 * Le message est déjà persisté : la pièce s'y rattache ensuite, ce qui garde
 * l'envoi du texte idempotent et indépendant du réseau. Trois étapes :
 * dépôt vérifié (signature de format, taille, empreinte — la même voie que
 * les copies), rattachement par `salon_joindre` sous le jeton de l'auteur,
 * et retrait du fichier si le rattachement est refusé. Le fichier n'est
 * lisible par la classe qu'à travers le message : un message supprimé ou
 * masqué retire la pièce (politique `files_piece_salon`).
 *
 * Route plutôt qu'action serveur : une action est bornée à 1 Mo de corps.
 */
export const dynamic = "force-dynamic";

const ENTETES = { "cache-control": "private, no-store" };
const TAILLE_MAX = 10 * 1024 * 1024;
const TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function refus(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: { code, message, requestId } }, { status, headers: ENTETES });
}

export async function POST(requete: Request, { params }: { params: Promise<{ message: string }> }) {
  const requestId = idRequete();
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return refus(401, "UNAUTHENTICATED", "Session terminée.", requestId);
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return refus(401, "UNAUTHENTICATED", "Session terminée.", requestId);

  const { message } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(message)) {
    return refus(403, "NOT_ACCESSIBLE", "Ce contenu n'est pas accessible.", requestId);
  }

  // Lu sous le jeton : un message hors de portée n'existe pas pour la personne.
  const client = clientUtilisateur(jeton);
  const { data: ligne } = await client
    .from("messages_salon")
    .select("organization_id, author_id, deleted_at")
    .eq("id", message)
    .maybeSingle();
  const m = ligne as { organization_id: string; author_id: string; deleted_at: string | null } | null;
  if (m === null || m.author_id !== personne.profileId || m.deleted_at !== null) {
    return refus(403, "NOT_ACCESSIBLE", "Ce contenu n'est pas accessible.", requestId);
  }

  let donnees: FormData;
  try {
    donnees = await requete.formData();
  } catch {
    return refus(400, "VALIDATION_FAILED", "Le fichier n'a pas été reçu. Réessayez.", requestId);
  }
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return refus(400, "VALIDATION_FAILED", "Choisissez un fichier.", requestId);
  }
  if (fichier.size > TAILLE_MAX) {
    return refus(400, "VALIDATION_FAILED", "Ce fichier dépasse 10 Mo.", requestId);
  }

  const depot = await deposerPieceJointe({
    jeton,
    organisation: m.organization_id,
    proprietaire: personne.profileId,
    genre: "message",
    rattachement: message,
    fichier,
  });
  if (depot.etat !== "ok") return refus(400, "VALIDATION_FAILED", depot.message, requestId);

  if (!TYPES.has(depot.support.type.mime)) {
    await retirerPieceJointe(jeton, depot.support.fileId);
    return refus(400, "VALIDATION_FAILED", "Dans un salon, seuls les PDF et les images (PNG, JPEG, WebP) sont acceptés.", requestId);
  }

  const { error } = await client.rpc("salon_joindre", { p_message: message, p_fichier: depot.support.fileId });
  if (error !== null) {
    await retirerPieceJointe(jeton, depot.support.fileId);
    const e = traduire(error, requestId);
    return refus(e.code === "NOT_ACCESSIBLE" ? 403 : 400, e.code, e.message, requestId);
  }

  return NextResponse.json(
    { id: depot.support.fileId, nom: depot.support.nom, taille: depot.support.taille },
    { status: 201, headers: ENTETES },
  );
}

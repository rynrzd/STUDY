type ErreurAuth = { code?: string; status?: number };
type ReponseAuth = { error: ErreurAuth | null; data?: { session?: unknown; user?: unknown } | null };

type Operation = "inscription" | "confirmation" | "recuperation";

/** Le fournisseur peut masquer une adresse déjà inscrite ou inconnue. Une
 * réponse acceptée ne constitue jamais une preuve de livraison. */
export async function demanderCourrielAuth(
  operation: Operation,
  demander: () => Promise<ReponseAuth>,
  fermerSession?: () => Promise<unknown>,
) {
  let reponse: ReponseAuth;
  try {
    reponse = await demander();
    if (operation === "inscription" && reponse.data?.session) {
      await fermerSession?.();
      console.warn(JSON.stringify({ contexte: operation, code: "confirmation_auth_requise" }));
      return "indisponible";
    }
  } catch {
    console.warn(JSON.stringify({ contexte: operation, code: "transport_indisponible" }));
    return operation === "inscription" ? "indisponible" : "neutre";
  }
  if (reponse.error) {
    const { code, status } = reponse.error;
    console.warn(JSON.stringify({ contexte: operation, code, statut: status }));
    if (operation !== "inscription" || code === "user_already_exists" || code === "email_exists") return "neutre";
    if (status === 429) return "limite";
    return "indisponible";
  }
  if (operation === "inscription" && !reponse.data?.user) return "indisponible";
  return "neutre";
}

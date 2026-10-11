import type { ElementSujet } from "@/lib/evaluations/sujet";

const lettre = (i: number) => String.fromCharCode(65 + i);

/** Une réponse d'élève, telle qu'il l'a donnée sur son sujet (ses choix, dans son ordre). */
export function texteReponse(item: Pick<ElementSujet, "kind" | "choix">, reponse: Readonly<Record<string, unknown>> | null | undefined): string {
  if (!reponse) return "Pas de réponse";
  switch (item.kind) {
    case "qcm":
      return typeof reponse.index === "number" ? `${lettre(reponse.index)}. ${item.choix?.[reponse.index] ?? ""}` : "Pas de réponse";
    case "qcm_multiple": {
      const indices = Array.isArray(reponse.indices) ? (reponse.indices as number[]) : [];
      return indices.length ? indices.map((i) => `${lettre(i)}. ${item.choix?.[i] ?? ""}`).join(" ; ") : "Pas de réponse";
    }
    case "vrai_faux":
      return typeof reponse.vrai === "boolean" ? (reponse.vrai ? "Vrai" : "Faux") : "Pas de réponse";
    case "numerique":
      return typeof reponse.valeur === "string" && reponse.valeur.trim() ? reponse.valeur : "Pas de réponse";
    default:
      return typeof reponse.texte === "string" && reponse.texte.trim() ? reponse.texte : "Pas de réponse";
  }
}

/** L'attendu d'une copie, dans les mots de son sujet. */
export function texteAttendu(item: Pick<ElementSujet, "kind" | "choix">, attendu: Readonly<Record<string, unknown>> | null | undefined): string {
  if (!attendu) return "";
  switch (item.kind) {
    case "qcm":
      return typeof attendu.index === "number" ? `${lettre(attendu.index)}. ${item.choix?.[attendu.index] ?? ""}` : "";
    case "qcm_multiple":
      return Array.isArray(attendu.indices) ? (attendu.indices as number[]).map((i) => `${lettre(i)}. ${item.choix?.[i] ?? ""}`).join(" ; ") : "";
    case "vrai_faux":
      return attendu.vrai ? "Vrai" : "Faux";
    case "numerique":
      return `${String(attendu.valeur).replace(".", ",")}${Number(attendu.tolerance) > 0 ? ` (± ${String(attendu.tolerance).replace(".", ",")})` : ""}`;
    case "courte":
      return Array.isArray(attendu.acceptees) ? (attendu.acceptees as string[]).join(" ou ") : "";
    default:
      return "";
  }
}

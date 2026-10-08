import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vérifie l'en-tête `Authorization: Bearer <CRON_SECRET>` des appels de
 * service (file de travaux, sonde d'état détaillée).
 *
 * La comparaison se fait à temps constant sur des empreintes de même
 * longueur : une comparaison naïve fuit la longueur du préfixe correct, et
 * `timingSafeEqual` refuse deux tampons de tailles différentes, ce qui fuirait
 * déjà la longueur du secret.
 */
export function secretTacheValide(entete: string | null): boolean {
  const attendu = (process.env.CRON_SECRET ?? "").trim();
  if (attendu === "") return false;

  const fourni = (entete ?? "").replace(/^Bearer\s+/i, "").trim();
  if (fourni === "") return false;

  const a = createHash("sha256").update(attendu, "utf8").digest();
  const b = createHash("sha256").update(fourni, "utf8").digest();
  return timingSafeEqual(a, b);
}

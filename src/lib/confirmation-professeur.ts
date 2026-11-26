import { z } from "zod";

/** Code de confirmation Supabase Auth : exactement six chiffres ASCII. */
export const schemaConfirmationProfesseur = z.object({
  email: z.string().trim().toLowerCase().email().max(180),
  code: z.string().trim().regex(/^[0-9]{6}$/u),
});

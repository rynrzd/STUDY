export interface EtatInscriptionProfesseur {
  readonly etat: "vierge" | "refus" | "envoyee" | "confirmee";
  readonly message?: string;
  readonly valeurs?: { prenom: string; nom: string; email: string; etablissement?: string };
  readonly champs?: Partial<Record<"prenom" | "nom" | "email" | "motDePasse" | "confirmation" | "projet", string>>;
}

export const ETAT_INSCRIPTION_PROFESSEUR: EtatInscriptionProfesseur = { etat: "vierge" };

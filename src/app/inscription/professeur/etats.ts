export interface EtatInscriptionProfesseur {
  readonly etat: "vierge" | "refus" | "envoyee";
  readonly message?: string;
  readonly valeurs?: { prenom: string; nom: string; email: string };
  readonly champs?: Partial<Record<"prenom" | "nom" | "email" | "motDePasse" | "confirmation", string>>;
}

export const ETAT_INSCRIPTION_PROFESSEUR: EtatInscriptionProfesseur = { etat: "vierge" };

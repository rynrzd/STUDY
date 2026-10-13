export interface ProfesseurConnu {
  profile_id: string;
  local_login: string;
  prenom: string;
  nom: string;
  email: string | null;
}

function normaliser(v: string): string {
  return v.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

/** Ne fusionne jamais deux homonymes en choisissant arbitrairement le premier. */
export function identifierProfesseur(
  entrant: { prenom: string; nom: string; email: string | null },
  connus: readonly ProfesseurConnu[],
): { profil: ProfesseurConnu | null; erreur: string | null } {
  const email = entrant.email?.trim().toLowerCase() || null;
  if (email !== null) {
    const parEmail = connus.filter((p) => p.email?.trim().toLowerCase() === email);
    if (parEmail.length === 1) return { profil: parEmail[0]!, erreur: null };
    if (parEmail.length > 1) return { profil: null, erreur: "Plusieurs comptes portent cet e-mail. Vérifiez les comptes avant l’import." };
  }
  const parNom = connus.filter((p) => normaliser(p.prenom) === normaliser(entrant.prenom) && normaliser(p.nom) === normaliser(entrant.nom));
  if (parNom.length === 0) return { profil: null, erreur: null };
  if (parNom.length === 1 && (email === null || !parNom[0]!.email?.trim())) return { profil: parNom[0]!, erreur: null };
  return { profil: null, erreur: "Identité ambiguë : homonyme ou e-mail différent. Vérifiez le compte et son e-mail avant de réimporter." };
}

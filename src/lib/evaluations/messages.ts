/** Les refus de la base, en phrases. Un code inconnu donne un message générique. */
const MESSAGES: Readonly<Record<string, string>> = {
  SUJET_FIGE: "Le sujet est distribué : il ne se modifie plus. Les points se corrigent copie par copie.",
  SUJET_VIDE: "Ajoutez au moins une question avant de distribuer.",
  RESULTATS_PUBLIES: "Les résultats sont publiés : cette évaluation est close.",
  NON_DISTRIBUEE: "Distribuez d'abord l'évaluation.",
  ELEVE_HORS_ENSEIGNEMENT: "Un élève ne fait plus partie de cette classe.",
  COPIES_INVALIDES: "Le tirage des sujets n'a pas pu être enregistré. Réessayez.",
  POINTS_HORS_BAREME: "Les points dépassent le barème de la question.",
  COMMENTAIRE_TROP_LONG: "Le commentaire est trop long (2 000 caractères au plus).",
  RESERVE_AU_PAPIER: "La saisie des réponses est réservée aux évaluations sur papier.",
  EVALUATION_SUR_PAPIER: "Cette évaluation se fait sur papier, en classe.",
  HORS_FENETRE: "Cette évaluation n'est pas ouverte en ce moment.",
  TEMPS_ECOULE: "Le temps est écoulé : ta copie n'accepte plus de réponse.",
  COPIE_RENDUE: "Ta copie est déjà rendue.",
  REPONSE_INVALIDE: "Cette réponse n'a pas pu être lue.",
  NON_ACCESSIBLE: "Cette évaluation n'est pas accessible.",
};

export function messageEvaluation(erreur: { message?: string | null } | null | undefined): string {
  const code = /\b([A-Z][A-Z_]{4,})\b/.exec(erreur?.message ?? "")?.[1];
  return (code && MESSAGES[code]) || "L'opération n'a pas abouti. Réessayez dans un instant.";
}

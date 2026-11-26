export interface QuestionReprise {
  versionId: string;
  tentativeId: string | null;
  reponse: Record<string, unknown> | null;
}

/** Le curseur persistant conserve la correction jusqu'au geste « suivant ». */
export function reprendreRevision(questions: readonly QuestionReprise[], position?: number) {
  const premiere = questions.findIndex(q => q.tentativeId === null);
  const index = position ?? (premiere === -1 ? questions.length : premiere);
  if (!Number.isInteger(index) || index < 0 || index > questions.length) {
    throw new Error("POSITION_REVISION_INVALIDE");
  }
  const reponses = Object.fromEntries(questions.map(q => [
    q.versionId,
    String(q.reponse?.index ?? q.reponse?.valeur ?? q.reponse?.texte ?? ""),
  ]));
  return { index, reponses, terminee: index === questions.length };
}

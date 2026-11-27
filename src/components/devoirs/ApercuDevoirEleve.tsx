import { BookOpen, CalendarDays, FileCheck2 } from "lucide-react";

/** Même fiche de lecture dans l'aperçu du professeur et sur la page de l'élève. */
export function ApercuDevoirEleve({
  classe,
  titre,
  consigne,
  echeance,
  mode,
  etat,
  codeEtat = "non_commence",
  echeancePassee = false,
  simulation = false,
  publie = false,
}: {
  classe: string;
  titre: string;
  consigne: string;
  echeance: string;
  mode: string;
  etat: string;
  codeEtat?: string;
  echeancePassee?: boolean;
  simulation?: boolean;
  publie?: boolean;
}) {
  const remise = mode === "numerique" || mode === "mixte"
    ? "Un fichier à déposer ici"
    : mode === "papier" ? "À rendre sur papier" : "Rien à rendre";

  return (
    <div className="min-w-0">
      {simulation ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-rose-clair)] px-3 py-1 text-xs font-bold text-[color:var(--color-accent)]">
          <BookOpen aria-hidden="true" size={14} /> Aperçu côté élève · {publie ? "publié" : "non publié"}
        </p>
      ) : null}
      <p className="m-0 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">{classe}</p>
      {simulation ? (
        <h3 className="m-0 mt-1 break-words text-xl font-bold">{titre || "Titre à compléter"}</h3>
      ) : (
        <h1 data-testid="devoir-titre" className="m-0 mt-1 break-words text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">{titre}</h1>
      )}

      <dl className="m-0 mt-5 grid gap-x-8 gap-y-3 text-[length:var(--text-tableau)] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="inline-flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" size={16} /> À rendre</dt>
        <dd className="m-0" data-testid="devoir-echeance">
          {echeance}
          {echeancePassee ? <span className="ml-2 text-[color:var(--color-erreur)]">échéance passée</span> : null}
        </dd>
        <dt className="inline-flex items-center gap-2 font-semibold"><FileCheck2 aria-hidden="true" size={16} /> Remise</dt>
        <dd className="m-0" data-testid="devoir-mode">{remise}</dd>
        <dt className="font-semibold">Mon état</dt>
        <dd className="m-0" data-testid="devoir-etat-remise" data-etat={codeEtat}>{etat}</dd>
      </dl>

      {consigne.trim() !== "" ? (
        <section className="mt-7 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4 sm:p-5">
          <h2 className={`m-0 ${simulation ? "text-base" : "text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"}`}>Consigne</h2>
          <p className="m-0 mt-3 whitespace-pre-wrap break-words">{consigne}</p>
        </section>
      ) : null}
    </div>
  );
}

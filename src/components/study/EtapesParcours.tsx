/** Repères de progression communs au Studio et à la création des devoirs. */
export function EtapesParcours({
  etapes,
  active,
  titre,
}: {
  etapes: readonly string[];
  active: number;
  titre: string;
}) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label={titre}>
      {etapes.map((libelle, index) => {
        const faite = index < active;
        const courante = index === active;
        return (
          <li
            key={`${index}-${libelle}`}
            aria-current={courante ? "step" : undefined}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs transition-colors sm:flex-row sm:justify-center sm:text-sm ${
              courante
                ? "parcours-etape-active border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-bold text-[color:var(--color-accent)]"
                : faite
                  ? "border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] font-semibold"
                  : "border-[color:var(--color-bordure)] text-[color:var(--color-encre-faible)]"
            }`}
          >
            <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              courante ? "bg-[color:var(--color-accent)] text-white" : faite ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]" : "bg-[color:var(--color-survol)]"
            }`}>
              {faite ? "✓" : index + 1}
            </span>
            <span className="min-w-0 break-words">{libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}

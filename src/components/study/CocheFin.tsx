/**
 * Fin de séance : une coche qui se trace une fois, en moins d'une seconde
 * (brief §3, « Quiz »). Décorative : le résumé textuel reste la référence.
 * Effets réduits ou désactivés : elle apparaît tracée, sans mouvement.
 */
export function CocheFin() {
  return (
    <svg className="coche-fin mx-auto block" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      <circle cx="28" cy="28" r="24" fill="var(--color-rose-clair)" stroke="var(--color-rose-moyen)" strokeWidth="2.5" />
      <path d="M18 29l7 7 13-15" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

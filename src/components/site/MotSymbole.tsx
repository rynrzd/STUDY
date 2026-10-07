import { LOGO_LETTRES, LOGO_POINT, LOGO_VIEWBOX_SERRE } from "./logo-svg";

/**
 * Le mot-symbole « study. » — tracés officiels (Manrope 800, approche
 * -0,06 em), le même que dans l'application, la connexion et l'introduction.
 * La marque légale (AvecStudy) reste dans le pied de page et les mentions :
 * seul le logo de navigation est harmonisé.
 */
export function MotSymbole({ className, titre = "study." }: { className?: string; titre?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX_SERRE} className={className} role="img" aria-label={titre} focusable="false">
      <g transform="scale(1,-1)">
        <path fill="currentColor" d={LOGO_LETTRES} />
        <path fill="#c37a94" d={LOGO_POINT} />
      </g>
    </svg>
  );
}

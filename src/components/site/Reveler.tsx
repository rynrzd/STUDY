/**
 * Ancien conteneur d'apparition au défilement.
 *
 * R2 (cahier §09) : aucun texte n'est initialement invisible et aucune section
 * n'apparaît au défilement. Le composant est conservé comme simple enveloppe
 * pour les pages qui l'emploient encore ; il ne masque rien et n'exige aucun
 * script.
 */
export function Reveler({
  children,
  className,
  as: Balise = "div",
}: {
  children: React.ReactNode;
  delai?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const Element = Balise as "div";
  return <Element className={className}>{children}</Element>;
}

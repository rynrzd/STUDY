/**
 * Transition de page de l'application (brief §6, « PageTransition »).
 *
 * Un gabarit est remonté à chaque changement de destination : son contenu
 * entre par un fondu de 200 ms et 4 px, en CSS. Rien n'est retardé — la page
 * est déjà rendue quand l'animation commence — et la position de lecture
 * d'une page qui ne change pas (paramètres de recherche, fil ouvert) n'est
 * pas touchée, car le gabarit n'est alors pas remonté.
 */
export default function GabaritTransition({ children }: { children: React.ReactNode }) {
  return <div className="entree-page">{children}</div>;
}

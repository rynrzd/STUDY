/** Le Studio garde ses outils visibles pendant l'entrée du nouveau contenu. */
export default function TransitionStudio({ children }: { children: React.ReactNode }) {
  return <div className="entree-page">{children}</div>;
}

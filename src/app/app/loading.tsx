import { SqueletteLignes } from "@/components/study/ui";

/** Premier chargement : un squelette de même géométrie, la navigation reste utilisable. */
export default function Chargement() {
  return (
    <div className="grid gap-6">
      <span className="squelette-ligne h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <SqueletteLignes lignes={4} />
        <SqueletteLignes lignes={3} />
      </div>
    </div>
  );
}

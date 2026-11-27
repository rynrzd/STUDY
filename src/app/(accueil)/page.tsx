import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import { AccueilImmersif } from "./AccueilImmersif";

export const metadata: Metadata = pagePublique({
  chemin: "/",
  titre: "Tu veux travailler quoi aujourd’hui ?",
  description: "Essaie un exercice en maths, en anglais ou en histoire. Retrouve ensuite les cours et les devoirs de ta classe sur AvecStudy.",
});

export default function Accueil() {
  return <AccueilImmersif />;
}

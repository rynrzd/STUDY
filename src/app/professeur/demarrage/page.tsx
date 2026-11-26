import type { Metadata } from "next";
import Link from "next/link";
import { GuideDemarrage } from "../GuideDemarrage";

export const metadata: Metadata = { title: "Bien démarrer" };

export default function PageDemarrage() {
  return (
    <>
      <GuideDemarrage />
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/professeur">← Retour à mon accueil</Link>
        <Link href="/rejoindre">Je rejoins plutôt une classe existante</Link>
      </div>
    </>
  );
}

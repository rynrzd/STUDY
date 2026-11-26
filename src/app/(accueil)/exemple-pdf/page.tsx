import Link from "next/link";
import { RenduDocument } from "@/components/studio/RenduDocument";
import { exempleStudio, pdfOriginalExemple, REGLAGES_EXEMPLE, textesExemple } from "@/lib/exemple-studio";
import { pagePublique } from "@/lib/metadonnees";
import s from "../accueil.module.css";

export const metadata = pagePublique({
  chemin: "/exemple-pdf",
  titre: "Avant / après · Exemple PDF",
  description: "Comparez un cours fictif de deux pages et sa mise en page par le Studio.",
});

export default async function PageExemplePdf() {
  const original = await pdfOriginalExemple();
  const [cours, textes] = await Promise.all([exempleStudio(original), textesExemple(original)]);
  return (
    <main id="contenu" className={s.page}>
      <div className={`${s.wrap} py-10`}>
        <Link href="/">← Accueil</Link>
        <h1 className="!mt-6">Un cours en deux versions.</h1>
        <p className="!mt-4">Comparez le texte du PDF original de deux pages et le même cours après extraction et mise en page dans le Studio.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={`${s.button} ${s.secondary}`} href="/exemple-pdf/fichier/original" download prefetch={false}>Télécharger le PDF original</Link>
          <Link className={s.button} href="/exemple-pdf/fichier/modernise" download prefetch={false}>Télécharger le PDF modernisé</Link>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:items-start">
          <section aria-labelledby="original" className={s.card}>
            <h2 id="original">Avant</h2>
            {textes.map((texte, index) => (
              <div key={index} className="mt-4 border-t border-neutral-200 pt-4">
                <h3>Page {index + 1}</h3>
                <p className="!mt-3 whitespace-pre-line font-serif">{texte}</p>
              </div>
            ))}
          </section>
          <section aria-labelledby="modernise" className={s.card}>
            <h2 id="modernise">Après</h2>
            <div className="mt-5"><RenduDocument document={cours} reglages={REGLAGES_EXEMPLE} /></div>
          </section>
        </div>
        <Link className={`${s.button} mt-8`} href="/inscription/professeur">Créer un compte prof</Link>
      </div>
    </main>
  );
}

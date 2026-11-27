"use client";

import { useEffect, useRef, useState } from "react";
import { densiteDeRendu } from "@/lib/rendu-pdf";

/**
 * Prévisualisation locale de la première page avant remise.
 * Les octets restent sur l'appareil : aucune requête et aucune iframe PDF.
 * Le serveur contrôle toujours le fichier complet lors de l'envoi.
 */
export function ApercuPdfLocal({ fichier }: { fichier: File }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [etat, setEtat] = useState<"lecture" | "pret" | "erreur">("lecture");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let annule = false;
    let tache: { cancel: () => void; promise: Promise<void> } | null = null;
    let documentPdf: Awaited<ReturnType<typeof import("unpdf")["getDocumentProxy"]>> | null = null;

    (async () => {
      try {
        const octets = new Uint8Array(await fichier.arrayBuffer());
        if (annule) return;
        const { getDocumentProxy } = await import("unpdf");
        documentPdf = await getDocumentProxy(octets);
        if (annule) return;

        const page = await documentPdf.getPage(1);
        const canevas = toile.current;
        if (!canevas || annule) return;
        const dimensions = page.getViewport({ scale: 1 });
        const vue = page.getViewport({ scale: Math.min(1.5, 420 / dimensions.width) });
        const densite = densiteDeRendu(vue.width, vue.height, window.devicePixelRatio);
        canevas.width = Math.floor(vue.width * densite);
        canevas.height = Math.floor(vue.height * densite);
        canevas.style.width = `${Math.floor(vue.width)}px`;
        canevas.style.height = `${Math.floor(vue.height)}px`;
        const contexte = canevas.getContext("2d");
        if (!contexte) throw new Error("Canevas indisponible");
        tache = page.render({
          canvas: canevas,
          canvasContext: contexte,
          viewport: vue,
          transform: densite === 1 ? undefined : [densite, 0, 0, densite, 0, 0],
        }) as unknown as { cancel: () => void; promise: Promise<void> };
        await tache.promise;
        if (!annule) {
          setPages(documentPdf.numPages);
          setEtat("pret");
        }
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();

    return () => {
      annule = true;
      tache?.cancel();
      if (documentPdf) void documentPdf.cleanup();
    };
  }, [fichier]);

  return (
    <figure className="m-0 mt-4 rounded-xl border border-[color:var(--color-bordure)] bg-white p-3">
      <figcaption className="mb-3 text-left text-sm font-semibold text-[color:var(--color-encre)]">
        Aperçu de la première page {etat === "pret" ? `· ${pages} page${pages > 1 ? "s" : ""} dans le fichier` : ""}
      </figcaption>
      {etat === "lecture" ? <p role="status" className="text-sm text-[color:var(--color-encre-faible)]">Préparation de l&apos;aperçu…</p> : null}
      <canvas
        ref={toile}
        role="img"
        aria-label="Première page du PDF sélectionné"
        className={`mx-auto h-auto max-w-full rounded-md shadow-sm ${etat === "pret" ? "block" : "hidden"}`}
      />
      {etat === "erreur" ? (
        <p role="status" className="m-0 text-sm text-[color:var(--color-encre-faible)]">
          L&apos;aperçu n&apos;est pas disponible pour ce PDF. Vérifie le nom du fichier avant de l&apos;envoyer.
        </p>
      ) : null}
      {etat === "pret" ? (
        <p className="m-0 mt-3 text-xs text-[color:var(--color-encre-faible)]">
          Seule la première page est affichée ici. Toutes les pages seront envoyées.
        </p>
      ) : null}
    </figure>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Download, FileText, LayoutGrid, Maximize, Minimize, Minus, Plus } from "lucide-react";
import { densiteDeRendu } from "@/lib/rendu-pdf";

type Document = Awaited<ReturnType<typeof import("unpdf")["getDocumentProxy"]>>;
type Etat = { genre: "attente" } | { genre: "pret"; total: number } | { genre: "erreur"; message: string; telechargeable: boolean };

/**
 * Lecteur de PDF intégré — cahier des charges ch. 12, mode A (PDF-03, PDF-08,
 * PDF-09, PDF-11).
 *
 * Le fichier est celui que le professeur a déposé, octet pour octet : il est
 * relu par la route `/documents/[fichier]`, qui revérifie l'accès à chaque
 * requête, puis dessiné page par page dans un canevas. Rien du PDF n'est
 * exécuté : pdf.js ne lance pas les scripts embarqués, la version embarquée
 * n'utilise aucune évaluation dynamique (la politique de sécurité l'interdit
 * de toute façon), et les liens du document ne sont pas rendus cliquables.
 *
 * Le chargement n'a lieu que lorsque le lecteur approche de l'écran : une
 * séance avec plusieurs PDF ne télécharge pas tout d'un coup sur un téléphone.
 * En cas d'échec, un message honnête et, si l'accès est permis, le
 * téléchargement — jamais une zone blanche.
 */
export function LecteurPdf({ fichier, nom, source }: { fichier: string; nom: string; source?: string }) {
  const adresse = source ?? `/documents/${fichier}`;
  const cadre = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const pdf = useRef<Document | null>(null);
  const [visible, setVisible] = useState(false);
  const [etat, setEtat] = useState<Etat>({ genre: "attente" });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [largeur, setLargeur] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  // PDF-11 : un document sans texte (numérisé) n'est pas lisible par un lecteur d'écran.
  const [sansTexte, setSansTexte] = useState(false);
  // PDF-14 : signets du document, quand il en a (leur absence est normale).
  const [signets, setSignets] = useState<{ titre: string; page: number }[]>([]);
  const [vignettes, setVignettes] = useState(false);
  const [docPret, setDocPret] = useState<Document | null>(null);

  // N'ouvrir le fichier qu'à l'approche de l'écran.
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  // Largeur disponible, pour ajuster la page à l'écran.
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const observateur = new ResizeObserver((entrees) => setLargeur(Math.floor(entrees[0]?.contentRect.width ?? 0)));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  useEffect(() => {
    const changement = () => setPleinEcran(document.fullscreenElement === cadre.current);
    document.addEventListener("fullscreenchange", changement);
    return () => document.removeEventListener("fullscreenchange", changement);
  }, []);

  // Chargement du fichier.
  useEffect(() => {
    if (!visible) return;
    let annule = false;
    (async () => {
      let reponse: Response;
      try {
        reponse = await fetch(adresse, { credentials: "same-origin", cache: "no-store" });
      } catch {
        if (!annule) setEtat({ genre: "erreur", message: "Le document n'a pas pu être chargé. Vérifiez votre connexion puis rechargez la page.", telechargeable: false });
        return;
      }
      if (!reponse.ok) {
        if (!annule) setEtat({ genre: "erreur", message: "Ce document n'est plus disponible, ou vous n'y avez plus accès.", telechargeable: false });
        return;
      }
      try {
        const octets = new Uint8Array(await reponse.arrayBuffer());
        const { getDocumentProxy } = await import("unpdf");
        const doc = await getDocumentProxy(octets);
        if (annule) {
          void doc.cleanup();
          return;
        }
        pdf.current = doc;
        setDocPret(doc);
        setEtat({ genre: "pret", total: doc.numPages });
        void (async () => {
          try {
            const contenu = await (await doc.getPage(1)).getTextContent();
            if (!annule) setSansTexte(contenu.items.length === 0);
          } catch {
            /* sans conséquence : l'avertissement n'est qu'une aide */
          }
          try {
            const plan = (await doc.getOutline()) ?? [];
            const lus: { titre: string; page: number }[] = [];
            for (const entree of plan.slice(0, 60)) {
              const dest = typeof entree.dest === "string" ? await doc.getDestination(entree.dest) : entree.dest;
              const ref = Array.isArray(dest) ? dest[0] : null;
              if (ref && typeof ref === "object") lus.push({ titre: String(entree.title).slice(0, 120), page: (await doc.getPageIndex(ref as never)) + 1 });
            }
            if (!annule) setSignets(lus);
          } catch {
            /* pas de signets : rien à afficher */
          }
        })();
      } catch (erreur) {
        if (annule) return;
        const nomErreur = (erreur as { name?: string } | null)?.name ?? "";
        setEtat({
          genre: "erreur",
          message:
            nomErreur === "PasswordException"
              ? "Ce PDF est protégé par un mot de passe : il ne peut pas être affiché ici. Téléchargez-le pour l'ouvrir."
              : "L'aperçu de ce PDF est indisponible dans le navigateur. Le fichier, lui, est intact : téléchargez-le pour l'ouvrir.",
          telechargeable: true,
        });
      }
    })();
    return () => {
      annule = true;
    };
  }, [visible, adresse]);

  useEffect(() => () => void pdf.current?.cleanup(), []);

  // Rendu de la page courante, ajustée à la largeur, nette sur écran dense.
  useEffect(() => {
    if (etat.genre !== "pret" || largeur === 0) return;
    const doc = pdf.current;
    const canevas = toile.current;
    if (!doc || !canevas) return;
    let tache: { cancel: () => void; promise: Promise<void> } | null = null;
    let annule = false;
    (async () => {
      const p = await doc.getPage(page);
      if (annule) return;
      const base = p.getViewport({ scale: 1 });
      const echelle = (largeur / base.width) * zoom;
      const vue = p.getViewport({ scale: echelle });
      // PDF-10 : une page démesurée (affiche, plan) ne doit pas saturer la
      // mémoire d'un téléphone : la surface dessinée est plafonnée.
      const densite = densiteDeRendu(vue.width, vue.height, window.devicePixelRatio);
      canevas.width = Math.floor(vue.width * densite);
      canevas.height = Math.floor(vue.height * densite);
      canevas.style.width = `${Math.floor(vue.width)}px`;
      canevas.style.height = `${Math.floor(vue.height)}px`;
      const contexte = canevas.getContext("2d");
      if (!contexte) return;
      tache = p.render({ canvasContext: contexte, viewport: vue, transform: densite === 1 ? undefined : [densite, 0, 0, densite, 0, 0], canvas: canevas }) as unknown as {
        cancel: () => void;
        promise: Promise<void>;
      };
      await tache.promise.catch(() => undefined);
    })();
    return () => {
      annule = true;
      tache?.cancel();
    };
  }, [etat, page, zoom, largeur]);

  const total = etat.genre === "pret" ? etat.total : 0;
  const aller = useCallback((n: number) => setPage(() => Math.min(Math.max(1, n), Math.max(total, 1))), [total]);

  function basculerPleinEcran() {
    const el = cadre.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div
      ref={cadre}
      className="lecteur-pdf"
      data-plein-ecran={pleinEcran ? "" : undefined}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (etat.genre !== "pret") return;
        if (e.key === "ArrowRight" || e.key === "PageDown") aller(page + 1);
        if (e.key === "ArrowLeft" || e.key === "PageUp") aller(page - 1);
      }}
    >
      <div className="lecteur-pdf-barre">
        <span className="flex min-w-0 items-center gap-2">
          <FileText size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
          <span className="truncate font-semibold">{nom}</span>
        </span>
        {etat.genre === "erreur" && !etat.telechargeable ? null : (
          <a href={`/documents/${fichier}`} className="lecteur-pdf-bouton" aria-label={`Télécharger ${nom}`} title="Télécharger">
            <Download size={18} strokeWidth={1.75} aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="lecteur-pdf-page">
        {etat.genre === "attente" ? (
          <p className="meta m-0 py-16 text-center">Chargement du document…</p>
        ) : etat.genre === "erreur" ? (
          <div className="px-4 py-10 text-center" role="alert">
            <p className="m-0">{etat.message}</p>
            {etat.telechargeable ? (
              <a href={`/documents/${fichier}`} className="bouton bouton-secondaire mt-4">
                <Download size={18} strokeWidth={1.75} aria-hidden="true" /> Télécharger le PDF
              </a>
            ) : null}
          </div>
        ) : (
          <canvas ref={toile} role="img" aria-label={`Page ${page} sur ${total} du document « ${nom} »`} />
        )}
      </div>

      {etat.genre === "pret" ? (
        <div className="lecteur-pdf-commandes">
          <span className="flex items-center gap-1">
            <button type="button" className="lecteur-pdf-bouton" onClick={() => aller(page - 1)} disabled={page <= 1} aria-label="Page précédente">
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <span className="min-w-[5.5rem] text-center text-[0.875rem] font-semibold" aria-live="polite">
              Page {page} / {total}
            </span>
            <button type="button" className="lecteur-pdf-bouton" onClick={() => aller(page + 1)} disabled={page >= total} aria-label="Page suivante">
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
          {signets.length > 0 ? (
            <label className="flex items-center gap-1 text-[0.875rem]">
              <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Aller au signet</span>
              <select className="champ h-9 max-w-[200px] py-0 text-[0.8125rem]" value="" onChange={(e) => e.target.value && aller(Number(e.target.value))}>
                <option value="">Signets…</option>
                {signets.map((g, i) => (
                  <option key={`${g.page}-${i}`} value={g.page}>
                    {g.titre} (p. {g.page})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="flex items-center gap-1">
            {total > 1 ? (
              <button type="button" className="lecteur-pdf-bouton" onClick={() => setVignettes((v) => !v)} aria-pressed={vignettes} aria-label="Vignettes des pages">
                <LayoutGrid size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className="lecteur-pdf-bouton" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} aria-label="Dézoomer">
              <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className="lecteur-pdf-zoom" onClick={() => setZoom(1)} aria-label="Ajuster à la largeur">
              {Math.round(zoom * 100)} %
            </button>
            <button type="button" className="lecteur-pdf-bouton" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} aria-label="Zoomer">
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className="lecteur-pdf-bouton" onClick={basculerPleinEcran} aria-label={pleinEcran ? "Quitter le plein écran" : "Plein écran"}>
              {pleinEcran ? <Minimize size={18} strokeWidth={1.75} aria-hidden="true" /> : <Maximize size={18} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </span>
        </div>
      ) : null}

      {etat.genre === "pret" && vignettes && docPret ? (
        <ul className="lecteur-pdf-vignettes" aria-label="Pages du document">
          {Array.from({ length: Math.min(total, 60) }, (_, i) => (
            <li key={i}>
              <button type="button" onClick={() => { aller(i + 1); setVignettes(false); }} aria-label={`Aller à la page ${i + 1}`} aria-current={page === i + 1 ? "page" : undefined}>
                <Vignette doc={docPret} numero={i + 1} />
                <span className="meta">{i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {etat.genre === "pret" && sansTexte ? (
        <p className="lecteur-pdf-note m-0" role="note">
          Ce PDF ne contient pas de texte lisible par un lecteur d&apos;écran (document numérisé). Si vous en avez besoin, demandez une version accessible à votre professeur.
        </p>
      ) : null}

      {etat.genre === "pret" ? (
        <p className="lecteur-pdf-note m-0">
          Le document est affiché tel que votre professeur l&apos;a déposé. Pour une lecture vocale, téléchargez-le et ouvrez-le dans votre lecteur de PDF.
        </p>
      ) : null}
    </div>
  );
}

/** Vignette d'une page (PDF-14), dessinée petite et à la demande. */
function Vignette({ doc, numero }: { doc: Document; numero: number }) {
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let annule = false;
    let tache: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const p = await doc.getPage(numero);
      if (annule || !toile.current) return;
      const base = p.getViewport({ scale: 1 });
      const vue = p.getViewport({ scale: 96 / base.width });
      toile.current.width = Math.floor(vue.width);
      toile.current.height = Math.floor(vue.height);
      const contexte = toile.current.getContext("2d");
      if (!contexte) return;
      tache = p.render({ canvasContext: contexte, viewport: vue, canvas: toile.current }) as unknown as { cancel: () => void; promise: Promise<void> };
      await tache.promise.catch(() => undefined);
    })();
    return () => {
      annule = true;
      tache?.cancel();
    };
  }, [doc, numero]);
  return <canvas ref={toile} aria-hidden="true" />;
}

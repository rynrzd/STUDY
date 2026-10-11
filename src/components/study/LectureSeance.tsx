"use client";

import { CircleHelp, MessageCircleQuestion, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { marquerIncompris, noterLecture } from "@/app/app/seances/actions";

/**
 * Lecture d'une séance — E03.
 *
 * Note la lecture (pour « Reprendre ») par une action POST au montage, et
 * propose, sur une sélection de texte, d'en faire une question au salon de la
 * matière (avec la séance citée) ou de la recopier dans sa note privée.
 * Aucune explication n'est fabriquée : il n'y a pas de modèle génératif.
 */
export function LectureSeance({
  seance,
  salonQuestion,
  incompris = false,
  children,
}: {
  seance: string;
  /** Lien vers le salon de la matière, s'il est lisible. */
  salonQuestion: string | null;
  /** Proposer « Je n'ai pas compris » (élève sur une séance publiée). */
  incompris?: boolean;
  children: React.ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ texte: string; x: number; y: number } | null>(null);
  // Le retour s'affiche là où était la sélection : en bas de l'article, il passerait inaperçu.
  const [retour, setRetour] = useState<{ ok: boolean; message: string; x: number; y: number } | null>(null);
  const [envoi, demarrer] = useTransition();

  useEffect(() => {
    void noterLecture(seance).catch(() => undefined);
  }, [seance]);

  useEffect(() => {
    const surSelection = () => {
      const s = window.getSelection();
      const texte = s?.toString().trim() ?? "";
      if (!s || texte.length < 3 || !zone.current || !s.anchorNode || !zone.current.contains(s.anchorNode)) {
        setSelection(null);
        return;
      }
      const rect = s.getRangeAt(0).getBoundingClientRect();
      const parent = zone.current.getBoundingClientRect();
      setSelection({ texte: texte.slice(0, 600), x: rect.left - parent.left, y: rect.bottom - parent.top + 8 });
    };
    document.addEventListener("selectionchange", surSelection);
    return () => document.removeEventListener("selectionchange", surSelection);
  }, []);

  useEffect(() => {
    if (retour === null) return;
    const t = window.setTimeout(() => setRetour(null), 6000);
    return () => window.clearTimeout(t);
  }, [retour]);

  const citer = (texte: string) => `« ${texte} »`;

  return (
    <div ref={zone} className="relative">
      {children}
      {selection ? (
        <div
          role="toolbar"
          aria-label="Actions sur le passage sélectionné"
          className="absolute z-20 flex gap-1 rounded-[10px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-1 shadow-[var(--shadow-flottant)]"
          style={{ left: Math.max(0, selection.x), top: selection.y }}
        >
          {salonQuestion ? (
            <a
              className="bouton bouton-discret bouton-compact"
              href={`${salonQuestion}?seance=${seance}&citation=${encodeURIComponent(selection.texte)}`}
            >
              <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden="true" /> Poser une question
            </a>
          ) : null}
          {incompris ? (
            <button
              type="button"
              className="bouton bouton-discret bouton-compact"
              disabled={envoi}
              onClick={() => {
                const { texte, x, y } = selection;
                demarrer(async () => {
                  const r = await marquerIncompris(seance, texte);
                  setRetour({ ...r, x, y });
                  setSelection(null);
                  window.getSelection()?.removeAllRanges();
                });
              }}
            >
              <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" /> Je n&apos;ai pas compris
            </button>
          ) : null}
          <button
            type="button"
            className="bouton bouton-discret bouton-compact"
            onClick={() => {
              const note = document.getElementById(`note-${seance}`) as HTMLTextAreaElement | null;
              if (note) {
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
                setter?.call(note, `${note.value}${note.value ? "\n\n" : ""}${citer(selection.texte)}\n`);
                note.dispatchEvent(new Event("input", { bubbles: true }));
                note.focus();
              }
              setSelection(null);
            }}
          >
            <NotebookPen size={16} strokeWidth={1.75} aria-hidden="true" /> Dans ma note
          </button>
        </div>
      ) : null}
      {/* Région toujours présente : un lecteur d'écran n'annonce pas une région créée en même temps que son texte. */}
      <div role="status">
        {retour ? (
          <p
            style={{ left: Math.max(0, retour.x), top: retour.y }}
            className={`absolute z-20 max-w-[32rem] rounded-[10px] p-3 text-[0.875rem] shadow-[var(--shadow-flottant)] ${retour.ok ? "bg-[color:var(--color-rose-clair)]" : "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]"}`}
          >
            {retour.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

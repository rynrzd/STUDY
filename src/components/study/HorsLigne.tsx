"use client";

import { CloudDownload, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Copies hors ligne, bornées (dossier V6, §10) : seulement des séances
 * choisies une à une, jamais sur un poste partagé, listées et effaçables.
 * Au retour du réseau, chaque copie est revalidée ; une séance retirée ou
 * devenue inaccessible est effacée de l'appareil. On ne promet pas plus :
 * ce qui a déjà été lu ou copié ailleurs ne s'efface pas à distance.
 */

const CLE = "study-hors-ligne-v1";
const MAX = 30;

export interface CopieLocale {
  readonly id: string;
  readonly titre: string;
  readonly matiere: string | null;
  readonly version: number | null;
  readonly paragraphes: readonly string[];
  readonly enregistreeLe: string;
}

function lire(): CopieLocale[] {
  try {
    return JSON.parse(window.localStorage.getItem(CLE) ?? "[]") as CopieLocale[];
  } catch {
    return [];
  }
}

function ecrire(copies: CopieLocale[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(copies.slice(0, MAX)));
    window.dispatchEvent(new Event("study-hors-ligne"));
  } catch {
    /* stockage plein ou indisponible */
  }
}

function abonner(rappel: () => void) {
  window.addEventListener("study-hors-ligne", rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener("study-hors-ligne", rappel);
    window.removeEventListener("storage", rappel);
  };
}

let instantane = "[]";
function lireBrut() {
  try {
    instantane = window.localStorage.getItem(CLE) ?? "[]";
  } catch {
    instantane = "[]";
  }
  return instantane;
}

export function useCopies(): CopieLocale[] {
  const brut = useSyncExternalStore(abonner, lireBrut, () => "[]");
  try {
    return JSON.parse(brut) as CopieLocale[];
  } catch {
    return [];
  }
}

/** Enregistre le service worker borné, ou l'efface si les copies ne sont pas autorisées. */
export function ServiceHorsLigne({ autorise }: { autorise: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (autorise) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    } else {
      void navigator.serviceWorker.getRegistrations()
        .then((rs) => Promise.all(rs.filter((r) =>
          [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js"),
        ).map((r) => r.unregister())))
        .catch(() => undefined);
      if ("caches" in window) {
        void caches.keys().then((cles) => Promise.all(
          cles.filter((c) => c.startsWith("study-")).map((c) => caches.delete(c)),
        )).catch(() => undefined);
      }
    }
  }, [autorise]);

  // Au retour du réseau : les copies sont revalidées sous les droits actuels.
  useEffect(() => {
    if (!autorise) return;
    const revalider = async () => {
      const copies = lire();
      const gardees: CopieLocale[] = [];
      for (const c of copies) {
        try {
          const r = await fetch(`/api/v6/seances/${c.id}/texte`, { cache: "no-store" });
          if (r.status === 404 || r.status === 403) continue; // retirée : effacée
          gardees.push(c);
        } catch {
          gardees.push(c);
        }
      }
      if (gardees.length !== copies.length) ecrire(gardees);
    };
    window.addEventListener("online", revalider);
    if (navigator.onLine) void revalider();
    return () => window.removeEventListener("online", revalider);
  }, [autorise]);
  return null;
}

export function BoutonHorsLigne({ seance, autorise }: { seance: string; autorise: boolean }) {
  const copies = useCopies();
  const [etat, setEtat] = useState<"repos" | "envoi" | "erreur">("repos");
  if (!autorise) return null;
  const presente = copies.some((c) => c.id === seance);
  return (
    <button
      type="button"
      className="bouton bouton-discret w-full justify-start"
      disabled={etat === "envoi"}
      onClick={async () => {
        if (presente) {
          ecrire(lire().filter((c) => c.id !== seance));
          return;
        }
        setEtat("envoi");
        try {
          const r = await fetch(`/api/v6/seances/${seance}/texte`, { cache: "no-store" });
          if (!r.ok) throw new Error("refus");
          const d = (await r.json()) as Omit<CopieLocale, "enregistreeLe">;
          ecrire([{ ...d, enregistreeLe: new Date().toISOString() }, ...lire().filter((c) => c.id !== seance)]);
          setEtat("repos");
        } catch {
          setEtat("erreur");
        }
      }}
    >
      <CloudDownload size={20} strokeWidth={1.75} aria-hidden="true" />
      {presente ? "Retirer la copie hors ligne" : etat === "envoi" ? "Copie…" : etat === "erreur" ? "Copie impossible, réessayer" : "Garder hors ligne"}
    </button>
  );
}

export function CopiesLocales() {
  const copies = useCopies();
  const [ouverte, setOuverte] = useState<string | null>(null);
  if (copies.length === 0) {
    return <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune copie sur cet appareil. Depuis une séance, choisis « Garder hors ligne ».</p>;
  }
  return (
    <div>
      <ul className="m-0 list-none p-0">
        {copies.map((c) => (
          <li key={c.id} className="ligne block">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold" aria-expanded={ouverte === c.id} onClick={() => setOuverte(ouverte === c.id ? null : c.id)}>
                {c.titre}
              </button>
              <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => ecrire(lire().filter((x) => x.id !== c.id))}>
                <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Retirer
              </button>
            </div>
            <p className="meta m-0">
              {c.matiere ?? "Cours"}
              {c.version ? ` · version ${c.version}` : ""} · copiée le {new Date(c.enregistreeLe).toLocaleDateString("fr-FR")}
            </p>
            {ouverte === c.id ? (
              <div className="lecture mt-3">
                {c.paragraphes.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="bouton bouton-danger mt-4"
        onClick={async () => {
          ecrire([]);
          try {
            window.localStorage.removeItem(CLE);
            const cles = await caches.keys();
            await Promise.all(cles.filter((k) => k.startsWith("study-")).map((k) => caches.delete(k)));
            const rs = await navigator.serviceWorker?.getRegistrations();
            await Promise.all((rs ?? []).map((r) => r.unregister()));
          } catch {
            /* rien de plus à effacer */
          }
        }}
      >
        Effacer cet appareil
      </button>
    </div>
  );
}

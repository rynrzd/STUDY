"use client";

import Link from "next/link";
import { useState } from "react";
import { History } from "lucide-react";
import { restaurerUneVersion } from "@/app/professeur/studio/actions";

/**
 * Restaurer une version — deux temps. Rien n'est réécrit : la version choisie
 * est recopiée dans une nouvelle version, et ce que voient les élèves ne
 * change qu'à la prochaine publication.
 */
export function RestaurerVersion({ document, version, numero }: { document: string; version: string; numero: number }) {
  const [etape, setEtape] = useState<"repos" | "confirmer" | "envoi" | "fait" | "erreur">("repos");
  const [message, setMessage] = useState("");

  async function restaurer() {
    setEtape("envoi");
    const r = await restaurerUneVersion(document, version).catch(() => ({ ok: false as const, message: "La réponse du serveur n'est pas arrivée. Rechargez la page." }));
    if (r.ok) {
      setEtape("fait");
      setMessage(`Version ${numero} restaurée : elle est maintenant la version de travail.`);
    } else {
      setEtape("erreur");
      setMessage(r.message);
    }
  }

  if (etape === "fait") {
    return (
      <span className="flex flex-wrap items-center gap-2 text-[0.875rem] text-[color:var(--color-succes)]" role="status">
        {message}
        <Link href={`/professeur/studio/${document}`} className="font-semibold text-[color:var(--color-accent)]">
          Ouvrir
        </Link>
      </span>
    );
  }

  if (etape === "confirmer" || etape === "envoi" || etape === "erreur") {
    return (
      <span className="flex flex-wrap items-center gap-2 text-[0.875rem]">
        <span>Recopier la version {numero} en nouvelle version de travail ?</span>
        <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setEtape("repos")} disabled={etape === "envoi"}>
          Annuler
        </button>
        <button type="button" className="bouton bouton-compact bouton-primaire" onClick={() => void restaurer()} disabled={etape === "envoi"}>
          {etape === "envoi" ? "…" : "Restaurer"}
        </button>
        {etape === "erreur" ? (
          <span className="w-full text-[color:var(--color-erreur)]" role="alert">
            {message}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button type="button" className="bouton bouton-compact bouton-secondaire" onClick={() => setEtape("confirmer")}>
      <History size={16} strokeWidth={1.75} aria-hidden="true" /> Restaurer
    </button>
  );
}

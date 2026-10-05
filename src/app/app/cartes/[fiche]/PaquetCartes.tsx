"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { avisCarte } from "@/app/app/reviser/actions";

interface CarteVue {
  readonly recto: string;
  readonly verso: string;
  readonly lesson: string;
  readonly ref: string;
}

/**
 * Une carte à la fois : la réponse est cachée tant qu'on ne la retourne pas
 * (au clavier comme à la souris). L'avis « À revoir / Je savais » est une
 * auto-évaluation, enregistrée une seule fois par carte et par passage.
 */
export function PaquetCartes({ fiche, cartes }: { fiche: string; cartes: readonly CarteVue[] }) {
  const [index, setIndex] = useState(0);
  const [retournee, setRetournee] = useState(false);
  const [avis, setAvis] = useState<("a_revoir" | "je_savais")[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const clients = useMemo(() => cartes.map(() => crypto.randomUUID()), [cartes]);
  const zone = useRef<HTMLButtonElement>(null);
  const fini = index >= cartes.length;
  const carte = cartes[index];

  const noter = async (valeur: "a_revoir" | "je_savais") => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await avisCarte(fiche, index, valeur, clients[index]!);
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      setAvis((a) => [...a, valeur]);
      setIndex((i) => i + 1);
      setRetournee(false);
      requestAnimationFrame(() => zone.current?.focus());
    } catch {
      setErreur("Ton avis n'a pas été enregistré (connexion). Réessaie : il ne sera pas compté deux fois.");
    } finally {
      setEnvoi(false);
    }
  };

  if (fini) {
    const aRevoir = avis.filter((a) => a === "a_revoir").length;
    return (
      <div className="panneau text-center">
        <p className="titre-section m-0">Paquet terminé</p>
        <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
          {cartes.length - aRevoir} carte{cartes.length - aRevoir > 1 ? "s" : ""} connue{cartes.length - aRevoir > 1 ? "s" : ""}, {aRevoir} à revoir. C&apos;est ton
          auto-évaluation : elle n&apos;est vue par personne d&apos;autre.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="bouton bouton-primaire"
            onClick={() => {
              setIndex(0);
              setAvis([]);
            }}
          >
            <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" /> Recommencer
          </button>
          <Link href={`/app/fiches/${fiche}`} className="bouton bouton-secondaire">
            Revenir à la fiche
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="meta m-0 mb-3" aria-live="polite">
        Carte {index + 1} sur {cartes.length}
      </p>
      <button
        ref={zone}
        type="button"
        aria-pressed={retournee}
        aria-label={retournee ? "Carte retournée, réponse affichée" : "Retourner la carte pour voir la réponse"}
        onClick={() => setRetournee((r) => !r)}
        className="grid min-h-[260px] w-full place-items-center rounded-[14px] border-0 bg-[color:var(--color-rose-clair)] p-8 text-center"
      >
        <span>
          <span className="block font-[family-name:var(--font-titre)] text-[1.375rem] font-semibold leading-[1.45]">{carte!.recto}</span>
          {retournee ? (
            <span className="mt-5 block border-t border-[color:var(--color-rose-decor)] pt-5 text-[1rem] leading-[1.7]">{carte!.verso}</span>
          ) : (
            <span className="meta mt-5 block">Appuie pour retourner (Entrée ou Espace)</span>
          )}
        </span>
      </button>
      {retournee ? (
        <p className="meta m-0 mt-2">
          <Link href={`/app/seances/${carte!.lesson}${carte!.ref.startsWith("bloc:") ? `#${carte!.ref.replace(":", "-")}` : ""}`}>Voir dans le cours</Link>
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="m-0 mt-3 text-[color:var(--color-erreur)]">
          {erreur}
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" className="bouton bouton-secondaire" disabled={!retournee || envoi} onClick={() => void noter("a_revoir")}>
          À revoir
        </button>
        <button type="button" className="bouton bouton-primaire" disabled={!retournee || envoi} onClick={() => void noter("je_savais")}>
          Je savais
        </button>
      </div>
    </div>
  );
}

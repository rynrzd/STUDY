"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { avisCarte } from "@/app/app/reviser/actions";
import { CocheFin } from "@/components/study/CocheFin";

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
        <CocheFin />
        <p className="titre-section m-0 mt-3">Paquet terminé</p>
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
      {/* Retournement sur l'axe vertical (brief §3) : les deux faces occupent la
          même cellule de grille, la carte prend la hauteur de la plus haute —
          aucun texte coupé. La face cachée est retirée de l'arbre
          d'accessibilité ; le nom du bouton est la face visible. */}
      <div className="carte-memoire" data-retournee={retournee ? "oui" : "non"} key={index}>
        <button
          ref={zone}
          type="button"
          aria-pressed={retournee}
          onClick={() => setRetournee((r) => !r)}
          className="block w-full cursor-pointer rounded-[16px] border-0 bg-transparent p-0 text-center"
        >
          <span className="carte-memoire-interieur">
            <span className="carte-memoire-face carte-memoire-recto bg-[color:var(--color-rose-clair)]" aria-hidden={retournee}>
              <span>
                <span className="block font-[family-name:var(--font-titre)] text-[1.375rem] font-semibold leading-[1.45]">{carte!.recto}</span>
                <span className="meta mt-5 block">Appuie pour retourner (Entrée ou Espace)</span>
              </span>
            </span>
            <span
              className="carte-memoire-face carte-memoire-verso border border-[color:var(--color-rose-moyen)] bg-[color:var(--color-surface)]"
              aria-hidden={!retournee}
            >
              <span>
                <span className="meta block">{carte!.recto}</span>
                <span className="mt-4 block text-[1.0625rem] leading-[1.7]">{carte!.verso}</span>
              </span>
            </span>
          </span>
        </button>
      </div>
      {/* La ligne existe toujours : les boutons « À revoir / Je savais » ne bougent pas au retournement. */}
      <p className="meta m-0 mt-2 min-h-[1.5rem]">
        {retournee ? (
          <Link href={`/app/seances/${carte!.lesson}${carte!.ref.startsWith("bloc:") ? `#${carte!.ref.replace(":", "-")}` : ""}`}>Voir dans le cours</Link>
        ) : null}
      </p>
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

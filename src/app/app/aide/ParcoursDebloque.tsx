"use client";

import Link from "next/link";
import { BookOpen, Lightbulb, MessageCircleQuestion, MessageSquareLock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { demanderAide, lancerEntrainement, variante } from "@/app/app/reviser/actions";
import { Etapes } from "@/components/study/ui";

const ETAPES = [{ titre: "Ton essai" }, { titre: "Indice, exemple" }, { titre: "Vérifier" }, { titre: "Demander" }] as const;
const NUMERO: Record<Etape, number> = { essai: 1, indice: 2, exemple: 2, verification: 3, relais: 4 };

interface ExerciceAide {
  readonly versionId: string;
  readonly enonce: string;
  readonly seance: string | null;
  readonly titreSeance: string | null;
}

type Etape = "essai" | "indice" | "exemple" | "verification" | "relais";

/**
 * Exercice → tentative décrite → indice → exemple → nouvelle vérification →
 * relais humain. Le partage à la classe passe par un aperçu exact : seuls la
 * question, l'exercice et ce que l'élève a choisi d'écrire partent ; ses
 * notes privées ne partent jamais.
 */
export function ParcoursDebloque({ exercices, salon }: { exercices: readonly ExerciceAide[]; salon: string | null }) {
  const [choisi, setChoisi] = useState<ExerciceAide>(exercices[0]!);
  const [essai, setEssai] = useState("");
  const [etape, setEtape] = useState<Etape>("essai");
  const [aides, setAides] = useState<{ niveau: string; texte: string }[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [varianteId, setVarianteId] = useState<string | null | undefined>(undefined);

  const demander = async (niveau: "indice" | "exemple") => {
    setErreur(null);
    const r = await demanderAide(choisi.versionId, niveau);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    const texte =
      typeof r.donnees === "string" && r.donnees.trim()
        ? r.donnees
        : niveau === "indice"
          ? "Ton professeur n'a pas préparé d'indice pour cet exercice. Relis le passage du cours lié, puis passe à l'étape suivante."
          : "Pas d'exemple préparé pour cet exercice.";
    setAides((a) => [...a, { niveau, texte }]);
    setEtape(niveau === "indice" ? "exemple" : "verification");
    if (niveau === "exemple") {
      const v = await variante(choisi.versionId);
      setVarianteId(v.ok && typeof v.donnees === "string" ? v.donnees : null);
    }
  };

  const message = [
    `Je bloque sur cet exercice${choisi.titreSeance ? ` (séance « ${choisi.titreSeance} »)` : ""} :`,
    `« ${choisi.enonce.slice(0, 400)} »`,
    essai.trim() ? `Ce que j'ai essayé : ${essai.trim().slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="panneau lg:col-span-2" aria-live="polite">
        <Etapes etapes={ETAPES} courante={NUMERO[etape]} etiquette="Progression de l'aide" />
      </div>
      <div className="grid content-start gap-4">
        {exercices.length > 1 ? (
          <div className="panneau">
            <label htmlFor="exercice" className="mb-1.5 block text-[0.8125rem] font-semibold">
              Exercice
            </label>
            <select
              id="exercice"
              className="champ"
              value={choisi.versionId}
              onChange={(e) => {
                setChoisi(exercices.find((x) => x.versionId === e.target.value)!);
                setAides([]);
                setEtape("essai");
                setVarianteId(undefined);
              }}
            >
              {exercices.map((e) => (
                <option key={e.versionId} value={e.versionId}>
                  {e.enonce.slice(0, 90)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <section className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6">
          <p className="sourcil">Exercice{choisi.titreSeance ? ` · ${choisi.titreSeance}` : ""}</p>
          <p className="m-0 text-[1.0625rem] font-semibold">{choisi.enonce}</p>
        </section>

        <section className="panneau" aria-live="polite">
          <ol className="m-0 grid list-none gap-4 p-0">
            <li>
              <label htmlFor="essai" className="mb-1.5 block font-semibold">
                1. Qu&apos;as-tu essayé ?
              </label>
              <textarea
                id="essai"
                className="champ"
                rows={3}
                value={essai}
                maxLength={800}
                onChange={(e) => setEssai(e.target.value)}
                placeholder="J'ai remplacé x par 3 mais je ne sais pas où lire le résultat…"
              />
              {etape === "essai" ? (
                <button type="button" className="bouton bouton-primaire mt-3" onClick={() => void demander("indice")}>
                  <Lightbulb size={16} strokeWidth={1.75} aria-hidden="true" /> Un premier indice
                </button>
              ) : null}
            </li>
            {aides.map((a, i) => (
              <li key={i} className="rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4">
                <p className="m-0 mb-1 font-semibold">{a.niveau === "indice" ? "2. Indice" : "3. Un exemple proche"}</p>
                <p className="m-0">{a.texte}</p>
              </li>
            ))}
            {etape === "exemple" ? (
              <li className="flex flex-wrap gap-2">
                <button type="button" className="bouton bouton-secondaire" onClick={() => void demander("exemple")}>
                  Voir un exemple
                </button>
                <button type="button" className="bouton bouton-discret" onClick={() => setEtape("verification")}>
                  C&apos;est bon, je réessaie
                </button>
              </li>
            ) : null}
            {etape === "verification" ? (
              <li>
                <p className="m-0 mb-2 font-semibold">4. Vérifie avec une nouvelle question</p>
                <form action={lancerEntrainement} className="flex flex-wrap gap-2">
                  <input type="hidden" name="titre" value="Nouvelle vérification" />
                  <input type="hidden" name="version" value={varianteId ?? choisi.versionId} />
                  <button type="submit" className="bouton bouton-primaire">
                    <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" /> {varianteId ? "Une variante" : "Réessayer l'exercice"}
                  </button>
                  <button type="button" className="bouton bouton-discret" onClick={() => setEtape("relais")}>
                    Je bloque encore
                  </button>
                </form>
              </li>
            ) : null}
          </ol>
          {erreur ? (
            <p role="alert" className="m-0 mt-3 text-[color:var(--color-erreur)]">
              {erreur}
            </p>
          ) : null}
        </section>

        {etape === "relais" || aides.length >= 2 ? (
          <section className="panneau border-[color:var(--color-accent)]" aria-labelledby="relais">
            <h2 id="relais" className="titre-section">
              Demander à quelqu&apos;un
            </h2>
            <p className="m-0 mt-2">Voici exactement ce qui sera envoyé — rien d&apos;autre, et surtout pas tes notes privées :</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-[10px] bg-[color:var(--color-rose-clair)] p-3 font-[family-name:var(--font-texte)] text-[0.875rem]">{message}</pre>
            <div className="mt-4 flex flex-wrap gap-2">
              {salon ? (
                <Link
                  href={`${salon}?${choisi.seance ? `seance=${choisi.seance}&` : ""}citation=${encodeURIComponent(message)}`}
                  className="bouton bouton-primaire"
                >
                  <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden="true" /> Demander à la classe
                </Link>
              ) : null}
              <Link
                href={`/app/demandes/nouvelle?${choisi.seance ? `seance=${choisi.seance}&` : ""}sujet=${encodeURIComponent("Je bloque sur un exercice")}`}
                className="bouton bouton-secondaire"
              >
                <MessageSquareLock size={16} strokeWidth={1.75} aria-hidden="true" /> Demander discrètement à un professeur
              </Link>
            </div>
          </section>
        ) : null}
      </div>
      <aside className="grid content-start gap-4">
        {choisi.seance ? (
          <section className="panneau">
            <h2 className="titre-bloc mb-2">Le cours</h2>
            <p className="meta m-0">{choisi.titreSeance}</p>
            <Link href={`/app/seances/${choisi.seance}`} className="bouton bouton-secondaire mt-3">
              <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Relire la séance
            </Link>
          </section>
        ) : null}
        <p className="meta m-0">Les indices utilisés comptent dans ton suivi : une réussite après indice ne fait pas progresser la notion, elle la garde.</p>
      </aside>
    </div>
  );
}

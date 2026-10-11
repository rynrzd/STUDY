import Link from "next/link";
import { BookOpen, Camera, CheckCircle2, CircleDashed, CircleDot, Sparkles, XCircle } from "lucide-react";
import { lancerEntrainement } from "@/app/app/reviser/actions";
import { texteAttendu, texteReponse } from "@/components/evaluations/ReponseLisible";
import { Compteur, Confettis, Medaillon } from "@/components/study/Celebrations";
import { formaterNote, LIBELLES_NIVEAU, niveauMaitrise, noteSur20 } from "@/lib/evaluations/analyse";
import type { LigneCopieCorrigee, Notation } from "@/lib/v6/evaluations";

/** Classes écrites en entier : Tailwind ne voit pas les classes construites à la volée. */
const BORDURE = { succes: "border-l-[color:var(--color-succes)]", attention: "border-l-[color:var(--color-attention)]", erreur: "border-l-[color:var(--color-erreur)]" } as const;
const COULEUR = { succes: "text-[color:var(--color-succes)]", attention: "text-[color:var(--color-attention)]", erreur: "text-[color:var(--color-erreur)]" } as const;

const NIVEAU_FOND = {
  non_acquis: "bg-[#f8d9d6] text-[#7a211c]",
  fragile: "bg-[#fbe6c8] text-[#6b4510]",
  satisfaisant: "bg-[#dcefe2] text-[#245536]",
  tres_bonne_maitrise: "bg-[#2f6a45] text-white",
} as const;

/**
 * La copie corrigée de l'élève : sa note ou son niveau, notion par notion, et
 * chaque question avec sa réponse, l'attendu, l'explication et le mot du
 * professeur. Puis la remise à niveau sur les notions ratées, avec les
 * exercices du professeur — rien n'est inventé.
 */
export function CopieCorrigee({
  titre,
  notation,
  lignes,
  remiseANiveau,
  photos,
}: {
  titre: string;
  notation: Notation;
  lignes: readonly LigneCopieCorrigee[];
  remiseANiveau: readonly string[];
  photos: readonly string[];
}) {
  const maximum = lignes.reduce((s, l) => s + l.pointsMax, 0);
  const points = lignes.reduce((s, l) => s + (l.points ?? 0), 0);
  const absent = lignes.every((l) => l.reponse === null && l.points === null);
  const note = noteSur20(points, maximum);
  const niveau = maximum > 0 ? niveauMaitrise(points / maximum) : null;
  const reussie = maximum > 0 && points / maximum >= 0.75;

  const parNotion = new Map<string, { notion: string; obtenus: number; max: number }>();
  for (const l of lignes) {
    if (!l.notionId || !l.notion) continue;
    const n = parNotion.get(l.notionId) ?? { notion: l.notion, obtenus: 0, max: 0 };
    n.obtenus += l.points ?? 0;
    n.max += l.pointsMax;
    parNotion.set(l.notionId, n);
  }

  return (
    <div className="grid gap-6">
      <section className="panneau relative overflow-hidden text-center" aria-labelledby="bilan-eval">
        <span className="relative mx-auto block w-fit">
          <Medaillon ton={reussie ? "succes" : "marque"} />
          {reussie ? <Confettis ton="succes" taille="petit" /> : null}
        </span>
        <h2 id="bilan-eval" className="titre-bloc m-0 mt-3 font-bold">
          {absent ? "Tu n'as pas composé cette évaluation" : "Ta copie corrigée"}
        </h2>
        <p className="meta m-0 mt-1">{titre}</p>
        {!absent ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            {notation !== "maitrise" ? (
              <p className="m-0 flex items-baseline gap-1">
                {/* Le compteur animé ne compte qu'en entiers : une note en demi-point s'affiche fixe. */}
                {note !== null && Number.isInteger(note) ? <Compteur valeur={note} /> : <span className="text-[3rem] font-extrabold leading-none tracking-[-0.05em] text-[color:var(--color-accent)]">{formaterNote(note)}</span>}
                <span className="text-[1.25rem] font-bold text-[color:var(--color-encre-faible)]">/ 20</span>
              </p>
            ) : null}
            {notation !== "sur20" && niveau ? <span className={`rounded-full px-4 py-1.5 font-bold ${NIVEAU_FOND[niveau]}`}>{LIBELLES_NIVEAU[niveau]}</span> : null}
          </div>
        ) : null}
        {!absent ? (
          <p className="meta m-0 mt-2">
            {String(points).replace(".", ",")} point{points > 1 ? "s" : ""} sur {String(maximum).replace(".", ",")}
          </p>
        ) : null}
      </section>

      {parNotion.size > 0 && !absent ? (
        <section className="panneau" aria-labelledby="notions">
          <h2 id="notions" className="titre-bloc m-0 mb-3 font-bold">
            Notion par notion
          </h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {[...parNotion.values()].map((n) => {
              const niv = niveauMaitrise(n.max ? n.obtenus / n.max : 0);
              return (
                <li key={n.notion} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] pb-2">
                  <span className="font-semibold">{n.notion}</span>
                  <span className={`rounded-full px-3 py-1 text-[0.8125rem] font-bold ${NIVEAU_FOND[niv]}`}>{LIBELLES_NIVEAU[niv]}</span>
                </li>
              );
            })}
          </ul>
          {remiseANiveau.length > 0 ? (
            <form action={lancerEntrainement} className="mt-4 rounded-[var(--rayon-m)] border-l-[3px] border-l-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)] p-4">
              {remiseANiveau.map((v) => (
                <input key={v} type="hidden" name="version" value={v} />
              ))}
              <input type="hidden" name="titre" value={`Remise à niveau — ${titre}`.slice(0, 140)} />
              <p className="m-0 font-bold">Ta remise à niveau est prête</p>
              <p className="meta m-0 mt-1">
                {remiseANiveau.length} exercice{remiseANiveau.length > 1 ? "s" : ""} de ton professeur, sur les notions à reprendre. Elles sont aussi « à revoir » dans ta révision.
              </p>
              <button type="submit" className="bouton bouton-primaire mt-3">
                <Sparkles size={16} aria-hidden="true" /> Me remettre à niveau
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="panneau" aria-labelledby="photos">
          <h2 id="photos" className="titre-bloc m-0 mb-2 font-bold">
            Ta copie papier
          </h2>
          <div className="flex flex-wrap gap-3">
            {photos.map((f, i) => (
              <a key={f} href={`/documents/${f}`} className="bouton bouton-secondaire">
                <Camera size={16} aria-hidden="true" /> Photo {i + 1}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <ol className="m-0 grid list-none gap-4 p-0">
        {lignes.map((l) => {
          const partiel = l.points !== null && !l.juste && l.points > 0;
          const Icone = l.points === null ? CircleDashed : l.juste ? CheckCircle2 : partiel ? CircleDot : XCircle;
          const ton = l.points === null ? null : l.juste ? "succes" : partiel ? "attention" : "erreur";
          const item = { kind: l.kind, choix: l.choix };
          return (
            <li key={l.questionId} className={`panneau border-l-[4px] ${ton ? BORDURE[ton] : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="m-0 font-semibold whitespace-pre-wrap">
                  {l.ordre}. {l.enonce}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 font-bold">
                  <Icone size={18} aria-hidden="true" className={ton ? COULEUR[ton] : "text-[color:var(--color-encre-faible)]"} />
                  {l.points === null ? "—" : String(l.points).replace(".", ",")} / {String(l.pointsMax).replace(".", ",")}
                </span>
              </div>
              <p className="m-0 mt-3 text-[0.9375rem]">
                <span className="font-semibold">Ta réponse : </span>
                <span className="whitespace-pre-wrap">{texteReponse(item, l.reponse)}</span>
              </p>
              {l.kind !== "redigee" && !l.juste && l.attendu ? (
                <p className="m-0 mt-1 text-[0.9375rem]">
                  <span className="font-semibold">Réponse attendue : </span>
                  {texteAttendu(item, l.attendu)}
                </p>
              ) : null}
              {l.commentaire ? <p className="m-0 mt-2 border-l-[3px] border-l-[color:var(--color-accent)] pl-3 text-[0.9375rem]">{l.commentaire}</p> : null}
              {l.explication ? <p className="m-0 mt-2 text-[0.9375rem] text-[color:var(--color-encre-faible)]">{l.explication}</p> : null}
              {l.sourceLecon ? (
                <Link href={`/app/seances/${l.sourceLecon}${l.sourceBloc ? `#bloc-${l.sourceBloc}` : ""}`} className="meta mt-2 inline-flex items-center gap-1">
                  <BookOpen size={14} aria-hidden="true" /> Revoir le passage du cours
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, FolderKanban, Lightbulb, MessageCircle, Search, Target, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GenreResultat, Resultat } from "@/lib/recherche/moteur";
import type { ReponseRecherche } from "@/lib/recherche/service";

const GENRES: { cle: GenreResultat; libelle: string; icone: typeof BookOpen }[] = [
  { cle: "seance", libelle: "Cours", icone: BookOpen },
  { cle: "exercice", libelle: "Exercices", icone: Target },
  { cle: "fiche", libelle: "Fiches", icone: FileText },
  { cle: "message", libelle: "Discussions", icone: MessageCircle },
  { cle: "decision", libelle: "Décisions", icone: Lightbulb },
  { cle: "projet", libelle: "Projets", icone: FolderKanban },
];

const VALIDATION: Record<string, string> = {
  professeur: "Publié par un professeur",
  eleve: "Écrit par un élève",
  genere: "Généré, à vérifier",
};

type Etat =
  | { type: "vide" }
  | { type: "chargement" }
  | { type: "resultats"; reponse: ReponseRecherche; plus: boolean }
  | { type: "erreur"; message: string; requestId: string | null }
  | { type: "session" };

/**
 * Saisie : 300 ms d'inactivité ou Entrée. Chaque nouvelle requête annule la
 * précédente (AbortController) et une réponse obsolète est ignorée. La
 * requête et les filtres vivent dans l'URL : retour arrière et rechargement
 * retrouvent la même recherche.
 */
export function Recherche({
  initiale,
  classes,
}: {
  initiale: { q: string; types: string[]; classe: string };
  classes: readonly { id: string; libelle: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initiale.q);
  const [types, setTypes] = useState<string[]>(initiale.types);
  const [classe, setClasse] = useState(classes.some((c) => c.id === initiale.classe) ? initiale.classe : "");
  const [etat, setEtat] = useState<Etat>({ type: "vide" });
  const courant = useRef<AbortController | null>(null);
  const numero = useRef(0);

  const lancer = useCallback(
    async (texte: string, curseur: string | null = null) => {
      const requete = texte.trim();
      courant.current?.abort();
      if (requete.length < 2) {
        setEtat({ type: "vide" });
        return;
      }
      const controle = new AbortController();
      courant.current = controle;
      const ce = ++numero.current;
      if (!curseur) setEtat({ type: "chargement" });
      const params = new URLSearchParams({ q: requete });
      if (types.length > 0) params.set("types", types.join(","));
      if (classe) params.set("classe", classe);
      if (!curseur) router.replace(`/app/recherche?${params.toString()}`, { scroll: false });
      if (curseur) params.set("curseur", curseur);
      try {
        const reponse = await fetch(`/api/v6/recherche?${params.toString()}`, { signal: controle.signal, cache: "no-store" });
        if (ce !== numero.current) return; // réponse obsolète
        if (reponse.status === 401) {
          setEtat({ type: "session" });
          return;
        }
        const corps = await reponse.json();
        if (!reponse.ok) {
          setEtat({ type: "erreur", message: corps?.error?.message ?? "La recherche a échoué.", requestId: corps?.error?.requestId ?? null });
          return;
        }
        const donnees = corps as ReponseRecherche;
        setEtat((precedent) =>
          curseur && precedent.type === "resultats"
            ? { type: "resultats", plus: false, reponse: { ...donnees, items: [...precedent.reponse.items, ...donnees.items] } }
            : { type: "resultats", plus: false, reponse: donnees },
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (ce !== numero.current) return;
        setEtat({
          type: "erreur",
          message: navigator.onLine ? "La recherche n'a pas abouti." : "Pas de connexion : la recherche reprendra au retour du réseau.",
          requestId: null,
        });
      }
    },
    [types, classe, router],
  );

  // 300 ms d'inactivité.
  useEffect(() => {
    const t = window.setTimeout(() => void lancer(q), 300);
    return () => window.clearTimeout(t);
  }, [q, lancer]);

  const basculer = (cle: string) => setTypes((t) => (t.includes(cle) ? t.filter((x) => x !== cle) : [...t, cle]));

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(q);
        }}
        className="panneau flex items-center gap-3 p-3 md:p-3"
      >
        <Search size={22} strokeWidth={1.75} aria-hidden="true" className="ml-1 shrink-0 text-[color:var(--color-encre-faible)]" />
        <label htmlFor="q" className="sr-only">
          Rechercher
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          autoFocus
          autoComplete="off"
          placeholder="Un mot, une notion, une question…"
          className="w-full border-0 bg-transparent py-2 text-[1rem] outline-none focus-visible:outline-none"
        />
        {q ? (
          <button type="button" className="bouton-icone" aria-label="Effacer la recherche" onClick={() => setQ("")}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="perimetre" className="sr-only">
          Périmètre
        </label>
        <select id="perimetre" className="champ w-auto min-h-[36px] py-1" value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="">Toutes mes classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
        </select>
        {GENRES.map((g) => (
          <button
            key={g.cle}
            type="button"
            aria-pressed={types.includes(g.cle)}
            onClick={() => basculer(g.cle)}
            className="etiquette-etat cursor-pointer border-0"
            data-ton={types.includes(g.cle) ? "rose" : undefined}
          >
            {g.libelle}
            {etat.type === "resultats" && etat.reponse.facettes[g.cle] ? ` · ${etat.reponse.facettes[g.cle]}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={etat.type === "chargement"}>
        {etat.type === "vide" ? <p className="m-0 text-[color:var(--color-encre-faible)]">Tape au moins deux caractères.</p> : null}
        {etat.type === "chargement" ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panneau">
                <span className="squelette-ligne mb-3 w-1/3" />
                <span className="squelette-ligne mb-2 w-2/3" />
                <span className="squelette-ligne w-1/2" />
              </div>
            ))}
          </div>
        ) : null}
        {etat.type === "session" ? (
          <p role="alert" className="m-0">
            Ta session a pris fin. <a href={`/connexion?motif=expiree&suite=${encodeURIComponent(`/app/recherche?q=${q}`)}`}>Se reconnecter</a>
          </p>
        ) : null}
        {etat.type === "erreur" ? (
          <div role="alert" className="panneau">
            <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{etat.message}</p>
            {etat.requestId ? <p className="meta m-0 mt-1">Référence : {etat.requestId.slice(0, 8)}</p> : null}
            <button type="button" className="bouton bouton-secondaire mt-3" onClick={() => void lancer(q)}>
              Réessayer
            </button>
          </div>
        ) : null}
        {etat.type === "resultats" ? (
          <>
            <p className="meta m-0 mb-3">
              {etat.reponse.mode === "lexical"
                ? "Recherche par mots (la recherche par le sens n'est pas activée dans Study)."
                : "Recherche par mots et par le sens."}
            </p>
            {etat.reponse.items.length === 0 ? (
              <div className="panneau">
                <p className="m-0 font-semibold">Aucun résultat pour « {q.trim()} »</p>
                {etat.reponse.suggestion ? (
                  <p className="m-0 mt-2">
                    Essayer{" "}
                    <button type="button" className="font-semibold text-[color:var(--color-accent)] underline" onClick={() => setQ(etat.reponse.suggestion!)}>
                      {etat.reponse.suggestion}
                    </button>{" "}
                    ?
                  </p>
                ) : null}
                <p className="meta m-0 mt-2">
                  {types.length > 0 || classe ? "Retire un filtre, ou " : ""}reformule avec un mot du cours. Seuls les contenus auxquels tu as accès
                  sont cherchés.
                </p>
              </div>
            ) : (
              <ol className="m-0 grid list-none gap-3 p-0">
                {etat.reponse.items.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <ResultatVu r={r} />
                  </li>
                ))}
              </ol>
            )}
            {etat.reponse.suivant ? (
              <button type="button" className="bouton bouton-secondaire mt-4" onClick={() => void lancer(q, etat.reponse.suivant)}>
                Plus de résultats
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ResultatVu({ r }: { r: Resultat }) {
  const g = GENRES.find((x) => x.cle === r.kind)!;
  return (
    <Link href={r.href} className="panneau block no-underline transition-colors hover:border-[color:var(--color-bordure-forte)]">
      <span className="flex flex-wrap items-center gap-2">
        <span className="etiquette-etat">
          <g.icone size={14} strokeWidth={1.75} aria-hidden="true" /> {g.libelle.replace(/s$/u, "")}
        </span>
        <span className="meta">{VALIDATION[r.validation]}</span>
        <span className="meta">· {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
      </span>
      <span className="titre-bloc mt-2 block font-bold text-[color:var(--color-encre)]">{r.titre}</span>
      {r.passages.map((p) => (
        <span key={p.ref} className="mt-1.5 block text-[0.875rem] text-[color:var(--color-encre)]">
          {p.section ? <span className="meta block">{p.section}{p.page ? ` · page ${p.page}` : ""}</span> : null}
          {p.segments.map((s, i) =>
            s.marque ? (
              <mark key={i} className="surligne-recherche">
                {s.texte}
              </mark>
            ) : (
              <span key={i}>{s.texte}</span>
            ),
          )}
        </span>
      ))}
    </Link>
  );
}

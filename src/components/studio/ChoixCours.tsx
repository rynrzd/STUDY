"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Cours = { readonly id: string; readonly libelle: string; readonly matiere: string; readonly classe: string | null; readonly groupe: string | null };

const plat = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Niveau lisible d'une classe : « 2nde 1 », « Seconde 1 » → Seconde. */
function niveau(c: Cours): string {
  if (c.groupe !== null) return "Groupes";
  const p = plat(c.classe ?? "").replace(/\s+/g, "");
  if (/^(seconde|2nde|2de|2)/.test(p)) return "Seconde";
  if (/^(premiere|1ere|1re|1)/.test(p)) return "Première";
  if (/^(terminale|term|tle|t)/.test(p)) return "Terminale";
  return "Autres";
}

/**
 * Choisir un cours — cahier des charges ch. 10 (TEACH-01). Les cours restent
 * des liens complets (jamais tronqués sur téléphone). Au-delà de quelques
 * cours, une recherche et des filtres apparaissent : matière, niveau,
 * classe ou groupe. Le filtrage est local : la liste vient déjà du serveur,
 * restreinte par la base aux cours de la personne.
 */
export function ChoixCours({ cours, choisi }: { cours: readonly Cours[]; choisi: string }) {
  const [q, setQ] = useState("");
  const [matiere, setMatiere] = useState("");
  const [niv, setNiv] = useState("");
  const matieres = useMemo(() => [...new Set(cours.map((c) => c.matiere))].sort((a, b) => a.localeCompare(b, "fr")), [cours]);
  const niveaux = useMemo(() => [...new Set(cours.map(niveau))], [cours]);
  const visibles = cours.filter(
    (c) => (!q || plat(c.libelle).includes(plat(q))) && (!matiere || c.matiere === matiere) && (!niv || niveau(c) === niv),
  );
  const filtres = cours.length > 6;

  return (
    <div className="mb-6">
      {filtres ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" role="search" aria-label="Chercher un cours">
          <label className="sr-only" htmlFor="cours-q">
            Chercher un cours
          </label>
          <input id="cours-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un cours, une classe…" className="champ" />
          <label className="sr-only" htmlFor="cours-matiere">
            Matière
          </label>
          <select id="cours-matiere" value={matiere} onChange={(e) => setMatiere(e.target.value)} className="champ">
            <option value="">Toutes les matières</option>
            {matieres.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="cours-niveau">
            Niveau
          </label>
          <select id="cours-niveau" value={niv} onChange={(e) => setNiv(e.target.value)} className="champ">
            <option value="">Tous les niveaux</option>
            {niveaux.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : null}
      <nav aria-label="Choisir un cours" className="flex flex-wrap gap-2">
        {visibles.map((autre) => (
          <Link key={autre.id} href={`/studio?cours=${autre.id}`} aria-current={autre.id === choisi ? "page" : undefined} className="pilule">
            {autre.libelle}
          </Link>
        ))}
        {visibles.length === 0 ? <p className="meta m-0">Aucun cours ne correspond.</p> : null}
      </nav>
    </div>
  );
}

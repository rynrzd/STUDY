import Link from "next/link";
import { ClipboardPen, FilePen, FileText } from "lucide-react";
import { NouveauChapitre, NouvelleSeance } from "@/components/studio/Creation";
import { GestesChapitre } from "@/components/studio/GestesChapitre";
import { ChoixCours } from "@/components/studio/ChoixCours";
import { CopierStructure } from "@/components/studio/CopierStructure";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EtatVide, Etiquette, Ligne, ListeLignes } from "@/components/study/ui";
import type { StatistiqueSeance, chapitresDuCours, coursDuProfesseur, seancesDuCours } from "@/lib/studio";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueStudio({ cours, choisi, chapitres, seances, sansChapitre, brouillons, archives = [], favoris = [], sourcesCopie = [], recherche = { q: "", etat: "" }, total = null, statistiques = [] }: {
  /** Agrégats par séance publiée (PED-10). */
  statistiques?: readonly StatistiqueSeance[];
  /** Recherche dans les séances (TEACH-13). */
  recherche?: { q: string; etat: string };
  /** Nombre de séances avant filtre. */
  total?: number | null;
  /** Cours épinglés (TEACH-17). */
  favoris?: readonly string[];
  /** Cours dont on peut copier la structure : autres cours actifs et années passées (COURS-08, COURS-15). */
  sourcesCopie?: readonly { id: string; libelle: string }[];
  /** Chapitres archivés (COURS-02), en fin de page, restaurables. */
  archives?: Awaited<ReturnType<typeof chapitresDuCours>>;
  cours: Awaited<ReturnType<typeof coursDuProfesseur>>;
  choisi: Awaited<ReturnType<typeof coursDuProfesseur>>[number];
  chapitres: Awaited<ReturnType<typeof chapitresDuCours>>;
  seances: Awaited<ReturnType<typeof seancesDuCours>>;
  sansChapitre: Awaited<ReturnType<typeof seancesDuCours>>;
  brouillons: number;
}) {
  return (
    <>
      <RubriqueCours actif="/studio" />
      <header className="mb-6 overflow-hidden rounded-3xl bg-[#49283a] px-5 py-6 text-white sm:px-8">
        <p className="m-0 text-sm text-[#f0dce6]">Mon cahier de cours</p>
        <h1 className="my-2 text-3xl font-semibold tracking-tight sm:text-4xl">{choisi.libelle}</h1>
        <p className="m-0 text-sm text-[#f0dce6]">{total ?? seances.length} séances · {brouillons} brouillons</p>
      </header>
      {cours.length > 1 && <details className="mb-5 rounded-2xl border border-[color:var(--color-bordure)] px-4">
        <summary className="cursor-pointer py-3 font-semibold">Changer de cours</summary>
        <ChoixCours cours={cours} choisi={choisi.id} favoris={favoris} />
      </details>}
      <section id="creer-une-seance" className="mb-6 scroll-mt-24" aria-label="Préparer le cours">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-bold">Préparer</h2>
          <Link href={`/professeur/devoirs?cours=${choisi.id}#donner`} className="bouton bouton-secondaire bouton-compact"><ClipboardPen size={16} aria-hidden="true" /> Donner un devoir</Link>
        </div>
        <NouvelleSeance key={choisi.id} cours={choisi.id} chapitres={chapitres} menu />
      </section>
      <div className="mb-6">
        <CopierStructure cible={choisi.id} sources={sourcesCopie} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-8">
          {chapitres.length === 0 && (total ?? seances.length) === 0 ? (
            <EtatVide
              icone={FilePen}
              titre="Ce cours est encore vide."
              texte="Tes séances apparaîtront ici."
            />
          ) : null}

          {total !== null && total > 0 ? (
            <form method="get" action="/studio" role="search" aria-label="Chercher une séance" className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
              <input type="hidden" name="cours" value={choisi.id} />
              <div>
                <label className="etiquette" htmlFor="seance-q">
                  Chercher une séance
                </label>
                <input id="seance-q" name="q" type="search" defaultValue={recherche.q} placeholder="Titre de la séance" className="champ" maxLength={80} />
              </div>
              <div>
                <label className="etiquette" htmlFor="seance-etat">
                  État
                </label>
                <select id="seance-etat" name="etat" defaultValue={recherche.etat} className="champ">
                  <option value="">Tous</option>
                  <option value="brouillon">Brouillons</option>
                  <option value="programmee">Programmées</option>
                  <option value="publiee">Publiées</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bouton bouton-compact bouton-secondaire">
                  Chercher
                </button>
                {recherche.q || recherche.etat ? (
                  <a href={`/studio?cours=${choisi.id}`} className="bouton bouton-compact bouton-discret">
                    Tout
                  </a>
                ) : null}
              </div>
              {recherche.q || recherche.etat ? (
                <p className="meta m-0 sm:col-span-3" role="status">
                  {seances.length} séance{seances.length > 1 ? "s" : ""} sur {total}.
                </p>
              ) : null}
            </form>
          ) : null}

          {chapitres
            .filter((chapitre) => !(recherche.q || recherche.etat) || seances.some((s) => s.chapter_id === chapitre.id))
            .map((chapitre, i) => (
            <ListeChapitre
              key={chapitre.id}
              titre={chapitre.label}
              seances={seances.filter((seance) => seance.chapter_id === chapitre.id)}
              cours={choisi.id}
              chapitre={chapitre.id}
              chapitres={chapitres}
              gestes={<GestesChapitre id={chapitre.id} label={chapitre.label} premier={i === 0} dernier={i === chapitres.length - 1} />}
            />
          ))}

          {sansChapitre.length > 0 ? <ListeChapitre titre="Sans chapitre" seances={sansChapitre} cours={choisi.id} chapitre={null} chapitres={chapitres} /> : null}

          {archives.length > 0 ? (
            <details className="chapitres-archives">
              <summary className="titre-section cursor-pointer">
                Chapitres archivés <span className="nombre">{archives.length}</span>
              </summary>
              <div className="mt-4 space-y-6">
                {archives.map((chapitre) => (
                  <ListeChapitre
                    key={chapitre.id}
                    titre={chapitre.label}
                    seances={seances.filter((seance) => seance.chapter_id === chapitre.id)}
                    cours={choisi.id}
                    chapitre={chapitre.id}
                    chapitres={chapitres}
                    archive
                    gestes={<GestesChapitre id={chapitre.id} label={chapitre.label} premier dernier archive />}
                  />
                ))}
              </div>
            </details>
          ) : null}

          {statistiques.length > 0 ? <SuiviAgrege lignes={statistiques} /> : null}
        </div>

        <aside id="nouveau-chapitre" className="scroll-mt-24 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5 lg:sticky lg:top-24">
          <NouveauChapitre cours={choisi.id} />
        </aside>
      </div>
    </>
  );
}


/* -------------------------------------------------------------------------- */

function ListeChapitre({
  titre,
  seances,
  cours,
  chapitre,
  chapitres,
  gestes = null,
  archive = false,
}: {
  gestes?: React.ReactNode;
  archive?: boolean;
  titre: string;
  seances: { id: string; title: string; state: string; scheduled_for: string | null }[];
  cours: string;
  chapitre: string | null;
  chapitres: { id: string; label: string }[];
}) {
  return (
    <section aria-label={titre}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="titre-section m-0 flex items-center gap-2">
          {titre} <span className="nombre">{seances.length}</span>
        </h2>
        {gestes}
      </div>

      {seances.length === 0 ? (
        <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune séance dans ce chapitre.</p>
      ) : (
        <ListeLignes>
          {seances.map((seance) => (
            <Ligne
              key={seance.id}
              href={`/studio/${seance.id}`}
              icone={seance.state === "publiee" ? FileText : FilePen}
              titre={seance.title}
              detail={
                seance.scheduled_for === null
                  ? "Sans date"
                  : new Date(seance.scheduled_for).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })
              }
              fin={<Etiquette ton={seance.state === "publiee" ? "succes" : "attention"}>{seance.state === "publiee" ? "Publiée" : "Brouillon"}</Etiquette>}
            />
          ))}
        </ListeLignes>
      )}

      {archive ? null : (
        <div className="mt-3">
          <NouvelleSeance cours={cours} chapitres={chapitres} chapitreParDefaut={chapitre} compact />
        </div>
      )}
    </section>
  );
}

/**
 * Suivi agrégé de la classe ou du groupe (PED-10) : par séance publiée,
 * jamais par élève. Sous cinq élèves concernés, le chiffre n'est pas affiché.
 * Les consultations ne sont pas comptées.
 */
function SuiviAgrege({ lignes }: { lignes: readonly StatistiqueSeance[] }) {
  const effectif = lignes[0]?.effectif ?? 0;
  const chiffre = (n: number | null) => (n === null ? <span className="meta">moins de 5</span> : n);
  return (
    <details className="chapitres-archives">
      <summary className="titre-section cursor-pointer">
        Suivi de la classe ou du groupe <span className="nombre">{effectif} élève{effectif > 1 ? "s" : ""}</span>
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="tableau-seance w-full">
          <caption className="meta text-left">Agrégats par séance publiée. Aucun résultat individuel, rien sous cinq élèves.</caption>
          <thead>
            <tr>
              <th scope="col">Séance</th>
              <th scope="col">Ont fait les exercices</th>
              <th scope="col">Réussite</th>
              <th scope="col">Passages non compris</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.lecon}>
                <th scope="row" className="font-semibold">{l.titre}</th>
                <td>{chiffre(l.eleves_exercices)}</td>
                <td>{l.eleves_exercices === null || l.reussite === null ? <span className="meta">—</span> : `${l.reussite} %`}</td>
                <td>{chiffre(l.incompris)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

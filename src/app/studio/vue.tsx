import { FilePen, FileText } from "lucide-react";
import { NouveauChapitre, NouvelleSeance } from "@/components/studio/Creation";
import { GestesChapitre } from "@/components/studio/GestesChapitre";
import { ChoixCours } from "@/components/studio/ChoixCours";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes } from "@/components/study/ui";
import type { chapitresDuCours, coursDuProfesseur, seancesDuCours } from "@/lib/studio";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueStudio({ cours, choisi, chapitres, seances, sansChapitre, brouillons, archives = [] }: {
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
      <EnTetePage
        sourcil="Mes cours"
        titre={choisi.libelle}
        sousTitre={`${seances.length} séance${seances.length > 1 ? "s" : ""}, dont ${brouillons} brouillon${brouillons > 1 ? "s" : ""}. Un brouillon reste invisible des élèves.`}
        actions={<NouvelleSeance cours={choisi.id} chapitres={chapitres} menu />}
      />

      {cours.length > 1 ? <ChoixCours cours={cours} choisi={choisi.id} /> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-8">
          {chapitres.length === 0 && seances.length === 0 ? (
            <EtatVide
              icone={FilePen}
              titre="Ce cours est encore vide."
              texte="Créez un premier chapitre — « Chapitre 1 — Suites », par exemple — puis ajoutez-y vos séances. Une séance reste un brouillon tant que vous ne l'avez pas publiée."
            />
          ) : null}

          {chapitres.map((chapitre, i) => (
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

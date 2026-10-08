import Link from "next/link";
import { FilePen, FileText } from "lucide-react";
import { NouveauChapitre, NouvelleSeance } from "@/components/studio/Creation";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes } from "@/components/study/ui";
import type { chapitresDuCours, coursDuProfesseur, seancesDuCours } from "@/lib/studio";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueStudio({ cours, choisi, chapitres, seances, sansChapitre, brouillons }: {
  cours: Awaited<ReturnType<typeof coursDuProfesseur>>;
  choisi: Awaited<ReturnType<typeof coursDuProfesseur>>[number];
  chapitres: Awaited<ReturnType<typeof chapitresDuCours>>;
  seances: Awaited<ReturnType<typeof seancesDuCours>>;
  sansChapitre: Awaited<ReturnType<typeof seancesDuCours>>;
  brouillons: number;
}) {
  return (
    <>
      <EnTetePage
        sourcil="Studio"
        titre={choisi.libelle}
        sousTitre={`${seances.length} séance${seances.length > 1 ? "s" : ""}, dont ${brouillons} brouillon${brouillons > 1 ? "s" : ""}. Un brouillon reste invisible des élèves.`}
        actions={<NouvelleSeance cours={choisi.id} chapitres={chapitres} />}
      />

      {cours.length > 1 ? (
        <nav aria-label="Mes cours" className="mb-6 flex flex-wrap gap-2">
          {cours.map((autre) => (
            <Link key={autre.id} href={`/studio?cours=${autre.id}`} aria-current={autre.id === choisi.id ? "page" : undefined} className="pilule">
              {autre.libelle}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-8">
          {chapitres.length === 0 && seances.length === 0 ? (
            <EtatVide
              icone={FilePen}
              titre="Ce cours est encore vide."
              texte="Créez un premier chapitre — « Chapitre 1 — Suites », par exemple — puis ajoutez-y vos séances. Une séance reste un brouillon tant que vous ne l'avez pas publiée."
            />
          ) : null}

          {chapitres.map((chapitre) => (
            <ListeChapitre
              key={chapitre.id}
              titre={chapitre.label}
              seances={seances.filter((seance) => seance.chapter_id === chapitre.id)}
              cours={choisi.id}
              chapitre={chapitre.id}
              chapitres={chapitres}
            />
          ))}

          {sansChapitre.length > 0 ? <ListeChapitre titre="Sans chapitre" seances={sansChapitre} cours={choisi.id} chapitre={null} chapitres={chapitres} /> : null}
        </div>

        <aside className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5 lg:sticky lg:top-24">
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
}: {
  titre: string;
  seances: { id: string; title: string; state: string; scheduled_for: string | null }[];
  cours: string;
  chapitre: string | null;
  chapitres: { id: string; label: string }[];
}) {
  return (
    <section aria-label={titre}>
      <h2 className="titre-section mb-3 flex items-center gap-2">
        {titre} <span className="nombre">{seances.length}</span>
      </h2>

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

      <div className="mt-3">
        <NouvelleSeance cours={cours} chapitres={chapitres} chapitreParDefaut={chapitre} compact />
      </div>
    </section>
  );
}

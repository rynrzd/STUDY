import Link from "next/link";
import { BookOpen, Presentation, UserRoundCheck } from "lucide-react";
import { AffecterPlusieurs } from "@/components/admin/AffecterPlusieurs";
import { TerminerAffectation } from "@/components/admin/TerminerAffectation";
import { TransfertCours } from "@/components/admin/TransfertCours";
import { DemandeEffacement } from "@/components/admin/GestesEleve";
import { EnTetePage, EtatVide, Etiquette, dateLisible } from "@/components/study/ui";
import type { FicheProfesseur } from "@/lib/etablissement";

type Option = { id: string; label: string };

const ROLES: Record<string, string> = { titulaire: "Titulaire", co_intervenant: "Co-intervenant", remplacant: "Remplaçant" };
const ETATS_COMPTE: Record<string, { texte: string; ton: "succes" | "attention" | "erreur" | "neutre" }> = {
  actif: { texte: "Actif", ton: "succes" },
  a_activer: { texte: "Jamais connecté", ton: "attention" },
  suspendu: { texte: "Suspendu", ton: "erreur" },
  sorti: { texte: "Sorti", ton: "neutre" },
  en_suppression: { texte: "Effacement demandé", ton: "erreur" },
};
const SECTIONS = [
  ["en_cours", "En cours"],
  ["a_venir", "À venir"],
  ["termine", "Terminées"],
  ["archive", "Années archivées"],
] as const;

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueFicheProfesseur({
  professeur,
  fiche,
  classes,
  groupes,
  matieres,
  collegues = [],
}: {
  /** Les autres professeurs, pour reprendre des cours (PROF-13). */
  collegues?: readonly Option[];
  professeur: string;
  fiche: FicheProfesseur;
  classes: readonly Option[];
  groupes: readonly Option[];
  matieres: readonly Option[];
}) {
  const { identite, affectations, principal_de } = fiche;
  const nom = `${identite.prenom} ${identite.nom}`;
  const etat = ETATS_COMPTE[identite.etat_compte] ?? { texte: identite.etat_compte, ton: "neutre" as const };
  const enCours = affectations.filter((a) => a.etat === "en_cours");
  const matieresEnseignees = [...new Set(enCours.map((a) => a.matiere))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/admin/utilisateurs", libelle: "Personnes" },
          { href: "/admin/professeurs", libelle: "Professeurs et cours" },
        ]}
        sourcil="Fiche professeur"
        titre={nom}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{identite.identifiant}</span>
            <Etiquette ton={etat.ton}>{etat.texte}</Etiquette>
            {identite.roles.includes("admin_etablissement") ? <Etiquette ton="rose">Administration</Etiquette> : null}
          </span>
        }
        actions={
          <>
            <Link href={`/admin/utilisateurs?q=${encodeURIComponent(identite.identifiant)}`} className="bouton bouton-secondaire">
              Gérer l&apos;accès
            </Link>
            <AffecterPlusieurs professeur={professeur} nom={nom} classes={classes} groupes={groupes} matieres={matieres} variante="primaire" existantes={affectations.filter((a) => a.etat === "en_cours" || a.etat === "a_venir").map((a) => `${a.cible}|${a.matiere}`)} />
          </>
        }
      />

      <section aria-label="En bref" className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="panneau p-4 md:p-4">
          <p className="meta m-0">Matières enseignées</p>
          <p className="m-0 mt-1 font-semibold">{matieresEnseignees.length > 0 ? matieresEnseignees.join(", ") : "Aucune pour l'instant"}</p>
        </div>
        <div className="panneau p-4 md:p-4">
          <p className="meta m-0">Cours en cours</p>
          <p className="m-0 mt-1 font-semibold">{enCours.length}</p>
        </div>
        <div className="panneau p-4 md:p-4">
          <p className="meta m-0 flex items-center gap-1.5">
            <UserRoundCheck size={14} strokeWidth={1.75} aria-hidden="true" /> Professeur principal
          </p>
          <p className="m-0 mt-1 font-semibold">
            {principal_de.length === 0
              ? "Non"
              : principal_de.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/admin/classes/${c.id}`}>{c.label}</Link>
                  </span>
                ))}
          </p>
        </div>
      </section>

      {enCours.length > 0 && collegues.length > 0 ? (
        <div className="mb-6">
          <TransfertCours nom={nom} cours={enCours.map((a) => ({ id: a.id, matiere: a.matiere, cible: a.cible, cible_id: a.cible_id, genre: a.genre, role: a.role }))} professeurs={collegues} />
        </div>
      ) : null}

      <div className="mb-6">
        <DemandeEffacement profil={professeur} retour={`/admin/professeurs/${professeur}`} enCours={identite.etat_compte === "en_suppression"} />
      </div>

      {affectations.length === 0 ? (
        <EtatVide
          icone={Presentation}
          titre="Aucun cours pour l'instant."
          texte="Ce compte existe, sans affectation : son espace reste vide tant qu'aucun cours ne lui est confié. Affectez-le avec le bouton en haut."
        />
      ) : (
        SECTIONS.map(([cle, titre]) => {
          const lignes = affectations.filter((a) => a.etat === cle);
          if (lignes.length === 0) return null;
          return (
            <section key={cle} className="mb-8" aria-label={titre}>
              <h2 className="titre-section mb-3 flex items-center gap-2">
                {titre} <span className="nombre">{lignes.length}</span>
              </h2>
              <ul className="m-0 grid list-none gap-2 p-0">
                {lignes.map((a) => (
                  <li key={a.id} className="ligne-cours-prof panneau flex flex-wrap items-center justify-between gap-3 p-4 md:p-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {a.matiere} ·{" "}
                          <Link href={a.genre === "classe" ? `/admin/classes/${a.cible_id}` : `/admin/groupes/${a.cible_id}`}>{a.cible}</Link>
                          {a.genre === "groupe" ? <span className="meta"> (groupe)</span> : null}
                        </span>
                        <span className="meta block">
                          {ROLES[a.role] ?? a.role} · {a.annee} · depuis le {dateLisible(a.debut)}
                          {a.fin ? ` · jusqu'au ${dateLisible(a.fin)}` : ""}
                        </span>
                      </span>
                    </span>
                    {a.etat === "en_cours" || a.etat === "a_venir" ? <TerminerAffectation affectation={a.id} libelle={`${a.matiere} — ${a.cible}`} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

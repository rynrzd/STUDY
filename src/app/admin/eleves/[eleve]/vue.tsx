import Link from "next/link";
import { BookOpen, History, KeyRound, Layers, LogOut, School } from "lucide-react";
import { GestesCompte } from "@/components/admin/GestesCompte";
import { ChangerClasse, DemandeEffacement, DepartEleve, PreinscriptionEleve } from "@/components/admin/GestesEleve";
import { EnTetePage, Etiquette, TuileIcone, dateLisible } from "@/components/study/ui";
import type { FicheEleve } from "@/lib/etablissement";

/** Vue de la fiche, rendue avec des données réelles (page.tsx) ou fictives (aperçu). */
export function VueFicheEleve({
  eleve,
  fiche,
  classes,
  codeEtablissement,
  anneeSuivante = null,
}: {
  /** Année préparée et ses classes, pour la préinscription individuelle (EL-08). */
  anneeSuivante?: { label: string; classes: readonly { id: string; label: string }[] } | null;
  eleve: string;
  fiche: FicheEleve;
  classes: readonly { id: string; label: string }[];
  codeEtablissement: string;
}) {
  const { identite } = fiche;
  const nom = `${identite.prenom} ${identite.nom}`;
  const groupesActifs = fiche.groupes.filter((g) => g.actif);
  const encorePresent = fiche.classe !== null || fiche.classe_a_venir !== null || groupesActifs.length > 0;
  const etat = identite.etat_compte === "actif" ? { ton: "succes" as const, texte: "Actif" } : identite.etat_compte === "a_activer" ? { ton: "attention" as const, texte: "À activer" } : identite.etat_compte === "en_suppression" ? { ton: "erreur" as const, texte: "Effacement demandé" } : { ton: "neutre" as const, texte: "Désactivé" };

  // Frise : inscriptions et groupes, du plus récent au plus ancien.
  const frise = [
    ...fiche.inscriptions.map((i) => ({ cle: `c-${i.classe}-${i.debut}`, titre: `Classe ${i.classe}`, detail: i.annee, debut: i.debut, fin: i.fin })),
    ...fiche.groupes.map((g) => ({ cle: `g-${g.id}-${g.debut}`, titre: `Groupe ${g.label}`, detail: g.kind === "interclasses" ? "Interclasses" : "Demi-groupe", debut: g.debut, fin: g.fin })),
  ].sort((a, b) => (a.debut < b.debut ? 1 : -1));

  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/admin/utilisateurs", libelle: "Personnes" },
          { href: "/admin/utilisateurs?etat=eleve", libelle: "Élèves" },
        ]}
        sourcil="Fiche élève"
        titre={nom}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{identite.identifiant}</span>
            <Etiquette ton={etat.ton}>{etat.texte}</Etiquette>
          </span>
        }
      />

      <div className="bento">
        <section aria-labelledby="classe" className="bento-carte lg-7 md-6">
          <h2 id="classe" className="bento-titre">
            <span className="flex items-center gap-2">
              <School size={18} strokeWidth={1.75} aria-hidden="true" /> Classe principale
            </span>
          </h2>
          {fiche.classe ? (
            <p className="m-0">
              <span className="text-[1.25rem] font-bold">{fiche.classe.label}</span>
              <span className="meta block">
                {fiche.classe.annee} · depuis le {dateLisible(fiche.classe.depuis)}
              </span>
            </p>
          ) : (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune classe aujourd&apos;hui.</p>
          )}
          {fiche.classe_a_venir ? (
            <p className="m-0 mt-2 text-[0.9375rem] text-[color:var(--color-accent)]">
              Passera en {fiche.classe_a_venir.label} le {dateLisible(fiche.classe_a_venir.depuis)}.
            </p>
          ) : null}
          <div className="mt-5 border-t border-[color:var(--bordure-douce,var(--color-bordure))] pt-4">
            <p className="m-0 mb-3 font-semibold">{fiche.classe ? "Changer de classe" : "Réintégrer dans une classe"}</p>
            <ChangerClasse eleve={eleve} classes={classes} actuelle={fiche.classe?.label ?? null} />
          </div>
          {anneeSuivante && anneeSuivante.classes.length > 0 ? (
            <div className="mt-5 border-t border-[color:var(--bordure-douce,var(--color-bordure))] pt-4">
              <p className="m-0 mb-3 font-semibold">L&apos;an prochain</p>
              <PreinscriptionEleve eleve={eleve} annee={anneeSuivante.label} classes={anneeSuivante.classes} actuelle={fiche.classe_a_venir?.label ?? null} />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="acces" className="bento-carte lg-5 md-6">
          <h2 id="acces" className="bento-titre">
            <span className="flex items-center gap-2">
              <KeyRound size={18} strokeWidth={1.75} aria-hidden="true" /> Accès
            </span>
          </h2>
          <p className="meta m-0 mb-3">Aucun mot de passe n&apos;est affiché ici. Réinitialiser imprime une nouvelle fiche d&apos;accès.</p>
          <GestesCompte
            profil={eleve}
            nom={identite.nom}
            prenom={identite.prenom}
            classe={fiche.classe?.label ?? null}
            professeur={false}
            actif={identite.etat_compte !== "suspendu" && identite.actif}
            codeEtablissement={codeEtablissement}
          />
          <DemandeEffacement profil={eleve} retour={`/admin/eleves/${eleve}`} enCours={identite.etat_compte === "en_suppression"} />
        </section>

        <section aria-labelledby="groupes" className="bento-carte lg-5 md-6">
          <h2 id="groupes" className="bento-titre">
            <span className="flex items-center gap-2">
              <Layers size={18} strokeWidth={1.75} aria-hidden="true" /> Groupes
            </span>
          </h2>
          {groupesActifs.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Dans aucun groupe aujourd&apos;hui.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {groupesActifs.map((g) => (
                <li key={g.id}>
                  <Link href={`/admin/groupes/${g.id}`} className="puce-cours no-underline">
                    <span className="font-semibold">{g.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="meta m-0 mt-3">Les groupes ne changent pas avec la classe : on les modifie depuis la fiche du groupe.</p>
        </section>

        <section aria-labelledby="cours" className="bento-carte lg-7 md-6">
          <h2 id="cours" className="bento-titre">
            <span className="flex items-center gap-2">
              <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" /> Cours visibles aujourd&apos;hui
            </span>
          </h2>
          {fiche.cours.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun cours : il ne verra aucune séance.</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {fiche.cours.map((c, i) => (
                <li key={`${c.matiere}-${c.cible}-${i}`} className="flex items-center gap-3">
                  <TuileIcone icone={c.genre === "groupe" ? Layers : School} />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {c.matiere} · {c.cible}
                    </span>
                    <span className="meta block">{c.professeurs ?? "Sans professeur"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="historique" className="bento-carte lg-6 md-6">
          <h2 id="historique" className="bento-titre">
            <span className="flex items-center gap-2">
              <History size={18} strokeWidth={1.75} aria-hidden="true" /> Historique
            </span>
          </h2>
          <ol className="frise">
            {frise.map((e) => (
              <li key={e.cle} data-actif={e.fin === null ? "" : undefined}>
                <span className="block font-semibold">{e.titre}</span>
                <span className="meta block">
                  {e.detail} · {e.fin === null ? `depuis le ${dateLisible(e.debut)}` : `du ${dateLisible(e.debut)} au ${dateLisible(e.fin)}`}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="depart" className="bento-carte lg-6 md-6">
          <h2 id="depart" className="bento-titre">
            <span className="flex items-center gap-2">
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" /> Départ de l&apos;établissement
            </span>
          </h2>
          {encorePresent ? (
            <DepartEleve eleve={eleve} nom={nom} />
          ) : (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Plus inscrit dans aucune classe ni aucun groupe.</p>
          )}
        </section>
      </div>
    </>
  );
}

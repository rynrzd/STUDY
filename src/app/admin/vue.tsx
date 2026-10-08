import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, GraduationCap, KeyRound, School, ShieldCheck, Upload, UserPlus, Users } from "lucide-react";
import { CarteChiffre, EnTetePage, Etiquette, ICONE, Ligne, ListeLignes, TuileIcone } from "@/components/study/ui";
import type { classes, contexte } from "@/lib/etablissement";
import type { historiqueImports } from "@/lib/lot-rentree";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAdmin({ situation, nbSignalements, nbRecuperations, eleves, enseignants, aActiver, sansProfesseur, listeClasses, imports }: {
  situation: NonNullable<Awaited<ReturnType<typeof contexte>>>;
  nbSignalements: number | null;
  nbRecuperations: number | null;
  eleves: readonly unknown[];
  enseignants: readonly unknown[];
  aActiver: readonly unknown[];
  sansProfesseur: readonly unknown[];
  listeClasses: Awaited<ReturnType<typeof classes>>;
  imports: Awaited<ReturnType<typeof historiqueImports>>;
}) {
  return (
    <>
      <EnTetePage
        sourcil={`Code ${situation.publicCode}${situation.anneeLabel === null ? "" : ` · année ${situation.anneeLabel}`}${situation.etat === "actif" ? "" : ` · ${situation.etat}`}`}
        titre={situation.organisation}
        sousTitre="Vue d'ensemble de l'établissement."
        actions={
          <>
            <Link href="/admin/professeurs" className="bouton bouton-secondaire">
              Professeurs
            </Link>
            <Link href="/admin/import" className="bouton bouton-primaire">
              <Upload {...ICONE} /> Import de rentrée
            </Link>
          </>
        }
      />

      <section aria-label="Chiffres de l'établissement" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteChiffre icone={Users} libelle="Élèves" valeur={eleves.length} detail={`${aActiver.length} compte${aActiver.length > 1 ? "s" : ""} à activer`} href="/admin/utilisateurs" />
        <CarteChiffre icone={School} libelle="Classes" valeur={listeClasses.length} detail="Groupes créés" href="/admin/classes" />
        <CarteChiffre icone={GraduationCap} libelle="Enseignants" valeur={enseignants.length} detail="Comptes enseignants" href="/admin/professeurs" />
        {/* Demandes en attente : compteurs réels ; « — » si la lecture est refusée (second facteur non validé). */}
        <div className="carte-chiffre">
          <TuileIcone icone={ShieldCheck} />
          <span className="font-bold">Demandes en attente</span>
          <Link href="/admin/moderation" className="flex min-h-[36px] items-center justify-between gap-2 text-[0.875rem] text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
            Modération <span className="flex items-center gap-1 font-bold">{nbSignalements ?? "—"} <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></span>
          </Link>
          <Link href="/admin/recuperation" className="flex min-h-[36px] items-center justify-between gap-2 text-[0.875rem] text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
            Récupération de compte <span className="flex items-center gap-1 font-bold">{nbRecuperations ?? "—"} <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></span>
          </Link>
        </div>
      </section>

      {listeClasses.length === 0 ? (
        <section className="mt-6 flex flex-wrap items-center gap-5 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6" aria-labelledby="demarrer">
          <TuileIcone icone={Building2} ton="neutre" grande />
          <div className="min-w-0 flex-1">
            <h2 id="demarrer" className="titre-bloc m-0 font-bold">
              Votre établissement est vide.
            </h2>
            <p className="m-0 mt-1 max-w-[62ch] text-[color:var(--color-encre-faible)]">
              Deux chemins : l&apos;import de rentrée crée les classes et les élèves à partir d&apos;un fichier, ou vous créez une classe à la main puis y ajoutez les comptes un par un.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/import" className="bouton bouton-primaire">
              Importer un fichier <ArrowRight {...ICONE} />
            </Link>
            <Link href="/admin/classes" className="bouton bouton-secondaire">
              Créer une classe
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="acces-rapides">
        <h2 id="acces-rapides" className="titre-section mb-3">
          Accès rapides
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/admin/import", titre: "Importer des élèves", detail: "Fichier CSV ou XLSX, aperçu avant écriture", Icone: Upload },
            { href: "/admin/professeurs", titre: "Ajouter des enseignants", detail: "Comptes et affectations", Icone: UserPlus },
            { href: "/admin/moderation", titre: "Modération", detail: "Signalements de l'établissement", Icone: ShieldCheck },
            { href: "/admin/recuperation", titre: "Récupération de compte", detail: "Vérifier l'identité, remettre un lien", Icone: KeyRound },
          ].map(({ href, titre, detail, Icone }) => (
            <li key={href}>
              <Link href={href} className="carte-chiffre min-h-0">
                <TuileIcone icone={Icone} />
                <span className="font-bold">{titre}</span>
                <span className="meta">{detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {listeClasses.length > 0 ? (
        <>
          {aActiver.length > 0 || sansProfesseur.length > 0 ? (
            <section className="mt-8" aria-labelledby="a-traiter">
              <h2 id="a-traiter" className="titre-section mb-3">
                À traiter
              </h2>
              <ListeLignes>
                {aActiver.length > 0 ? (
                  <Ligne
                    href="/admin/utilisateurs?etat=a_activer"
                    icone={KeyRound}
                    titre={`${aActiver.length} compte${aActiver.length > 1 ? "s" : ""} n'a jamais été activé`}
                    detail="Remettez la fiche d'accès à la personne concernée : elle choisira son mot de passe à la première connexion."
                  />
                ) : null}
                {sansProfesseur.length > 0 ? (
                  <Ligne
                    href="/admin/classes"
                    icone={GraduationCap}
                    titre={`${sansProfesseur.length} cours sans professeur`}
                    detail="Un cours sans professeur affecté n'apparaît dans aucun Studio : personne ne peut y publier de séance."
                  />
                ) : null}
              </ListeLignes>
            </section>
          ) : null}

          {imports.length > 0 ? (
            <section className="mt-8" aria-labelledby="imports">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 id="imports" className="titre-section">
                  Imports récents
                </h2>
                <Link href="/admin/import" className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
                  Tous les imports
                </Link>
              </div>
              <ListeLignes>
                {imports.slice(0, 5).map((lot) => {
                  const enAttente = lot.state !== "applique" && lot.state !== "abandonne";
                  const rate = (lot.rapport?.erreur ?? 0) > 0;
                  return (
                    <Ligne
                      key={lot.id}
                      href={lot.kind === "enseignants" ? `/admin/import/profs/${lot.id}` : `/admin/import/${lot.id}`}
                      icone={Upload}
                      titre={`${lot.kind === "enseignants" ? "Professeurs" : "Élèves"} · ${new Date(lot.applied_at ?? lot.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
                      detail={
                        enAttente
                          ? "Analysé, pas encore validé"
                          : `${lot.rapport?.cree ?? 0} créé${(lot.rapport?.cree ?? 0) > 1 ? "s" : ""}, ${lot.rapport?.existant ?? 0} déjà présent${(lot.rapport?.existant ?? 0) > 1 ? "s" : ""}`
                      }
                      fin={enAttente || rate ? <Etiquette ton={rate ? "erreur" : "attention"}>{rate ? `${lot.rapport?.erreur} en erreur` : "À terminer"}</Etiquette> : null}
                    />
                  );
                })}
              </ListeLignes>
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="classes">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="classes" className="titre-section flex items-center gap-2">
                Classes <span className="nombre">{listeClasses.length}</span>
              </h2>
              <Link href="/admin/classes" className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
                Gérer les classes
              </Link>
            </div>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {listeClasses.map((classe) => (
                <li key={classe.id} className="panneau flex items-center gap-3 p-4 md:p-4">
                  <TuileIcone icone={School} />
                  <span>
                    <span className="block font-semibold">{classe.label}</span>
                    <span className="meta block">
                      {classe.effectif} élève{classe.effectif > 1 ? "s" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );
}

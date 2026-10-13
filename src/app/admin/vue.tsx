import Link from "next/link";
import { ArrowRight, BookOpen, Building2, ChevronRight, CircleCheck, GraduationCap, KeyRound, Layers, Link2, Presentation, School, ShieldCheck, Upload, UserPlus, UserRoundCheck, Users } from "lucide-react";
import { AjouterPersonne } from "@/components/admin/AjouterPersonne";
import { FormulaireConservation } from "@/components/admin/Formulaires";
import { CarteChiffre, EnTetePage, Etiquette, ICONE, Ligne, ListeLignes, TuileIcone } from "@/components/study/ui";
import type { ControleComplement, ControleOuverture, classes, contexte } from "@/lib/etablissement";
import type { historiqueImports } from "@/lib/lot-rentree";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAdmin({ situation, nbSignalements, nbRecuperations, nbEleves, nbEnseignants, nbAActiver, sansProfesseur, listeClasses, imports, conservation = null, controle = null, complement = null, nbMatieres = null, nbAffectations = null, alertes = [], limites = null, effacements = [] }: {
  /** Demandes d'effacement en cours (SEC-18) : comptes fermés, en attente de décision. */
  effacements?: readonly { profil: string; prenom: string; nom: string; depuis: string | null }[];
  /** Activité inhabituelle sur 24 h (0082, SEC-20). */
  alertes?: readonly { alerte: string; nombre: number }[];
  /** Limites de l'établissement (0082, SEC-15). */
  limites?: { groupes_max: number; groupes: number } | null;
  /** Mise en route (ONB-02) : comptes réels, pour situer chaque étape. */
  nbMatieres?: number | null;
  nbAffectations?: number | null;
  /** Comptes suspendus, publications non autorisées (0080, ONB-05). */
  complement?: ControleComplement | null;
  /** Contrôle avant ouverture (0077, ONB-05) ; `null` : indisponible. */
  controle?: ControleOuverture | null;
  situation: NonNullable<Awaited<ReturnType<typeof contexte>>>;
  nbSignalements: number | null;
  nbRecuperations: number | null;
  /** Compteurs exacts, en base (0072) ; `null` : indisponibles, affichés « — ». */
  nbEleves: number | null;
  nbEnseignants: number | null;
  nbAActiver: number | null;
  sansProfesseur: readonly unknown[];
  listeClasses: Awaited<ReturnType<typeof classes>>;
  imports: Awaited<ReturnType<typeof historiqueImports>>;
  /** Durée de conservation du journal, en mois (0064). */
  conservation?: number | null;
}) {
  return (
    <>
      <EnTetePage
        sourcil={`Code ${situation.publicCode}${situation.anneeLabel === null ? "" : ` · année ${situation.anneeLabel}`}${situation.etat === "actif" ? "" : ` · ${situation.etat}`}`}
        titre={situation.organisation}
        sousTitre="Vue d'ensemble de l'établissement."
        actions={
          <>
            <Link href="/admin/import" className="bouton bouton-secondaire">
              <Upload {...ICONE} /> Import de rentrée
            </Link>
            <AjouterPersonne listeClasses={listeClasses.map((classe) => ({ id: classe.id, label: classe.label }))} />
          </>
        }
      />

      <section aria-label="Chiffres de l'établissement" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteChiffre icone={Users} libelle="Élèves" valeur={nbEleves ?? "—"} detail={nbAActiver === null ? "—" : `${nbAActiver} compte${nbAActiver > 1 ? "s" : ""} à activer`} href="/admin/utilisateurs" />
        <CarteChiffre icone={School} libelle="Classes" valeur={listeClasses.length} detail="Classes de l'année" href="/admin/classes" />
        <CarteChiffre icone={GraduationCap} libelle="Enseignants" valeur={nbEnseignants ?? "—"} detail="Comptes enseignants" href="/admin/professeurs" />
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

      {alertes.length > 0 || effacements.length > 0 || (limites !== null && limites.groupes >= limites.groupes_max * 0.8) ? (
        <section role="alert" aria-labelledby="vigilance" className="mt-6 rounded-[var(--radius-carte)] border border-[color:var(--color-attention)] bg-[color:var(--color-attention-fond)] p-5">
          <h2 id="vigilance" className="titre-section m-0">
            À surveiller
          </h2>
          <ul className="m-0 mt-2 grid gap-1 pl-5 text-[0.9375rem]">
            {alertes.map((a) => (
              <li key={a.alerte}>
                {a.alerte === "exports"
                  ? `${a.nombre} exports de listes nominatives en 24 h.`
                  : a.alerte === "reinitialisations"
                    ? `${a.nombre} réinitialisations d'accès en 24 h.`
                    : `${a.nombre} changements d'affectation en 24 h.`}{" "}
                Si ce n&apos;est pas vous ou votre équipe, changez votre mot de passe et prévenez votre interlocuteur AvecStudy.
              </li>
            ))}
            {effacements.length > 0 ? (
              <li>
                {effacements.length === 1 ? "Une demande d'effacement attend" : `${effacements.length} demandes d'effacement attendent`} la décision du responsable de traitement :{" "}
                {effacements.map((e) => `${e.prenom} ${e.nom}`).join(", ")}. Les comptes sont déjà fermés.
              </li>
            ) : null}
            {limites !== null && limites.groupes >= limites.groupes_max * 0.8 ? (
              <li>
                {limites.groupes} groupes sur {limites.groupes_max} autorisés : archivez ceux qui ne servent plus, ou demandez un relèvement.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <MiseEnRoute
        etapes={[
          { titre: "Année scolaire", detail: situation.anneeLabel ?? "à définir", fait: situation.anneeLabel !== null, href: "/admin/annees" },
          { titre: "Classes", detail: `${listeClasses.length} classe${listeClasses.length > 1 ? "s" : ""}`, fait: listeClasses.length > 0, href: "/admin/classes" },
          { titre: "Élèves", detail: nbEleves === null ? "—" : `${nbEleves} élève${nbEleves > 1 ? "s" : ""}`, fait: (nbEleves ?? 0) > 0, href: "/admin/import" },
          { titre: "Matières et groupes", detail: nbMatieres === null ? "—" : `${nbMatieres} matière${nbMatieres > 1 ? "s" : ""}`, fait: (nbMatieres ?? 0) > 0, href: "/admin/classes" },
          { titre: "Professeurs et cours", detail: nbAffectations === null ? "—" : `${nbEnseignants ?? 0} professeur(s), ${nbAffectations} cours`, fait: (nbEnseignants ?? 0) > 0 && (nbAffectations ?? 0) > 0, href: "/admin/professeurs" },
          {
            titre: "Vérification finale",
            detail: controle === null ? "à vérifier" : "voir « Avant d'ouvrir aux élèves »",
            fait:
              controle !== null &&
              controle.eleves_sans_classe.n === 0 &&
              controle.cours_sans_professeur.n === 0 &&
              controle.professeurs_sans_cours.n === 0 &&
              (complement === null || complement.publications_non_autorisees.n === 0) &&
              listeClasses.length > 0,
            href: "#avant-ouverture",
          },
        ]}
      />

      {listeClasses.length === 0 ? (
        <section className="mt-6 flex flex-wrap items-center gap-5 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6" aria-labelledby="demarrer">
          <TuileIcone icone={Building2} ton="neutre" grande />
          <div className="min-w-0 flex-1">
            <h2 id="demarrer" className="titre-bloc m-0 font-bold">
              Votre établissement est vide.
            </h2>
            <p className="m-0 mt-1 max-w-[62ch] text-[color:var(--color-encre-faible)]">
              Deux chemins : l&apos;import de rentrée crée les classes et les élèves à partir d&apos;un fichier, ou vous créez une classe puis ajoutez les élèves et les professeurs un par un.
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
          Que voulez-vous faire ?
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/admin/utilisateurs?ajouter=eleve", titre: "Ajouter un élève", detail: "Un compte, une fiche d'accès à imprimer", Icone: UserPlus },
            { href: "/admin/utilisateurs?ajouter=professeur", titre: "Ajouter un professeur", detail: "Puis l'affecter à une classe", Icone: Presentation },
            { href: "/admin/classes", titre: "Classes et cours", detail: "Classes, matières, affectations", Icone: Link2 },
            { href: "/admin/import", titre: "Import de rentrée", detail: "Toute une classe depuis un fichier CSV ou XLSX", Icone: Upload },
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
          <ControleAvantOuverture controle={controle} complement={complement} nbAActiver={nbAActiver} sansProfesseur={sansProfesseur.length} />

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
                <li key={classe.id}>
                  <Link href={`/admin/classes/${classe.id}`} className="panneau carte-souleve flex items-center gap-3 p-4 text-[color:var(--color-encre)] no-underline md:p-4">
                    <TuileIcone icone={School} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{classe.label}</span>
                      <span className="meta block">
                        {classe.effectif} élève{classe.effectif > 1 ? "s" : ""}
                      </span>
                    </span>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-encre-faible)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="mt-8" aria-label="Conservation du journal">
        <FormulaireConservation actuelle={conservation} />
      </section>
    </>
  );
}

/**
 * Avant d'ouvrir aux élèves — cahier des charges ch. 05 (ONB-05). Chaque point
 * vient d'un nombre calculé en base, nomme quelques exemples et mène à
 * l'écran où le régler. Ce qui est réglé disparaît ; quand tout l'est, on le
 * dit.
 */
function ControleAvantOuverture({ controle, complement = null, nbAActiver, sansProfesseur }: { controle: ControleOuverture | null; complement?: ControleComplement | null; nbAActiver: number | null; sansProfesseur: number }) {
  const exemples = (p: { exemples: readonly { nom: string }[]; n: number }) =>
    p.exemples.length === 0 ? "" : ` — ${p.exemples.map((e) => e.nom).join(", ")}${p.n > p.exemples.length ? "…" : ""}`;
  const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const points = controle === null
    ? [
        { n: nbAActiver ?? 0, href: "/admin/utilisateurs?etat=a_activer", icone: KeyRound, titre: pluriel(nbAActiver ?? 0, "compte jamais activé", "comptes jamais activés"), detail: "Remettez la fiche d'accès : la personne choisit son mot de passe à la première connexion." },
        { n: sansProfesseur, href: "/admin/classes#affecter", icone: GraduationCap, titre: pluriel(sansProfesseur, "cours sans professeur", "cours sans professeur"), detail: "Personne ne peut y publier tant qu'un professeur n'y est pas affecté." },
      ]
    : [
        { n: controle.eleves_sans_classe.n, href: "/admin/utilisateurs?etat=eleve", icone: Users, titre: pluriel(controle.eleves_sans_classe.n, "élève sans classe", "élèves sans classe"), detail: `Ils ne voient aucun cours${exemples(controle.eleves_sans_classe)}.` },
        { n: controle.cours_sans_professeur.n, href: "/admin/classes#affecter", icone: GraduationCap, titre: pluriel(controle.cours_sans_professeur.n, "cours sans professeur", "cours sans professeur"), detail: `Personne ne peut y publier${exemples(controle.cours_sans_professeur)}.` },
        { n: controle.professeurs_sans_cours.n, href: "/admin/professeurs", icone: Presentation, titre: pluriel(controle.professeurs_sans_cours.n, "professeur sans cours", "professeurs sans cours"), detail: `Leur espace reste vide${exemples(controle.professeurs_sans_cours)}.` },
        { n: controle.classes_sans_pp.n, href: "/admin/classes", icone: UserRoundCheck, titre: pluriel(controle.classes_sans_pp.n, "classe sans professeur principal", "classes sans professeur principal"), detail: `Codes de classe, délégués et consultations en dépendent${exemples(controle.classes_sans_pp)}.` },
        { n: controle.groupes_vides.n, href: "/admin/groupes", icone: Layers, titre: pluriel(controle.groupes_vides.n, "groupe vide", "groupes vides"), detail: `Ajoutez-y leurs élèves${exemples(controle.groupes_vides)}.` },
        { n: controle.matieres_non_enseignees.n, href: "/admin/classes#affecter", icone: BookOpen, titre: pluriel(controle.matieres_non_enseignees.n, "matière sans cours", "matières sans cours"), detail: `Créées mais enseignées nulle part${exemples(controle.matieres_non_enseignees)}.` },
        { n: nbAActiver ?? 0, href: "/admin/utilisateurs?etat=a_activer", icone: KeyRound, titre: pluriel(nbAActiver ?? 0, "compte jamais activé", "comptes jamais activés"), detail: "Remettez la fiche d'accès : la personne choisit son mot de passe à la première connexion." },
      ];
  if (complement !== null) {
    points.push(
      { n: complement.comptes_suspendus.n, href: "/admin/utilisateurs", icone: KeyRound, titre: pluriel(complement.comptes_suspendus.n, "compte suspendu", "comptes suspendus"), detail: `Ces personnes ne peuvent plus se connecter : est-ce voulu ?${exemples(complement.comptes_suspendus)}` },
      { n: complement.publications_non_autorisees.n, href: "/admin/professeurs", icone: ShieldCheck, titre: pluriel(complement.publications_non_autorisees.n, "séance publiée par un ancien professeur du cours", "séances publiées par d'anciens professeurs du cours"), detail: `Leur auteur n'enseigne plus ce cours : confiez-le à un professeur, qui décidera de les garder${exemples(complement.publications_non_autorisees)}.` },
    );
  }
  const restants = points.filter((x) => x.n > 0);
  return (
    <section className="mt-8" aria-labelledby="avant-ouverture">
      <h2 id="avant-ouverture" className="titre-section mb-3 flex items-center gap-2">
        Avant d&apos;ouvrir aux élèves {restants.length > 0 ? <span className="nombre">{restants.length}</span> : null}
      </h2>
      {controle === null ? (
        <p className="meta m-0 mb-3">Le contrôle complet est indisponible pour l&apos;instant ; voici ce qui a pu être compté.</p>
      ) : null}
      {restants.length === 0 ? (
        <p className="m-0 flex items-center gap-2 font-semibold text-[color:var(--color-succes)]">
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" /> Tout est en place : chaque élève a une classe, chaque cours un professeur.
        </p>
      ) : (
        <ListeLignes>
          {restants.map((x) => (
            <Ligne key={x.titre} href={x.href} icone={x.icone} titre={x.titre} detail={x.detail} />
          ))}
        </ListeLignes>
      )}
    </section>
  );
}

/**
 * Mise en route — cahier des charges ch. 05 (ONB-02) : six étapes, dans
 * l'ordre où elles dépendent l'une de l'autre. Chaque état est calculé sur
 * les données réelles : on reprend où l'on s'était arrêté, sans rien
 * mémoriser à part. Une fois tout fait, le panneau se résume à une ligne.
 */
function MiseEnRoute({ etapes }: { etapes: readonly { titre: string; detail: string; fait: boolean; href: string }[] }) {
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length) {
    // ONB-08 : le guide se revoit à volonté, sans rien effacer.
    return (
      <details className="mt-6">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[color:var(--color-succes)]">
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" /> Mise en route terminée : les six étapes sont faites. <span className="text-[0.875rem] text-[color:var(--color-accent)]">Revoir les étapes</span>
        </summary>
        <ol className="parcours mt-3" aria-label="Étapes de mise en route">
          {etapes.map((e, i) => (
            <li key={e.titre} data-fait="">
              <span className="parcours-numero" aria-hidden="true">{i + 1}</span>
              <span className="min-w-0">
                <Link href={e.href} className="block font-bold text-[color:var(--color-encre)] hover:text-[color:var(--color-accent)]">{e.titre}</Link>
                <span className="meta block">{e.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </details>
    );
  }
  const suivante = etapes.findIndex((e) => !e.fait);
  return (
    <section className="mt-6" aria-labelledby="mise-en-route">
      <h2 id="mise-en-route" className="titre-section mb-3 flex items-center gap-2">
        Mise en route <span className="nombre">{faites} / {etapes.length}</span>
      </h2>
      <ol className="parcours" aria-label="Étapes de mise en route">
        {etapes.map((e, i) => (
          <li key={e.titre} data-fait={e.fait ? "" : undefined} aria-current={i === suivante ? "step" : undefined}>
            <span className="parcours-numero" aria-hidden="true">
              {e.fait ? <CircleCheck size={18} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className="min-w-0">
              <Link href={e.href} className="block font-bold text-[color:var(--color-encre)] hover:text-[color:var(--color-accent)]">
                {e.titre}
              </Link>
              <span className="meta block">
                {e.detail} · <span className="font-semibold">{e.fait ? "fait" : i === suivante ? "à faire maintenant" : "à faire"}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

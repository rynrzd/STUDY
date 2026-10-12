import Link from "next/link";
import { Signalements } from "@/components/admin/Signalements";
import { Coque } from "@/components/study/Coque";
import { VueIntro } from "@/components/study/IntroConnexion";
import { EtapesImport } from "@/components/admin/EtapesImport";
import { VerificationRentree } from "@/components/admin/VerificationRentree";
import { EnTetePage } from "@/components/study/ui";
import type { ContexteApp } from "@/lib/v6/contexte";
import { Publication } from "@/components/studio/Publication";
import { VueClasses } from "@/app/admin/classes/vue";
import { VueGroupe } from "@/app/admin/groupes/[groupe]/vue";
import { VueGroupes } from "@/app/admin/groupes/vue";
import { VueProfesseurs } from "@/app/admin/professeurs/vue";
import { VueAdmin } from "@/app/admin/vue";
import { VueAnnees } from "@/app/admin/annees/vue";
import { VueRecuperation } from "@/app/admin/recuperation/vue";
import { VueUtilisateurs } from "@/app/admin/utilisateurs/vue";
import { VueAgenda } from "@/app/app/agenda/vue";
import ParcoursDebloqueApercu from "./debloque";
import { VueAteliers } from "@/app/app/ateliers/vue";
import { VueBienvenue } from "@/app/app/bienvenue/vue";
import { VueClasse } from "@/app/app/classes/[classe]/vue";
import { VueMembres } from "@/app/app/classes/[classe]/membres/vue";
import { FILTRES as FILTRES_PROPOSITIONS, VuePropositions } from "@/app/app/classes/[classe]/propositions/vue";
import { OngletsClasse } from "@/components/study/OngletsClasse";
import { VueUnCours } from "@/app/app/cours/[cours]/vue";
import { VueCours } from "@/app/app/cours/vue";
import { FormulaireFiche } from "@/app/app/fiches/nouvelle/FormulaireFiche";
import { VueDemandes } from "@/app/app/demandes/vue";
import { VueNouvelleDemande } from "@/app/app/demandes/nouvelle/vue";
import { VueCarnet } from "@/app/app/erreurs/vue";
import PageHorsLigne from "@/app/app/hors-ligne/page";
import { VueMessagerie } from "@/app/app/messagerie/vue";
import { VueOrientation } from "@/app/app/orientation/vue";
import { VueAteliersProf } from "@/app/app/prof/ateliers/vue";
import { AssistantAtelier } from "@/app/app/ateliers/AssistantAtelier";
import { VueProjets } from "@/app/app/projets/vue";
import { Recherche } from "@/app/app/recherche/Recherche";
import { VueReglages } from "@/app/app/reglages/vue";
import { VueReviser } from "@/app/app/reviser/vue";
import { VueAccueilProfesseur } from "@/app/professeur/vue";
import { VueStudioDocuments } from "@/app/professeur/studio/vue";
import { VueBanque } from "@/app/studio/exercices/vue";
import { VueStudio } from "@/app/studio/vue";
import { QuestionsDeLaSeance } from "@/components/study/QuestionsDeLaSeance";
import { VuePointsBloquants } from "@/components/study/PointsBloquants";
import { MesPassagesIncompris, PassagesIncomprisClasse } from "@/components/study/PassagesIncompris";
import { Editeur } from "@/components/studio/Editeur";
import { OngletsSeance } from "@/components/studio/OngletsSeance";
import { CircleHelp, ClipboardCheck, Library } from "lucide-react";
import { CONTEXTE_FICTIF } from "../fictif";
import { F, NOMS_FICTIFS } from "./donnees";

/**
 * Aperçu de développement des écrans recomposés (R2) : chaque écran est rendu
 * par la même vue que la page réelle, avec des données fictives
 * (`donnees.ts`). Jamais servi en production (`apercu/layout.tsx`).
 *   /apercu/ecrans?ecran=A01 … D05
 */

const ELEVE: ContexteApp = CONTEXTE_FICTIF;
const PROF: ContexteApp = {
  ...CONTEXTE_FICTIF,
  personne: { ...CONTEXTE_FICTIF.personne, prenom: "Claire", roles: ["professeur"] },
  roles: { eleve: false, professeur: true, admin: false, exploitant: false },
  contextes: [{ classe: F.classe, libelle: "Seconde 2", annee: "2026-2027", role: "professeur" }],
  classeActive: { classe: F.classe, libelle: "Seconde 2", annee: "2026-2027", role: "professeur" },
};
const ADMIN: ContexteApp = {
  ...CONTEXTE_FICTIF,
  personne: { ...CONTEXTE_FICTIF.personne, prenom: "Claire", roles: ["admin_etablissement"] },
  roles: { eleve: false, professeur: false, admin: true, exploitant: false },
  contextes: [],
  classeActive: null,
};

type Ecran = { titre: string; ctx: ContexteApp; chemin: string; rendu: () => React.ReactNode };

const lundi = new Date("2026-10-05T12:00:00Z");
const membresClasse = [...F.membres];

const ECRANS: Record<string, Ecran> = {
  A01: { titre: "Bienvenue", ctx: ELEVE, chemin: "/app", rendu: () => <VueBienvenue prenom="Camille" classe="Seconde 2" role="élève" matieres={["Mathématiques", "Français", "Histoire-géographie"]} nbDevoirs={2} /> },
  INTRO: {
    titre: "Intro de connexion",
    ctx: ELEVE,
    chemin: "/app",
    rendu: () => (
      <>
        <VueIntro />
        <VueBienvenue prenom="Camille" classe="Seconde 2" role="élève" matieres={["Mathématiques", "Français", "Histoire-géographie"]} nbDevoirs={2} />
      </>
    ),
  },
  A03: {
    titre: "Mes cours",
    ctx: ELEVE,
    chemin: "/app/cours",
    rendu: () => (
      <VueCours
        classes={[[F.classe, "Seconde 2"], ["g2", "Groupe Anglais B"]]}
        filtre={null}
        visibles={[F.cours, { ...F.cours, id: "c2", matiere: "Histoire-géographie", enseignants: "M. Fictif", chapitreCourant: "Thème 1" }, { ...F.cours, id: "c3", matiere: "Anglais", classe: "Groupe Anglais B", classId: "g2", enseignants: "Mme Exemple", chapitreCourant: null, seances: 0, dernierePublication: null }]}
        listeAteliers={[]}
      />
    ),
  },
  A08: {
    titre: "Fiche à la demande",
    ctx: ELEVE,
    chemin: "/app/reviser",
    rendu: () => (
      <div className="mx-auto max-w-[1100px]">
        <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]} sourcil="Fiche à la demande" titre="Créer une révision" sousTitre="Choisis tes sources : la fiche ne contiendra que des extraits de ces séances, cités." />
        <FormulaireFiche
          seances={[
            { id: "s1", titre: "Lire une image sur un graphique", cours: "Mathématiques", passages: 6, exercices: 2 },
            { id: "s2", titre: "La fonction carré", cours: "Mathématiques", passages: 4, exercices: 0 },
            { id: "s3", titre: "L'urbanisation", cours: "Histoire-géographie", passages: 0, exercices: 0 },
          ]}
          preselection={["s1", "s3"]}
          formatInitial="essentiel"
        />
      </div>
    ),
  },
  A04: { titre: "Un cours", ctx: ELEVE, chemin: "/app/cours", rendu: () => <VueUnCours id={F.cours.id} cours={F.cours} chapitres={[...F.chapitres]} nbSeances={3} requete={null} /> },
  A04q: {
    titre: "Séance · questions de la classe",
    ctx: ELEVE,
    chemin: "/app/cours",
    rendu: () => (
      <div className="mx-auto max-w-[760px]">
        <QuestionsDeLaSeance
          seance="s1"
          salonLien="/app/classes/c1/salons/m1"
          questions={[
            { id: "q1", href: "#", salon: "Mathématiques", texte: "Comment lire f(3) sur le graphique ?", auteur: "Lina B.", le: "2026-10-09T15:00:00Z", memeQuestion: 4, moiAussi: false, reponses: 2, reponseAdulte: { texte: "On part de 3 sur l'axe horizontal, on monte jusqu'à la droite, puis on lit la hauteur : 7.", auteur: "Mme Exemple", le: "2026-10-09T17:20:00Z" }, deMoi: false },
            { id: "q2", href: "#", salon: "Mathématiques", texte: "Est-ce qu'une fonction constante est affine ?", auteur: "Hugo F.", le: "2026-10-10T08:10:00Z", memeQuestion: 1, moiAussi: false, reponses: 0, reponseAdulte: null, deMoi: false },
          ]}
        />
      </div>
    ),
  },
  A04p: {
    titre: "Séance · passages pas compris",
    ctx: ELEVE,
    chemin: "/app/cours",
    rendu: () => (
      <div className="mx-auto grid max-w-[900px] gap-4 md:grid-cols-2">
        <MesPassagesIncompris
          seance="00000000-0000-4000-8000-000000000242"
          passages={[
            { id: "00000000-0000-4000-8000-000000000901", extrait: "Le coefficient directeur a indique de combien f(x) augmente quand x augmente de 1." },
            { id: "00000000-0000-4000-8000-000000000902", extrait: "Pour x = 3, f(3) = 7." },
          ]}
        />
        <PassagesIncomprisClasse
          passages={[
            { extrait: "Le coefficient directeur a indique de combien f(x) augmente quand x augmente de 1.", eleves: 6, dernier: "2026-10-10T18:00:00Z" },
            { extrait: "Pour x = 3, f(3) = 7.", eleves: 2, dernier: "2026-10-09T17:00:00Z" },
          ]}
        />
      </div>
    ),
  },
  A05: { titre: "Recherche", ctx: ELEVE, chemin: "/app/recherche", rendu: () => <Recherche initiale={{ q: "", types: [], classe: "" }} classes={[{ id: F.classe, libelle: "Seconde 2" }]} /> },
  A06: {
    titre: "Réviser",
    ctx: ELEVE,
    chemin: "/app/reviser",
    rendu: () => (
      <VueReviser
        fiches={[...F.fiches]}
        priorites={{ suggestions: [...F.suggestions], parametres: "" }}
        semaine={{ jours: [true, true, false, true, true, false, false], aujourdHui: 4, actifs: 4 }}
        progression={[
          {
            matiere: "Mathématiques",
            compte: { a_revoir: 1, en_cours: 1, a_decouvrir: 1, consolide: 2, inconnu: 0 },
            notions: [
              { id: "n1", notion: "Images et antécédents", statut: "a_revoir", libelleStatut: "À revoir", reussitesRecentes: 1, tentativesRecentes: 4, prochaineRevision: "2026-10-12", rappelsActifs: true },
              { id: "n2", notion: "Fonction carré", statut: "en_cours", libelleStatut: "En cours", reussitesRecentes: 2, tentativesRecentes: 3, prochaineRevision: "2026-10-14", rappelsActifs: true },
              { id: "n3", notion: "Fonction inverse", statut: "a_decouvrir", libelleStatut: "À découvrir", reussitesRecentes: 0, tentativesRecentes: 0, prochaineRevision: null, rappelsActifs: true },
              { id: "n4", notion: "Fonctions affines", statut: "consolide", libelleStatut: "Consolidée", reussitesRecentes: 5, tentativesRecentes: 5, prochaineRevision: null, rappelsActifs: true },
              { id: "n5", notion: "Vecteurs", statut: "consolide", libelleStatut: "Consolidée", reussitesRecentes: 3, tentativesRecentes: 3, prochaineRevision: null, rappelsActifs: true },
            ],
          },
          {
            matiere: "Anglais",
            compte: { a_revoir: 0, en_cours: 1, a_decouvrir: 0, consolide: 0, inconnu: 0 },
            notions: [{ id: "n6", notion: "Present perfect", statut: "en_cours", libelleStatut: "En cours", reussitesRecentes: 1, tentativesRecentes: 2, prochaineRevision: "2026-10-13", rappelsActifs: false }],
          },
        ]}
      />
    ),
  },
  A09: {
    titre: "Carnet d'erreurs",
    ctx: ELEVE,
    chemin: "/app/reviser",
    rendu: () => {
      const entrees = F.erreurs.map((e) => ({ ...e, choix: e.choix ? [...e.choix] : null }));
      return <VueCarnet archivesVues={false} entrees={entrees} error={null} parNotion={new Map<string, typeof entrees>(entrees.map((e) => [e.notion, [e]]))} />;
    },
  },
  A10: { titre: "Débloque-moi", ctx: ELEVE, chemin: "/app/reviser", rendu: () => <ParcoursDebloqueApercu /> },
  A11: {
    titre: "Ma classe",
    ctx: ELEVE,
    chemin: "/app/classe",
    rendu: () => (
      <>
      <OngletsClasse classe={F.classe} libelle="Seconde 2" delegues={false} gestion={false} />
      <VueClasse
        ouverte={F.consultation}
        classe={F.classe}
        droits={F.droitsEleve}
        suivies={[...F.decisions]}
        entraide={[...F.entraide]}
        delegues={membresClasse.filter((m) => m.role === "delegue")}
        principal={membresClasse.find((m) => m.role === "professeur_principal")}
      />
      </>
    ),
  },
  A13: {
    titre: "Membres (professeur principal)",
    ctx: PROF,
    chemin: "/app/classe",
    rendu: () => {
      const eleves = [
        { profileId: "m1", affichage: "Inès E.", initiales: "IE", role: "delegue" as const, etatCompte: "actif" },
        { profileId: "m2", affichage: "Hugo F.", initiales: "HF", role: "eleve" as const, etatCompte: "a_activer" },
      ];
      const equipe = [{ profileId: "m3", affichage: "Mme Exemple", initiales: "ME", role: "professeur_principal" as const, etatCompte: null }];
      return (
        <>
          <OngletsClasse classe={F.classe} libelle="Seconde 2" delegues gestion />
          <VueMembres
            classe={F.classe}
            responsable
            admin={false}
            demandes={[{ id: "d1", profile_id: "m4", prenom: "Léa", nom: "Exemple", demandee_le: "2026-10-07T08:00:00Z" }]}
            codeValide={{ id: "k1", expires_at: "2026-10-14T18:00:00Z", revoked_at: null, created_at: "2026-10-07T08:00:00Z" }}
            eleves={eleves}
            equipe={equipe}
            mandats={[{ id: "md1", profile_id: "m1", titre: "titulaire", starts_on: "2026-09-15", ends_on: "2027-07-04", revoked_at: null }]}
            liste={[...eleves, ...equipe]}
            invitationPar={new Map()}
            finAnnee="2027-07-04"
          />
        </>
      );
    },
  },
  A14: {
    titre: "Vie de classe",
    ctx: ELEVE,
    chemin: "/app/classe",
    rendu: () => (
      <>
        <OngletsClasse classe={F.classe} libelle="Seconde 2" delegues={false} gestion={false} />
        <VuePropositions
          classe={F.classe}
          vue="propositions"
          anime={false}
          liste={[...F.decisions]}
          ouverte={F.consultation}
          base={`/app/classes/${F.classe}/propositions`}
          filtreActif={FILTRES_PROPOSITIONS[0]}
          compte={(s) => (s ? F.decisions.filter((d) => s.includes(d.statut)).length : F.decisions.length)}
          visibles={[...F.decisions]}
          suivies={F.decisions.filter((d) => d.statut === "en_cours")}
          parDecision={new Map([[F.decisions[0].id, 3]])}
          evenements={[]}
          titres={new Map()}
        />
      </>
    ),
  },
  A12: { titre: "Messagerie", ctx: ELEVE, chemin: "/app/messagerie", rendu: () => <VueMessagerie salons={[...F.salons]} requete={null} /> },
  A15: {
    titre: "Projets",
    ctx: ELEVE,
    chemin: "/app/projets",
    rendu: () => (
      <VueProjets
        invitations={[F.projets[1]]}
        actifs={[F.projets[0], F.projets[2]]}
        classes={[{ id: F.classe, libelle: "Seconde 2" }]}
        participants={() => 3}
        etapeDe={() => "Rechercher des sources (12 oct.)"}
      />
    ),
  },
  A16: { titre: "Agenda", ctx: ELEVE, chemin: "/app/agenda", rendu: () => <VueAgenda debut={lundi} fin={new Date(lundi.getTime() + 7 * 86_400_000)} evenements={[...F.evenements]} cibles={[{ valeur: "moi", libelle: "Moi seulement" }]} /> },
  A17: {
    titre: "Orientation",
    ctx: ELEVE,
    chemin: "/app/projets",
    rendu: () => (
      <VueOrientation
        filtre="toutes"
        miennes={[...F.pistes]}
        intentions={F.pistes.filter((p) => p.kind === "intention")}
        autres={F.pistes.filter((p) => p.kind !== "intention")}
        recues={[]}
        adultes={[...F.destinataires]}
        lesPartages={[]}
        noms={NOMS_FICTIFS}
      />
    ),
  },
  A18: {
    titre: "Ateliers",
    ctx: ELEVE,
    chemin: "/app/ateliers",
    rendu: () => (
      <VueAteliers
        type={undefined}
        error={null}
        ateliers={[...F.ateliers]}
        filtres={[
          { cle: null, libelle: "Tous" },
          { cle: "actualite", libelle: "Actualité" },
          { cle: "verifier_ia", libelle: "Vérifier une réponse d'IA" },
        ]}
      />
    ),
  },
  A19: { titre: "Écrire à un adulte", ctx: ELEVE, chemin: "/app/demandes", rendu: () => <VueNouvelleDemande destinataires={[...F.destinataires]} lecon={undefined} sujetInitial={undefined} /> },
  A19b: { titre: "Demandes personnelles", ctx: ELEVE, chemin: "/app/demandes", rendu: () => <VueDemandes lignes={[...F.demandes]} noms={NOMS_FICTIFS} moi={CONTEXTE_FICTIF.personne.profileId} eleve /> },
  A20: { titre: "Réglages", ctx: ELEVE, chemin: "/app/reglages", rendu: () => <VueReglages onglet="compte" ctx={ELEVE} p={{}} initiales="CE" role="Élève" /> },
  A20b: { titre: "Réglages · affichage", ctx: ELEVE, chemin: "/app/reglages", rendu: () => <VueReglages onglet="affichage" ctx={ELEVE} p={{}} initiales="CE" role="Élève" /> },
  A20c: { titre: "Réglages · confidentialité", ctx: ELEVE, chemin: "/app/reglages", rendu: () => <VueReglages onglet="donnees" ctx={ELEVE} p={{}} initiales="CE" role="Élève" /> },
  A21: { titre: "Hors ligne", ctx: ELEVE, chemin: "/app/hors-ligne", rendu: () => <PageHorsLigne /> },
  T01: {
    titre: "Accueil professeur",
    ctx: PROF,
    chemin: "/professeur",
    rendu: () => (
      <VueAccueilProfesseur
        prenom="Claire"
        organisation="Lycée fictif"
        tableau={{ ...F.tableau, cartes: [...F.tableau.cartes] }}
        priorites={[
          { libelle: "Questions en attente", detail: "Questions d'élèves sans réponse dans vos salons", n: 2, href: "#questions", icone: CircleHelp },
          { libelle: "Copies à évaluer", detail: "Remises en attente de votre retour", n: 5, href: "/professeur/devoirs", icone: ClipboardCheck },
          { libelle: "Réponses aux ateliers", detail: "Réponses d'élèves des sept derniers jours", n: 3, href: "/app/prof/ateliers", icone: Library },
        ]}
        semaine={[...F.evenements]}
        questions={
          <VuePointsBloquants
            points={[
              { seance: "s1", titre: "Lire une image sur un graphique", questions: 3, sansReponse: 2, memeQuestion: 4, passagesIncompris: 2, elevesPassages: 3, exemple: "Pourquoi on part de l'axe horizontal ?", href: "/app/seances/s1?onglet=questions" },
              { seance: "s2", titre: "La fonction carré", questions: 1, sansReponse: 0, memeQuestion: 1, passagesIncompris: 0, elevesPassages: 0, exemple: "Le carré d'un négatif est positif ?", href: "/app/seances/s2?onglet=questions" },
            ]}
          />
        }
        aujourdhui={[F.seancesProf[0]]}
        libelles={new Map(F.coursProf.map((c) => [c.id, c.libelle]))}
        brouillons={F.seancesProf.filter((s) => s.state === "brouillon")}
        devoirsOuverts={[...F.devoirsProf]}
        publiees={F.seancesProf.filter((s) => s.state === "publiee")}
      />
    ),
  },
  T02: {
    titre: "Studio",
    ctx: PROF,
    chemin: "/studio",
    rendu: () => <VueStudio cours={[...F.coursProf]} choisi={F.coursProf[0]} chapitres={[...F.chapitresProf]} seances={[...F.seancesCours]} sansChapitre={[]} brouillons={1} />,
  },
  T02b: { titre: "Studio d'import", ctx: PROF, chemin: "/professeur/studio", rendu: () => <VueStudioDocuments documents={[...F.documents]} /> },
  T03: {
    titre: "Éditeur de séance",
    ctx: PROF,
    chemin: "/studio",
    rendu: () => (
      <>
        <OngletsSeance seance={F.seancesCours[1].id} titre="Mathématiques — Seconde 2" actif="contenu" />
        <Editeur
          seance={F.seancesCours[1]}
          blocs={[{ id: "b1", kind: "texte", position: 1, contenu: { texte: "La fonction inverse associe à tout réel x non nul le nombre 1/x." }, file_id: null, assignment_id: null }]}
          chapitres={[...F.chapitresProf]}
          libelleCours="Mathématiques — Seconde 2"
        />
      </>
    ),
  },
  T04: {
    titre: "Banque d'exercices",
    ctx: PROF,
    chemin: "/studio/exercices",
    rendu: () => (
      <VueBanque
        p={{ ex: F.exercices[0].version }}
        miens={false}
        total={2}
        exercices={[...F.exercices]}
        erreur={false}
        ouvert={F.exercices[0]}
        corrige={{ bonne_reponse: { index: 1 }, explication: "2 × 2 = 4.", indice: "Le carré d'un nombre, c'est ce nombre multiplié par lui-même.", exemple: null }}
        matieres={["Mathématiques"]}
        difficultes={[]}
        choixSeances={[{ id: F.seancesProf[1].id, libelle: "La fonction inverse — Mathématiques — Seconde 2 (brouillon)" }]}
      />
    ),
  },
  T06: {
    titre: "Publier dans plusieurs cours",
    ctx: PROF,
    chemin: "/professeur/studio/x/publication",
    rendu: () => (
      <div className="mx-auto max-w-[420px]">
        <Publication
          document="00000000-0000-4000-8000-000000000999"
          titre="Les suites numériques"
          cours={[
            { id: "00000000-0000-4000-8000-000000000901", matiere: "Mathématiques", cible: "Seconde 1", genre: "classe", effectif: 31, dejaPublie: false, versionAJour: false },
            { id: "00000000-0000-4000-8000-000000000902", matiere: "Mathématiques", cible: "Seconde 2", genre: "classe", effectif: 29, dejaPublie: true, versionAJour: true },
            { id: "00000000-0000-4000-8000-000000000903", matiere: "Mathématiques", cible: "Spé Maths A", genre: "groupe", effectif: 26, dejaPublie: true, versionAJour: false },
            { id: "00000000-0000-4000-8000-000000000904", matiere: "Mathématiques", cible: "Première 3", genre: "classe", effectif: 28, dejaPublie: false, versionAJour: false },
          ]}
        />
      </div>
    ),
  },
  T05: { titre: "Ateliers (professeur)", ctx: PROF, chemin: "/app/prof/ateliers", rendu: () => <VueAteliersProf liste={[...F.ateliersProf]} espaces={[{ id: F.coursProf[0].id, libelle: "Mathématiques — Seconde 2" }]} /> },
  T05b: {
    titre: "Éditeur d'atelier",
    ctx: PROF,
    chemin: "/app/prof/ateliers",
    rendu: () => (
      <div className="mx-auto max-w-[900px]">
        <EnTetePage filAriane={[{ href: "/app/prof/ateliers", libelle: "Ateliers" }]} sourcil="Éditeur d’atelier" titre="Nouvel atelier" sousTitre="Croiser une question, des documents datés et, si besoin, une réponse à vérifier." />
        <AssistantAtelier etape={1} espaces={[{ id: F.coursProf[0].id, libelle: "Mathématiques — Seconde 2" }]} donnees={{ id: null, kind: "actualite", titre: "", question: "", consigne: "", texte: "", sources: [], corrige: "", cours: null }} />
      </div>
    ),
  },
  D01: {
    titre: "Administration",
    ctx: ADMIN,
    chemin: "/admin",
    rendu: () => (
      <VueAdmin
        situation={F.situation}
        nbSignalements={2}
        nbRecuperations={2}
        eleves={[1, 2]}
        enseignants={[1]}
        aActiver={[1]}
        sansProfesseur={[]}
        listeClasses={[...F.classesEtab]}
        imports={F.imports.map((i) => ({ ...i, rapport: { ...i.rapport } }))}
        conservation={36}
      />
    ),
  },
  D02: {
    titre: "Personnes",
    ctx: ADMIN,
    chemin: "/admin/utilisateurs",
    rendu: () => (
      <VueUtilisateurs
        situation={F.situation}
        listeMembres={F.membresEtab.map((m) => ({ ...m, roles: [...m.roles] }))}
        listeClasses={[...F.classesEtab]}
        visibles={F.membresEtab.map((m) => ({ ...m, roles: [...m.roles] }))}
        filtre=""
        classeChoisie=""
        cherche=""
        adresseExport="/admin/acces"
        optionsClasses={F.classesEtab.map((c) => ({ id: c.id, label: c.label }))}
        moi="autre"
      />
    ),
  },
  D02b: {
    titre: "Import : vérifier",
    ctx: ADMIN,
    chemin: "/admin/import",
    rendu: () => (
      <>
        <p className="sourcil">Administration</p>
        <h1 className="titre-page m-0">Vérifier avant de créer</h1>
        <EtapesImport courante={2} />
        <div className="mt-8">
          <VerificationRentree
            codeEtablissement="FICTIF1"
            lot={{
              id: "lot1",
              etat: "analyse",
              fichiers: [{ jobId: "j1", nom: "eleves_rentree.csv", etat: "lu", classeDetectee: null, classeSource: "colonne", colonnes: [], correspondance: {}, erreur: null, lignes: 5 }],
              lignes: [
                { id: "l1", numero: 2, fichier: "eleves_rentree.csv", nom: "Exemple", prenom: "Inès", classe: "Seconde 2", email: null, identifiantExterne: null, etat: "valide", probleme: null },
                { id: "l2", numero: 3, fichier: "eleves_rentree.csv", nom: "Fictif", prenom: "Hugo", classe: "Seconde 2", email: null, identifiantExterne: null, etat: "valide", probleme: null },
                { id: "l3", numero: 4, fichier: "eleves_rentree.csv", nom: "Exemple", prenom: "Léa", classe: "", email: null, identifiantExterne: null, etat: "a_corriger", probleme: "Classe manquante" },
                { id: "l4", numero: 5, fichier: "eleves_rentree.csv", nom: "Fictif", prenom: "Hugo", classe: "Seconde 2", email: null, identifiantExterne: null, etat: "ignoree", probleme: null },
              ],
              classes: [{ nom: "Seconde 2", effectif: 2 }],
              compte: { fichiersLus: 1, fichiersRejetes: 0, lignesLues: 4, valides: 2, ignorees: 1, bloquantes: 1 },
              blocages: ["1 ligne à corriger avant de créer les comptes."],
              rapport: null,
            }}
          />
        </div>
      </>
    ),
  },
  D08: {
    titre: "Groupes",
    ctx: ADMIN,
    chemin: "/admin/groupes",
    rendu: () => <VueGroupes liste={[...F.groupesEtab]} />,
  },
  D09: {
    titre: "Fiche groupe",
    ctx: ADMIN,
    chemin: "/admin/groupes/x",
    rendu: () => (
      <VueGroupe
        groupe={F.groupesEtab[0]}
        membres={[...F.membresGroupe]}
        cours={[...F.coursGroupe]}
        eligibles={F.membresEtab.filter((m) => (m.roles as readonly string[]).includes("eleve")).map((m) => ({ profile_id: m.profile_id, prenom: m.prenom, nom: m.nom, classe: m.classe }))}
        professeurs={F.membresEtab.filter((m) => (m.roles as readonly string[]).includes("professeur")).map((m) => ({ id: m.profile_id, label: `${m.nom} ${m.prenom}` }))}
        matieres={[...F.matieresEtab]}
      />
    ),
  },
  D06: {
    titre: "Professeurs",
    ctx: ADMIN,
    chemin: "/admin/professeurs",
    rendu: () => {
      const parProfesseur = new Map<string, { matiere: string; classe: string }[]>();
      for (const lien of F.affectationsEtab) {
        if (lien.professeur_id === null) continue;
        parProfesseur.set(lien.professeur_id, [...(parProfesseur.get(lien.professeur_id) ?? []), { matiere: lien.matiere, classe: lien.classe }]);
      }
      const enseignants = F.membresEtab.filter((m) => (m.roles as readonly string[]).includes("professeur")).map((m) => ({ ...m, roles: [...m.roles] }));
      return (
        <VueProfesseurs
          situation={F.situation}
          enseignants={enseignants}
          total={enseignants.length}
          parProfesseur={parProfesseur}
          coursSansProfesseur={F.affectationsEtab.filter((lien) => lien.professeur_id === null)}
          cherche=""
          optionsClasses={F.classesEtab.map((c) => ({ id: c.id, label: c.label }))}
        />
      );
    },
  },
  D07: {
    titre: "Classes et cours",
    ctx: ADMIN,
    chemin: "/admin/classes",
    rendu: () => (
      <VueClasses
        listeClasses={[...F.classesEtab]}
        listeAffectations={[...F.affectationsEtab]}
        professeurs={F.membresEtab.filter((m) => (m.roles as readonly string[]).includes("professeur")).map((m) => ({ id: m.profile_id, label: `${m.nom} ${m.prenom}` }))}
        matieres={[...F.matieresEtab]}
      />
    ),
  },
  D03: { titre: "Récupérations", ctx: ADMIN, chemin: "/admin/recuperation", rendu: () => <VueRecuperation error={null} demandes={[...F.recuperations]} choisie={F.recuperations[0]} /> },
  D04: {
    titre: "Modération",
    ctx: ADMIN,
    chemin: "/admin/moderation",
    rendu: () => (
      <>
        <EnTetePage sourcil="Lycée fictif" titre="Modération" sousTitre="Traitez les contenus signalés par la communauté." />
        <Signalements signalements={[...F.signalements]} />
      </>
    ),
  },
  D05: {
    titre: "Années scolaires",
    ctx: ADMIN,
    chemin: "/admin/annees",
    rendu: () => (
      <VueAnnees
        etape={3}
        erreurAnnees={false}
        courante={F.annees[0]}
        cible={F.annees[1]}
        classesCourantes={[
          { id: F.classe, label: "Seconde 2", academic_year_id: F.annees[0].id },
          { id: "c2", label: "Première 3", academic_year_id: F.annees[0].id },
        ]}
        classesCible={[{ id: "c3", label: "Première 2", academic_year_id: F.annees[1].id }]}
        debutSuivant={2027}
        parClasse={new Map([[F.classe, 31]])}
        resume={{ annee_courante: "2026-2027", classes_courantes: 2, inscriptions_a_clore: 59, classes_cible: 1, inscriptions_cible: 0, eleves_sans_classe_cible: 2 }}
        eleves={[{ profile_id: "e1", prenom: "Hugo", nom: "Fictif", identifiant: "hugo.fictif", classe_actuelle: "Seconde 2" }]}
        liste={[...F.annees]}
      />
    ),
  },
};

export default async function ApercuEcrans({ searchParams }: { searchParams: Promise<{ ecran?: string }> }) {
  const { ecran } = await searchParams;
  const choisi = ecran ? ECRANS[ecran] : undefined;
  if (!choisi) {
    return (
      <main className="mx-auto max-w-[760px] p-8">
        <h1 className="titre-page">Écrans recomposés — aperçus</h1>
        <p className="meta">Données fictives. Introuvable en production.</p>
        <ul className="liste-r2 mt-4">
          {Object.entries(ECRANS).map(([id, e]) => (
            <li key={id}>
              <Link href={`/apercu/ecrans?ecran=${id}`} className="ligne-r2">
                <span className="font-bold">{id}</span> {e.titre}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <Coque ctx={{ ...choisi.ctx, chemin: choisi.chemin }}>
      <p className="meta m-0 mb-3">Aperçu de développement · {ecran} · données fictives</p>
      {choisi.rendu()}
    </Coque>
  );
}

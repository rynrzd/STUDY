import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { affectations, affectationsProfesseurs, classes, contexte, groupes, matieres, tousLesMembres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { type LigneCours, VueProfesseurs } from "./vue";

/** Aujourd'hui (AAAA-MM-JJ), lu une fois par requête, hors du rendu. */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export const metadata: Metadata = { title: "Professeurs" };

/**
 * Les professeurs et ce qu'ils enseignent — cahier V5, §9.
 *
 * L'écran répond à la question que pose un proviseur en septembre : qui
 * enseigne quoi, et à qui ? Chaque ligne montre les affectations réelles —
 * celles qui ouvrent un Studio — et non une matière déclarée. « Professeur de
 * mathématiques » ne dit rien de ce qui est accessible ; « Mathématiques en
 * 2DE1 et 2DE2 » le dit exactement.
 *
 * Un professeur sans affectation est signalé : son compte existe, mais il ne
 * voit aucune classe et ne peut rien publier. C'est l'erreur de rentrée la
 * plus fréquente, et la plus silencieuse.
 */
export const dynamic = "force-dynamic";

export default async function PageProfesseurs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; matiere?: string; cible?: string; role?: string; etat?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeMembres, listeAffectations, listeClasses, listeGroupes, listeMatieres, lignesAffectation] = await Promise.all([
    // Les professeurs seuls, sans plafond global (0072).
    tousLesMembres(personne.profileId, { role: "professeur" }),
    affectations(personne.profileId),
    classes(personne.profileId),
    groupes(personne.profileId),
    matieres(personne.profileId),
    affectationsProfesseurs(personne.profileId),
  ]);

  const parametres = await searchParams;
  const cherche = (parametres.q ?? "").trim();
  const recherche = cherche.toLowerCase();

  // Affectations en cours et à venir, classes ET groupes, avec rôle et dates.
  const jour = aujourdhui();
  const parProfesseur = new Map<string, LigneCours[]>();
  for (const a of lignesAffectation ?? []) {
    parProfesseur.set(a.profile_id, [
      ...(parProfesseur.get(a.profile_id) ?? []),
      { affectation: a.affectation, matiere: a.matiere, cible: a.cible, genre: a.genre, role: a.role, debut: a.debut, fin: a.fin, aVenir: a.debut > jour },
    ]);
  }

  // Plusieurs titulaires actifs sur un même cours : signalé, jamais corrigé
  // d'office (PROF-16).
  const noms = new Map(listeMembres.map((m) => [m.profile_id, `${m.prenom} ${m.nom}`]));
  const titulairesParCours = new Map<string, { cours: string; ids: string[] }>();
  for (const a of lignesAffectation ?? []) {
    if (a.role !== "titulaire" || a.debut > jour) continue;
    const e = titulairesParCours.get(a.teaching_space_id) ?? { cours: `${a.matiere} — ${a.cible}`, ids: [] };
    e.ids.push(a.profile_id);
    titulairesParCours.set(a.teaching_space_id, e);
  }
  const titulairesMultiples = [...titulairesParCours.values()]
    .filter((e) => e.ids.length > 1)
    .map((e) => ({ cours: e.cours, noms: e.ids.map((id) => noms.get(id) ?? "?").join(", ") }));

  // PROF-15 : nom ou identifiant, et matière, classe ou groupe, rôle, état du
  // compte. En GET : l'adresse garde la recherche.
  const filtres = {
    matiere: (parametres.matiere ?? "").slice(0, 80),
    cible: (parametres.cible ?? "").slice(0, 80),
    role: ["titulaire", "co_intervenant", "remplacant"].includes(parametres.role ?? "") ? (parametres.role as string) : "",
    etat: ["actif", "a_activer", "suspendu"].includes(parametres.etat ?? "") ? (parametres.etat as string) : "",
  };
  const enseignants = listeMembres
    .filter((membre) => membre.roles.includes("professeur"))
    .filter((membre) => {
      if (recherche === "") return true;
      return `${membre.nom} ${membre.prenom} ${membre.local_login}`
        .toLowerCase()
        .includes(recherche);
    })
    .filter((membre) => {
      const siennes = parProfesseur.get(membre.profile_id) ?? [];
      if (filtres.matiere && !siennes.some((l) => l.matiere === filtres.matiere)) return false;
      if (filtres.cible && !siennes.some((l) => l.cible === filtres.cible)) return false;
      if (filtres.role && !siennes.some((l) => l.role === filtres.role)) return false;
      if (filtres.etat && membre.account_state !== filtres.etat) return false;
      return true;
    });
  const lignesToutes = [...parProfesseur.values()].flat();
  const optionsFiltres = {
    matieres: [...new Set(lignesToutes.map((l) => l.matiere))].sort((x, y) => x.localeCompare(y, "fr")),
    cibles: [...new Set(lignesToutes.map((l) => l.cible))].sort((x, y) => x.localeCompare(y, "fr", { numeric: true })),
  };

  const coursSansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null);
  const total = listeMembres.filter((membre) => membre.roles.includes("professeur")).length;
  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));

  return (
    <VueProfesseurs
      situation={situation}
      enseignants={enseignants}
      total={total}
      parProfesseur={parProfesseur}
      titulairesMultiples={titulairesMultiples}
      coursSansProfesseur={coursSansProfesseur}
      cherche={cherche}
      filtres={filtres}
      optionsFiltres={optionsFiltres}
      optionsClasses={optionsClasses}
      optionsGroupes={listeGroupes.map((g) => ({ id: g.id, label: g.label }))}
      optionsMatieres={listeMatieres.map((m) => ({ id: m.id, label: m.label }))}
    />
  );
}

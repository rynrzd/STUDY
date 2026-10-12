import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { affectations, classes, contexte, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueProfesseurs } from "./vue";

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
  searchParams: Promise<{ q?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeMembres, listeAffectations, listeClasses] = await Promise.all([
    membres(personne.profileId),
    affectations(personne.profileId),
    classes(personne.profileId),
  ]);

  const parametres = await searchParams;
  const cherche = (parametres.q ?? "").trim();
  const recherche = cherche.toLowerCase();

  const parProfesseur = new Map<string, { matiere: string; classe: string }[]>();
  for (const lien of listeAffectations) {
    if (lien.professeur_id === null) continue;
    parProfesseur.set(lien.professeur_id, [
      ...(parProfesseur.get(lien.professeur_id) ?? []),
      { matiere: lien.matiere, classe: lien.classe },
    ]);
  }

  const enseignants = listeMembres
    .filter((membre) => membre.roles.includes("professeur"))
    .filter((membre) => {
      if (recherche === "") return true;
      return `${membre.nom} ${membre.prenom} ${membre.local_login}`
        .toLowerCase()
        .includes(recherche);
    });

  const coursSansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null);
  const total = listeMembres.filter((membre) => membre.roles.includes("professeur")).length;
  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));

  return (
    <VueProfesseurs
      situation={situation}
      enseignants={enseignants}
      total={total}
      parProfesseur={parProfesseur}
      coursSansProfesseur={coursSansProfesseur}
      cherche={cherche}
      optionsClasses={optionsClasses}
    />
  );
}

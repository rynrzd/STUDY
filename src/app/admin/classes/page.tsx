import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { affectations, classes, contexte, matieres, professeursPrincipaux, tousLesMembres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueClasses } from "./vue";

export const metadata: Metadata = { title: "Classes et cours" };

/**
 * Classes, matières et affectations — cahier V2, §14.2.
 *
 * Les trois vivent sur le même écran parce qu'elles n'ont de sens qu'ensemble :
 * une classe sans matière ni professeur ne produit aucun cours, et l'ordre des
 * gestes (créer la classe, créer la matière, affecter) se lit de haut en bas.
 */
export const dynamic = "force-dynamic";

export default async function PageAdminClasses() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeClasses, listeMatieres, listeMembres, listeAffectations, listePrincipaux] = await Promise.all([
    classes(personne.profileId),
    matieres(personne.profileId),
    tousLesMembres(personne.profileId, { role: "professeur" }),
    affectations(personne.profileId),
    professeursPrincipaux(personne.profileId),
  ]);
  const principaux = Object.fromEntries((listePrincipaux ?? []).map((p) => [p.classe, { id: p.profil, nom: `${p.prenom} ${p.nom}` }]));

  const professeurs = listeMembres
    .filter((membre) => membre.roles.includes("professeur"))
    .map((membre) => ({ id: membre.profile_id, label: `${membre.nom} ${membre.prenom}` }));

  const optionsMatieres = listeMatieres.map((matiere) => ({ id: matiere.id, label: matiere.label }));

  return <VueClasses listeClasses={listeClasses} listeAffectations={listeAffectations} professeurs={professeurs} matieres={optionsMatieres} principaux={principaux} />;
}

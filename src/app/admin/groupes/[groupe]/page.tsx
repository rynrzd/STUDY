import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { classes, contexte, coordinateurGroupe, groupeCours, groupeDescription, groupeMembres, groupes, matieres, rechercherMembres, tousLesMembres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueGroupe } from "./vue";

export const metadata: Metadata = { title: "Groupe" };

/**
 * Fiche d'un groupe — cahier des charges, ch. 07.
 *
 * Les élèves éligibles à l'ajout sont les élèves de l'établissement qui ne sont
 * pas déjà membres actifs. La base revérifie de toute façon chaque ajout.
 */
export const dynamic = "force-dynamic";

export default async function PageGroupe({ params }: { params: Promise<{ groupe: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const { groupe: id } = await params;
  const acteur = personne.profileId;

  const [liste, listeMembres, listeCours, listeMatieres, premiersEleves, listeProfesseurs, listeClasses, description, coordinateur] = await Promise.all([
    groupes(acteur),
    groupeMembres(acteur, id),
    groupeCours(acteur, id),
    matieres(acteur),
    // Première page du sélecteur ; la suite se cherche en base (0072).
    rechercherMembres(acteur, { role: "eleve", limite: 80 }),
    tousLesMembres(acteur, { role: "professeur" }),
    classes(acteur),
    groupeDescription(acteur, id),
    coordinateurGroupe(acteur, id),
  ]);

  const groupe = liste.find((g) => g.id === id);
  if (groupe === undefined) notFound();

  const dejaMembre = new Set(listeMembres.map((m) => m.profile_id));
  const eligibles = (premiersEleves?.lignes ?? [])
    .filter((m) => !dejaMembre.has(m.profile_id))
    .slice(0, 50)
    .map((m) => ({ profile_id: m.profile_id, prenom: m.prenom, nom: m.nom, classe: m.classe }));
  const plus = (premiersEleves?.total ?? 0) > (premiersEleves?.lignes.length ?? 0);

  const professeurs = listeProfesseurs.map((m) => ({ id: m.profile_id, label: `${m.nom} ${m.prenom}` }));
  const optionsMatieres = listeMatieres.map((s) => ({ id: s.id, label: s.label }));

  return (
    <VueGroupe
      groupe={groupe}
      membres={listeMembres}
      cours={listeCours}
      eligibles={eligibles}
      plus={plus}
      classes={listeClasses.map((c) => c.label)}
      professeurs={professeurs}
      matieres={optionsMatieres}
      description={description}
      coordinateur={coordinateur}
    />
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { contexte, groupeCours, groupeMembres, groupes, matieres, membres } from "@/lib/etablissement";
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

  const [liste, listeMembres, listeCours, listeMatieres, listeMembresEtab] = await Promise.all([
    groupes(acteur),
    groupeMembres(acteur, id),
    groupeCours(acteur, id),
    matieres(acteur),
    membres(acteur),
  ]);

  const groupe = liste.find((g) => g.id === id);
  if (groupe === undefined) notFound();

  const dejaMembre = new Set(listeMembres.map((m) => m.profile_id));
  const eligibles = listeMembresEtab
    .filter((m) => m.roles.includes("eleve") && !dejaMembre.has(m.profile_id))
    .map((m) => ({ profile_id: m.profile_id, prenom: m.prenom, nom: m.nom, classe: m.classe }));

  const professeurs = listeMembresEtab
    .filter((m) => m.roles.includes("professeur"))
    .map((m) => ({ id: m.profile_id, label: `${m.nom} ${m.prenom}` }));
  const optionsMatieres = listeMatieres.map((s) => ({ id: s.id, label: s.label }));

  return (
    <VueGroupe
      groupe={groupe}
      membres={listeMembres}
      cours={listeCours}
      eligibles={eligibles}
      professeurs={professeurs}
      matieres={optionsMatieres}
    />
  );
}

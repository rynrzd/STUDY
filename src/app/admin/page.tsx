import { redirect } from "next/navigation";
import { affectations, classes, comptesMembres, conservationJournal, contexte } from "@/lib/etablissement";
import { historiqueImports } from "@/lib/lot-rentree";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { Building2 } from "lucide-react";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { VueAdmin } from "./vue";

/**
 * D01 — Administration, vue d'ensemble (maquette R2 n° 4). Aucun chiffre
 * décoratif : tout ce qui est affiché est compté en base au moment du rendu,
 * et « — » remplace un compteur que la base refuse (second facteur non
 * validé). Une page d'administration qui affiche un total approximatif fait
 * douter de tout le reste — et c'est cette page qu'un proviseur regarde
 * avant de signer.
 */
export const dynamic = "force-dynamic";

export default async function PageAdmin() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) {
    return (
      <>
        <EnTetePage sourcil="Administration" titre="Établissement indisponible" />
        <EtatVide
          icone={Building2}
          titre="Votre compte n'administre aucun établissement actif."
          texte="Si votre établissement vient d'être créé, il est peut-être encore à l'état « préparation ». Votre interlocuteur AvecStudy peut l'activer."
        />
      </>
    );
  }

  const jeton = await jetonAccesDe(personne);
  const client = jeton ? clientUtilisateur(jeton) : null;
  const [listeClasses, comptes, listeAffectations, imports, signalementsOuverts, recuperations, conservation] = await Promise.all([
    classes(personne.profileId),
    comptesMembres(personne.profileId),
    affectations(personne.profileId),
    historiqueImports(personne.profileId),
    // Compteurs réels, sous le jeton de l'administrateur (second facteur exigé par la base).
    client ? client.from("reports").select("id", { count: "exact", head: true }).in("state", ["ouvert", "en_examen"]) : null,
    client ? client.rpc("recuperation_a_traiter") : null,
    conservationJournal(personne.profileId),
  ]);
  const nbSignalements = signalementsOuverts?.error ? null : (signalementsOuverts?.count ?? null);
  const nbRecuperations = recuperations?.error ? null : ((recuperations?.data ?? []) as unknown[]).length;

  const sansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null);

  return <VueAdmin situation={situation} nbSignalements={nbSignalements} nbRecuperations={nbRecuperations} nbEleves={comptes?.eleves ?? null} nbEnseignants={comptes?.professeurs ?? null} nbAActiver={comptes?.a_activer ?? null} sansProfesseur={sansProfesseur} listeClasses={listeClasses} imports={imports} conservation={conservation} />;
}

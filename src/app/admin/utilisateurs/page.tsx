import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { classes, contexte, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueUtilisateurs } from "./vue";

export const metadata: Metadata = { title: "Utilisateurs" };

/**
 * Utilisateurs de l'établissement — cahier V2 §14.3, cahier V5 §7.3 et §9.
 *
 * Tout l'état de l'écran est dans l'adresse : le filtre, la classe, la
 * recherche. « Les comptes à activer en Seconde 4 » est donc un lien qu'on
 * envoie à un collègue, et la page fonctionne sans JavaScript.
 *
 * Aucun mot de passe n'apparaît ici, même masqué. Ils n'existent que le temps
 * d'une création ou d'une réinitialisation, sur la fiche imprimable — et le
 * §7.3 interdit explicitement d'afficher « le mot de passe actuel », que le
 * produit serait de toute façon incapable de retrouver.
 */
export const dynamic = "force-dynamic";

export default async function PageUtilisateurs({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; classe?: string; q?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeMembres, listeClasses] = await Promise.all([
    membres(personne.profileId),
    classes(personne.profileId),
  ]);

  const parametres = await searchParams;
  const filtre = parametres.etat ?? "";
  const classeChoisie = parametres.classe ?? "";
  const cherche = parametres.q ?? "";
  const recherche = cherche.trim().toLowerCase();

  const visibles = listeMembres.filter((membre) => {
    if (filtre === "eleve" && !membre.roles.includes("eleve")) return false;
    if (filtre === "professeur" && !membre.roles.includes("professeur")) return false;
    if (filtre === "a_activer" && membre.account_state !== "a_activer") return false;
    if (classeChoisie !== "" && membre.classe !== classeChoisie) return false;

    // La recherche porte sur ce qu'un secrétariat a sous les yeux : un nom
    // entendu au téléphone, ou un identifiant lu sur une fiche (§9).
    if (recherche === "") return true;
    return [membre.nom, membre.prenom, membre.local_login]
      .join(" ")
      .toLowerCase()
      .includes(recherche);
  });

  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));
  const classeExportee = listeClasses.find((classe) => classe.label === classeChoisie)?.id ?? null;
  const adresseExport =
    classeExportee === null ? "/admin/acces" : `/admin/acces?classe=${classeExportee}`;

  const moi = personne.profileId;
  return <VueUtilisateurs situation={situation} listeMembres={listeMembres} listeClasses={listeClasses} visibles={visibles} filtre={filtre} classeChoisie={classeChoisie} cherche={cherche} adresseExport={adresseExport} optionsClasses={optionsClasses} moi={moi} />;
}

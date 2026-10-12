import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { classes, comptesMembres, contexte, rechercherMembres } from "@/lib/etablissement";
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

const PAR_PAGE = 50;

export default async function PageUtilisateurs({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; classe?: string; q?: string; ajouter?: string; page?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const parametres = await searchParams;
  const filtre = parametres.etat ?? "";
  const classeChoisie = parametres.classe ?? "";
  const cherche = (parametres.q ?? "").slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(parametres.page ?? "1", 10) || 1));

  // Recherche, filtres et pagination en base (0072) : la liste ne charge
  // jamais tout l'établissement, et personne n'en disparaît au-delà d'un
  // plafond. La recherche ignore accents et majuscules.
  const [resultat, comptes, listeClasses] = await Promise.all([
    rechercherMembres(personne.profileId, {
      texte: cherche,
      role: filtre === "eleve" || filtre === "professeur" ? filtre : undefined,
      etat: filtre === "a_activer" ? "a_activer" : undefined,
      classe: classeChoisie,
      limite: PAR_PAGE,
      decalage: (page - 1) * PAR_PAGE,
    }),
    comptesMembres(personne.profileId, cherche, classeChoisie),
    classes(personne.profileId),
  ]);

  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));
  const classeExportee = listeClasses.find((classe) => classe.label === classeChoisie)?.id ?? null;
  const adresseExport =
    classeExportee === null ? "/admin/acces" : `/admin/acces?classe=${classeExportee}`;

  const ajouter = parametres.ajouter === "eleve" || parametres.ajouter === "professeur" ? parametres.ajouter : null;
  const moi = personne.profileId;
  return (
    <VueUtilisateurs
      ajouter={ajouter}
      situation={situation}
      comptes={comptes}
      listeClasses={listeClasses}
      visibles={resultat?.lignes ?? []}
      total={resultat?.total ?? 0}
      lectureEchouee={resultat === null}
      page={page}
      parPage={PAR_PAGE}
      filtre={filtre}
      classeChoisie={classeChoisie}
      cherche={cherche}
      adresseExport={adresseExport}
      optionsClasses={optionsClasses}
      moi={moi}
    />
  );
}

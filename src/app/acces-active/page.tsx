import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CocheFin } from "@/components/study/CocheFin";
import { CadreConnexion } from "@/components/study/connexion/CadreConnexion";
import { pagePrivee } from "@/lib/metadonnees";
import { destinationApresConnexion, estEleve, estEnseignant, jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { versConnexion } from "@/lib/v6/redirection";

export const metadata: Metadata = pagePrivee({ titre: "Accès activé", description: "Confirmation de l'activation." });
export const dynamic = "force-dynamic";

/**
 * Confirmation après une invitation : l'accès est activé et la session
 * ouverte. On dit où la personne va arriver — y compris quand une
 * appartenance de classe est encore en attente : rien n'est promis que les
 * affectations vérifiées ne donnent.
 */
export default async function PageAccesActive() {
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/app"));
  if (personne.activationRequise) redirect("/activation");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/app", "expiree"));

  const { data } = await clientUtilisateur(jeton).rpc("mes_contextes");
  const classes = ((data ?? []) as { libelle: string }[]).map((c) => c.libelle);
  const enAttente = estEleve(personne) && !estEnseignant(personne) && classes.length === 0;

  return (
    <CadreConnexion titre="Ton accès est activé" sousTitre={personne.organisation ?? undefined}>
      <CocheFin />
      <p className="m-0 mt-4 text-center text-[1.0625rem]">
        Bonjour {personne.prenom}. Retiens ton identifiant et ton mot de passe : ils te serviront à chaque connexion.
      </p>
      {enAttente ? (
        <p role="status" className="m-0 mt-5 rounded-[12px] bg-[color:var(--color-attention-fond)] p-4 text-[0.9375rem] text-[color:var(--color-attention)]">
          Ton compte est prêt, mais aucune classe n&apos;y est encore associée. Ton établissement doit valider ton appartenance ;
          tu peux aussi saisir un code de classe donné par un professeur.
        </p>
      ) : classes.length > 0 ? (
        <p className="meta m-0 mt-5 text-center">Classes : {classes.join(", ")}</p>
      ) : null}
      <Link href={enAttente ? "/acces-en-attente" : destinationApresConnexion(personne)} className="bouton bouton-primaire bouton-acces mt-6 w-full">
        Accéder à mon espace
      </Link>
    </CadreConnexion>
  );
}

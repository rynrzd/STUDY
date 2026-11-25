import type { Metadata } from "next";
import Link from "next/link";
import { DepotSupabaseDirect } from "@/lib/depot-authentification";
import { sessionCourante } from "@/lib/session-serveur";
import { CadreAccesPublic as CadreConnexion } from "@/components/site/CadreAccesPublic";
import { pagePrivee } from "@/lib/metadonnees";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";
import { empreinteInvitation, FORME_JETON } from "@/lib/v6/invitations";
import { VueInvitation, type Etat } from "./VueInvitation";

export const metadata: Metadata = pagePrivee({ titre: "Invitation", description: "Activer son compte avec une invitation." });
export const dynamic = "force-dynamic";

/**
 * Invitation — première connexion, ou nouveau mot de passe remis par
 * l'établissement après une demande de récupération.
 *
 * États distincts (0058) : valide (compte à activer / compte déjà actif),
 * expirée, révoquée, déjà utilisée, compte ou établissement indisponible,
 * inconnue. Un lien non valable ne révèle rien du compte.
 *
 * Adresse inchangée (`/invitation/<jeton>`) : les liens déjà remis
 * fonctionnent tels quels.
 */
export default async function PageInvitation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (!baseConfiguree()) {
    return (
      <CadreConnexion titre="Service momentanément indisponible">
        <p className="m-0">Ton lien reste valable. Réessaie dans quelques minutes.</p>
      </CadreConnexion>
    );
  }

  let etat: (Etat & { profile_id?: string }) | undefined;
  if (FORME_JETON.test(jeton)) {
    const { data, error } = await clientExploitation("invitation_et_recuperation").rpc("invitation_etat", { p_empreinte: empreinteInvitation(jeton) });
    if (error !== null) {
      return (
        <CadreConnexion titre="Service momentanément indisponible">
          <p className="m-0">Ton lien reste valable. Réessaie dans quelques minutes.</p>
        </CadreConnexion>
      );
    }
    etat = ((data ?? []) as (Etat & { profile_id?: string })[])[0];
  }

  if (etat?.etat === "valide") {
    const personne = await sessionCourante();
    if (personne && personne.profileId !== etat.profile_id) {
      return (
        <CadreConnexion titre="Un compte est déjà ouvert">
          <p>Déconnecte-toi, puis rouvre le lien que ton professeur t’a remis.</p>
          <Link className="bouton bouton-secondaire mt-4" href="/connexion?changer=1">Changer de compte</Link>
        </CadreConnexion>
      );
    }
    const direct = etat.identifiant ? await new DepotSupabaseDirect().resoudreIdentifiant("", etat.identifiant) : null;
    return <VueInvitation jeton={jeton} etat={etat} connexionDirecte={!!direct && direct.profileId === etat.profile_id} />;
  }
  return <VueInvitation jeton={jeton} etat={etat} />;
}

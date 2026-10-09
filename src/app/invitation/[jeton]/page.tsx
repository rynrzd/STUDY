import type { Metadata } from "next";
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

  let etat: Etat | undefined;
  if (FORME_JETON.test(jeton)) {
    const { data, error } = await clientExploitation("invitation_et_recuperation").rpc("invitation_etat", { p_empreinte: empreinteInvitation(jeton) });
    if (error !== null) {
      return (
        <CadreConnexion titre="Service momentanément indisponible">
          <p className="m-0">Ton lien reste valable. Réessaie dans quelques minutes.</p>
        </CadreConnexion>
      );
    }
    etat = ((data ?? []) as Etat[])[0];
  }

  return <VueInvitation jeton={jeton} etat={etat} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SecondFacteur } from "@/components/site/SecondFacteur";
import { pagePrivee } from "@/lib/metadonnees";
import {
  etapeSecondFacteur,
  facteurVerifieDe,
  preparerEnrolement,
} from "@/lib/second-facteur";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = pagePrivee({
  titre: "Second facteur",
  description: "Vérification en deux étapes des comptes d'administration.",
});

/**
 * Le second facteur — cahier V5, §1.
 *
 * Cette page n'est pas atteignable par choix : on y est envoyé. Un compte
 * soumis au second facteur qui n'a pas présenté de code ne peut aller nulle
 * part ailleurs — c'est ce qui distingue une exigence d'une suggestion.
 *
 * Rendue à la demande, jamais mise en cache : l'écran dépend de l'état exact
 * de la session, et un enrôlement prérendu n'aurait aucun sens.
 */
export const dynamic = "force-dynamic";

export default async function PageSecondFacteur() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const etape = await etapeSecondFacteur(personne);
  const destination = destinationApresConnexion(personne);

  // Rien à faire ici : soit le second facteur n'est pas exigé, soit cette
  // session l'a déjà présenté. On ne laisse pas une page d'enrôlement ouverte
  // à qui n'en a pas besoin.
  if (etape === "sans_objet" || etape === "verifie") redirect(destination);

  const enrolement = etape === "a_enroler" ? await preparerEnrolement(personne) : null;

  // Un facteur deja enrole : on ne refait pas le QR, on demande seulement le
  // code. Son identifiant est relu, jamais conserve.
  const facteurConnu = etape === "a_verifier" ? await facteurVerifieDe(personne) : null;

  if (enrolement !== null && "erreur" in enrolement) {
    return (
      <div className="contenu-site py-16">
        <h1 className="m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Vérification en deux étapes
        </h1>
        <p
          role="alert"
          className="m-0 mt-6 max-w-[60ch] rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4 text-[color:var(--color-erreur)]"
        >
          {enrolement.erreur}
        </p>
      </div>
    );
  }

  return (
    <div className="contenu-site py-16">
      <h1 className="m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        Vérification en deux étapes
      </h1>
      <p className="m-0 mt-3 max-w-[62ch] text-[color:var(--color-encre-faible)]">
        Votre compte administre {personne.portee === "editeur" ? "le site" : "un établissement"}.
        Un mot de passe seul ne suffit pas : il faut aussi un code produit par
        votre téléphone, qui change toutes les trente secondes.
      </p>

      <div className="mt-9 max-w-[52rem]">
        <SecondFacteur
          facteurId={enrolement === null ? (facteurConnu ?? "") : enrolement.facteurId}
          qrCode={enrolement === null ? null : enrolement.qrCode}
          secret={enrolement === null ? null : enrolement.secret}
          dejaEnrole={etape === "a_verifier"}
          destination={destination}
        />
      </div>
    </div>
  );
}

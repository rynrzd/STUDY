import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireConnexion } from "@/components/site/FormulaireConnexion";
import { BandeauEtablissement, CadreConnexion, LiensAcces } from "@/components/study/connexion/CadreConnexion";
import { FormulaireEtablissement } from "@/components/study/connexion/FormulaireEtablissement";
import { NettoyageApresDeconnexion } from "@/components/study/connexion/NettoyageLocal";
import { pagePrivee } from "@/lib/metadonnees";
import { destinationApresConnexion, jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { normaliserCode } from "@/lib/v6/contexte-etablissement";
import { lireContexteEtablissement } from "@/lib/v6/connexion-serveur";
import { suiteSure } from "@/lib/v6/redirection";
import { changerEtablissement } from "./actions";

export const metadata: Metadata = pagePrivee({
  titre: "Connexion",
  description: "Entrée réservée aux membres d'un établissement équipé.",
});

export const dynamic = "force-dynamic";

/**
 * /connexion — « Retrouve ta classe. »
 *
 * 1. Sans établissement connu : on le trouve (code ou lien d'invitation).
 * 2. Établissement connu (parcours en cours, ou mémorisé sur un appareil
 *    personnel) : son nom s'affiche avec « Changer », puis identifiant et
 *    mot de passe.
 *
 * Aucun choix de rôle : les droits viennent des affectations vérifiées en
 * base. Pas d'inscription : un compte est créé par l'établissement.
 *
 * Boucle évitée : une session présente mais inutilisable (jetons du
 * fournisseur non renouvelables) n'est plus considérée comme « connectée » ;
 * avant, `/app` renvoyait ici et cette page renvoyait vers `/app`.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ fin?: string; suite?: string; motif?: string; invitation?: string; etablissement?: string; code?: string; changer?: string }>;
}) {
  const p = await searchParams;
  const suite = suiteSure(p.suite);
  const personne = await sessionCourante();

  if (personne !== null) {
    const utilisable = personne.activationRequise || (await jetonAccesDe(personne)) !== null;
    if (utilisable && p.changer !== "1") {
      redirect(personne.activationRequise ? "/activation" : (suite ?? destinationApresConnexion(personne)));
    }
    if (utilisable) {
      return (
        <CadreConnexion titre="Changer de compte" sousTitre="Une session est déjà ouverte dans ce navigateur.">
          <div className="rounded-[12px] border border-[color:var(--color-bordure)] p-4">
            <p className="m-0 text-[0.875rem] text-[color:var(--color-encre-faible)]">Session ouverte</p>
            <p className="m-0 mt-0.5 font-semibold">
              {personne.prenom} {personne.nom}
              {personne.organisation ? ` · ${personne.organisation}` : ""}
            </p>
          </div>
          <Link href={destinationApresConnexion(personne)} className="bouton bouton-primaire bouton-acces mt-6 w-full">
            Continuer avec ce compte
          </Link>
          <form method="post" action="/deconnexion" className="mt-3">
            <button type="submit" className="bouton bouton-secondaire bouton-acces w-full">
              Me déconnecter pour changer de compte
            </button>
          </form>
          <p className="meta m-0 mt-4">La déconnexion efface les brouillons et copies de Study enregistrés dans ce navigateur.</p>
        </CadreConnexion>
      );
    }
  }

  const contexte = await lireContexteEtablissement();
  const fin = p.fin === "1" || p.fin === "partout" || p.fin === "locale";

  return (
    <CadreConnexion
      titre={contexte ? "Connecte-toi à Study." : "Quel est ton établissement ?"}
      sousTitre={contexte ? undefined : "Étape 1 sur 2 — ton identifiant n'existe que dans ton établissement."}
    >
      {fin ? <NettoyageApresDeconnexion /> : null}
      <Messages motif={p.motif} fin={p.fin} invitation={p.invitation} sessionInutilisable={personne !== null} />

      {contexte ? (
        <>
          <BandeauEtablissement
            nom={contexte.nom}
            changer={
              <form action={changerEtablissement}>
                {suite ? <input type="hidden" name="suite" value={suite} /> : null}
                <button type="submit" className="bouton bouton-discret bouton-compact" aria-label={`Changer d'établissement (actuellement ${contexte.nom})`}>
                  Changer
                </button>
              </form>
            }
          />
          <FormulaireConnexion suite={suite} code={contexte.code} />
        </>
      ) : (
        <>
          <FormulaireEtablissement suite={suite} codeInitial={normaliserCode(p.etablissement ?? p.code)} />
        </>
      )}

      <LiensAcces />
    </CadreConnexion>
  );
}

function Messages({ motif, fin, invitation, sessionInutilisable }: { motif?: string; fin?: string; invitation?: string; sessionInutilisable: boolean }) {
  const boite = "mb-5 rounded-[12px] p-4 text-[0.9375rem]";
  if (motif === "expiree" || sessionInutilisable) {
    return (
      <p role="status" className={`${boite} bg-[color:var(--color-attention-fond)] text-[color:var(--color-attention)]`}>
        Ta session a pris fin. Reconnecte-toi : tu reviendras sur la page que tu consultais, et les brouillons enregistrés sur cet
        appareil t&apos;attendent — rien n&apos;a été publié à ta place.
      </p>
    );
  }
  if (fin === "locale") {
    return (
      <p role="alert" className={`${boite} bg-[color:var(--color-attention-fond)] text-[color:var(--color-attention)]`}>
        Tu es déconnecté de ce navigateur, mais la fermeture des sessions côté serveur n’a pas pu être confirmée.
        Reconnecte-toi lorsque le service est disponible, puis réessaie « Se déconnecter de tous mes appareils ».
      </p>
    );
  }
  if (fin === "1" || fin === "partout") {
    return (
      <p role="status" className={`${boite} bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]`}>
        {fin === "partout" ? "Déconnexion effectuée sur tous tes appareils." : "Déconnexion effectuée."} Les brouillons et copies de Study enregistrés dans
        ce navigateur ont été effacés. Les fichiers téléchargés restent dans ton dossier de téléchargements ; sur un ordinateur
        partagé, ferme aussi le navigateur.
      </p>
    );
  }
  if (invitation === "ok") {
    return (
      <p role="status" className={`${boite} bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]`}>
        Ton mot de passe est enregistré. Connecte-toi avec ton identifiant.
      </p>
    );
  }
  return null;
}

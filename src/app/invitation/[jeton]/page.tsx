import type { Metadata } from "next";
import Link from "next/link";
import { CarteAcces } from "@/components/study/CarteAcces";
import { pagePrivee } from "@/lib/metadonnees";
import { baseConfiguree, clientExploitation } from "@/lib/supabase-serveur";
import { empreinteInvitation, FORME_JETON } from "@/lib/v6/invitations";
import { FormulaireInvitation } from "./FormulaireInvitation";

export const metadata: Metadata = pagePrivee({ titre: "Invitation", description: "Activer son compte avec une invitation." });
export const dynamic = "force-dynamic";

const ETATS: Record<string, { titre: string; texte: string }> = {
  expiree: {
    titre: "Ce lien a expiré",
    texte: "Une invitation est valable sept jours. Demandez-en une nouvelle à la vie scolaire ou au secrétariat de votre établissement.",
  },
  revoquee: {
    titre: "Ce lien n'est plus valable",
    texte: "Un lien plus récent a été créé pour vous, ou celui-ci a été retiré. Utilisez la dernière invitation reçue, ou demandez-en une nouvelle.",
  },
  utilisee: {
    titre: "Ce lien a déjà servi",
    texte: "Votre compte est activé. Connectez-vous avec votre code établissement, votre identifiant et le mot de passe que vous avez choisi.",
  },
  inconnue: {
    titre: "Ce lien n'est pas reconnu",
    texte: "Vérifiez qu'il a été copié en entier. S'il ne fonctionne toujours pas, demandez une nouvelle invitation à votre établissement.",
  },
};

/**
 * Invitation nominative — dossier V6, §6.2. Un lien ouvert ne montre aucune
 * donnée de classe : seulement le prénom, l'établissement et l'identifiant,
 * à qui tient un lien valable. Les états expiré, révoqué et déjà utilisé sont
 * distincts, et ne révèlent rien d'autre.
 */
export default async function PageInvitation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (!baseConfiguree()) {
    return (
      <CarteAcces titre="Service momentanément indisponible">
        <p className="m-0">Votre lien reste valable. Réessayez dans quelques minutes.</p>
      </CarteAcces>
    );
  }

  let etat: { etat: string; prenom: string | null; organisation: string | null; code_etablissement: string | null; identifiant: string | null } | undefined;
  if (FORME_JETON.test(jeton)) {
    const { data } = await clientExploitation("invitation_et_recuperation").rpc("invitation_etat", { p_empreinte: empreinteInvitation(jeton) });
    etat = ((data ?? []) as NonNullable<typeof etat>[])[0];
  }

  if (!etat || etat.etat !== "valide") {
    const message = ETATS[etat?.etat ?? "inconnue"] ?? ETATS.inconnue!;
    return (
      <CarteAcces titre={message.titre}>
        <p className="m-0">{message.texte}</p>
        <Link href="/connexion" className="bouton bouton-primaire mt-6 w-full">
          Aller à la connexion
        </Link>
      </CarteAcces>
    );
  }

  return (
    <CarteAcces titre={`Bienvenue ${etat.prenom ?? ""}`} sousTitre={`Choisissez votre mot de passe pour ${etat.organisation ?? "votre établissement"}.`}>
      <dl className="m-0 mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-[12px] bg-[color:var(--color-surface-douce)] p-4 text-[0.8125rem]">
        <dt className="text-[color:var(--color-encre-faible)]">Code établissement</dt>
        <dd className="m-0 font-mono font-semibold">{etat.code_etablissement}</dd>
        <dt className="text-[color:var(--color-encre-faible)]">Identifiant</dt>
        <dd className="m-0 font-mono font-semibold">{etat.identifiant}</dd>
      </dl>
      <p className="meta m-0 mb-4">Notez ces deux informations : elles vous serviront à chaque connexion. Ce lien ne fonctionnera qu&apos;une fois.</p>
      <FormulaireInvitation jeton={jeton} />
    </CarteAcces>
  );
}

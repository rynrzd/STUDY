import Link from "next/link";
import { BandeauEtablissement } from "@/components/study/connexion/CadreConnexion";
import { CadreAccesPublic as CadreConnexion } from "@/components/site/CadreAccesPublic";
import { FormulaireInvitation } from "./FormulaireInvitation";

/** Rendu d'une invitation selon son état — partagé par la page et les aperçus. */
const ETATS: Record<string, { titre: string; texte: string; action: { href: string; libelle: string } }> = {
  expiree: {
    titre: "Ce lien a expiré",
    texte: "Une invitation est valable sept jours au plus. Demande un nouveau lien à la vie scolaire ou au secrétariat.",
    action: { href: "/acces-oublie", libelle: "Demander un nouvel accès" },
  },
  revoquee: {
    titre: "Ce lien n'est plus valable",
    texte: "Un lien plus récent a été créé pour toi, ou celui-ci a été retiré. Utilise la dernière invitation reçue.",
    action: { href: "/connexion", libelle: "Aller à la connexion" },
  },
  utilisee: {
    titre: "Ce lien a déjà servi",
    texte: "Ton accès est activé. Connecte-toi avec ton identifiant et le mot de passe que tu as choisi.",
    action: { href: "/connexion", libelle: "Me connecter" },
  },
  indisponible: {
    titre: "Ce compte n'est pas disponible",
    texte: "Ton compte ou ton établissement n'est pas actif pour le moment. Rapproche-toi de ton établissement.",
    action: { href: "/connexion", libelle: "Aller à la connexion" },
  },
  inconnue: {
    titre: "Ce lien n'est pas reconnu",
    texte: "Vérifie qu'il a été copié en entier. S'il ne fonctionne toujours pas, demande une nouvelle invitation à ton établissement.",
    action: { href: "/activer", libelle: "Coller mon lien" },
  },
};

export interface Etat {
  etat: string;
  prenom: string | null;
  organisation: string | null;
  code_etablissement: string | null;
  identifiant: string | null;
  compte: string | null;
}

export function VueInvitation({ jeton, etat }: { jeton: string; etat: Etat | undefined }) {
  if (!etat || etat.etat !== "valide") {
    const m = ETATS[etat?.etat ?? "inconnue"] ?? ETATS.inconnue!;
    return (
      <CadreConnexion titre={m.titre}>
        <p className="m-0 text-[1.0625rem]" data-etat={etat?.etat ?? "inconnue"}>
          {m.texte}
        </p>
        <Link href={m.action.href} className="bouton bouton-primaire bouton-acces mt-6 w-full">
          {m.action.libelle}
        </Link>
      </CadreConnexion>
    );
  }

  const actif = etat.compte === "actif";
  return (
    <CadreConnexion
      titre={`Bienvenue ${etat.prenom ?? ""}`.trim()}
      sousTitre={actif ? "Ton compte existe déjà : ce lien te permet de choisir un nouveau mot de passe." : "Active ton accès à Study en choisissant ton mot de passe."}
      visuel="Ton établissement a préparé ton accès : ton identifiant, tes classes et tes droits."
    >
      <BandeauEtablissement nom={etat.organisation ?? "Ton établissement"} changer={null} />
      <dl className="m-0 mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9375rem]">
        <dt className="text-[color:var(--color-encre-faible)]">Identifiant</dt>
        <dd className="m-0 font-mono font-semibold">{etat.identifiant}</dd>
        <dt className="text-[color:var(--color-encre-faible)]">Code établissement</dt>
        <dd className="m-0 font-mono font-semibold">{etat.code_etablissement}</dd>
      </dl>
      {actif ? (
        <p className="meta m-0 mb-5">Ton identifiant, tes classes et tes données restent inchangés. Tes autres sessions seront fermées.</p>
      ) : null}
      <FormulaireInvitation jeton={jeton} prenom={etat.prenom ?? "la personne invitée"} compteActif={actif} />
      <p className="meta m-0 mt-5">Ce lien ne fonctionne qu&apos;une fois.</p>
    </CadreConnexion>
  );
}

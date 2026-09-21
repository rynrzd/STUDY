import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { devoir as lireDevoir, preuveDeRemise } from "@/lib/devoirs";
import { instantLisible } from "@/lib/horodatage";
import { MARQUE } from "@/lib/identite-legale";
import { pagePrivee } from "@/lib/metadonnees";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = pagePrivee({
  titre: "Preuve de remise",
  description: "L'accusé d'enregistrement d'une copie remise.",
});

/**
 * La preuve de remise — cahier V5, §2.
 *
 * **Pourquoi une page, et pas le message de confirmation.** L'accusé n'existait
 * que le temps de la réponse à l'envoi : un rechargement l'effaçait. Un élève
 * qui veut montrer qu'il a rendu — à ses parents, à la vie scolaire, à un
 * professeur qui ne trouve pas sa copie — n'a rien à montrer trois jours plus
 * tard. Celle-ci survit au F5, et s'imprime.
 *
 * **Elle porte sept éléments**, et c'est le minimum pour qu'elle serve : la
 * référence, le devoir, l'élève, sa classe, le nom du fichier, l'horodatage
 * serveur, et l'état à l'heure ou en retard. Une preuve qui tairait le retard
 * ne prouverait rien.
 *
 * **Ce n'est pas un constat juridique.** C'est écrit sur la page, pas en note
 * de bas de page : un accusé interne présenté comme opposable serait une
 * promesse qu'AvecStudy ne peut pas tenir.
 *
 * L'interface disparaît à l'impression — fil d'Ariane, bouton, lien de retour.
 * Ce qui reste sur le papier est la preuve, et rien d'autre.
 */
export const dynamic = "force-dynamic";

const ETATS: Record<string, string> = {
  remis: "Remis",
  remis_en_retard: "Remis en retard",
  retour_disponible: "Corrigé",
  a_reprendre: "À reprendre",
};

export default async function PagePreuve({ params }: { params: Promise<{ devoir: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { devoir: identifiant } = await params;

  const [leDevoir, preuve] = await Promise.all([
    lireDevoir(jeton, identifiant),
    preuveDeRemise(jeton, identifiant),
  ]);

  // Rien remis, ou la copie de quelqu'un d'autre : même réponse. Distinguer
  // les deux apprendrait qu'une copie existe.
  if (leDevoir === null || preuve === null) notFound();

  return (
    <article className="max-w-[var(--spacing-lecture)]">
      <nav aria-label="Fil d'ariane" className="mb-6 print:hidden">
        <Link
          href={`/eleve/devoirs/${identifiant}`}
          className="lien-fleche text-[length:var(--text-tableau)]"
        >
          <span aria-hidden="true">←</span> Le devoir
        </Link>
      </nav>

      <h1
        data-testid="preuve-titre"
        className="m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]"
      >
        Preuve de remise
      </h1>

      <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        {MARQUE} — accusé d&apos;enregistrement interne
      </p>

      <dl
        data-testid="preuve-details"
        className="m-0 mt-8 grid gap-x-8 gap-y-3 border-t border-[color:var(--color-bordure)] pt-6 text-[length:var(--text-tableau)] sm:grid-cols-[12rem_minmax(0,1fr)]"
      >
        <dt className="font-semibold">Référence</dt>
        <dd className="m-0 font-mono" data-testid="preuve-reference">
          {preuve.reference}
        </dd>

        <dt className="font-semibold">Devoir</dt>
        <dd className="m-0" data-testid="preuve-devoir">
          {preuve.devoir}
        </dd>

        <dt className="font-semibold">Matière</dt>
        <dd className="m-0">{preuve.matiere}</dd>

        <dt className="font-semibold">Élève</dt>
        <dd className="m-0" data-testid="preuve-eleve">
          {preuve.eleve}
        </dd>

        <dt className="font-semibold">Classe</dt>
        <dd className="m-0" data-testid="preuve-classe">
          {preuve.classe === "" ? "—" : preuve.classe}
        </dd>

        <dt className="font-semibold">Fichier remis</dt>
        <dd className="m-0 break-words" data-testid="preuve-fichier">
          {preuve.nomFichier === "" ? "—" : preuve.nomFichier}
        </dd>

        <dt className="font-semibold">Enregistré le</dt>
        <dd className="m-0" data-testid="preuve-date">
          {instantLisible(preuve.remisLe)} (heure de Paris)
        </dd>

        <dt className="font-semibold">État</dt>
        <dd className="m-0" data-testid="preuve-etat" data-retard={preuve.enRetard ? "oui" : "non"}>
          {preuve.enRetard ? "Remise en retard" : "Remise à l'heure"}
          {" — "}
          {ETATS[preuve.etat] ?? preuve.etat}
        </dd>

        <dt className="font-semibold">Version</dt>
        <dd className="m-0">n° {preuve.numero}</dd>
      </dl>

      <p
        data-testid="preuve-avertissement"
        className="m-0 mt-8 border-t border-[color:var(--color-bordure)] pt-6 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
      >
        Cet accusé est un enregistrement interne à {MARQUE}, horodaté par le
        serveur au moment de la remise. <strong>Ce n&apos;est pas un constat
        juridique</strong>, et il ne vaut pas devant un tiers. Il sert à dire, à
        l&apos;intérieur de l&apos;établissement, ce que le serveur a enregistré
        et quand.
      </p>

      <p className="m-0 mt-6 print:hidden">
        <Link href={`/eleve/devoirs/${identifiant}`} className="bouton bouton-secondaire">
          Retour au devoir
        </Link>
      </p>
    </article>
  );
}

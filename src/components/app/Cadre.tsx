import { ConteneurEffets } from "@/components/study/ConteneurEffets";
import { Coque } from "@/components/study/Coque";
import { contexteApp } from "@/lib/v6/contexte";

/**
 * Cadre commun des espaces connectés.
 *
 * Depuis la V6 (dossier du 5 octobre 2026), tous les espaces — élève,
 * professeur, studio, administration, paramètres — partagent la même coque :
 * barre latérale sur ordinateur, cinq destinations sur téléphone. Les liens
 * ne sont plus passés par chaque gabarit : ils se déduisent des rôles relus
 * en base, si bien qu'un lien oublié d'un côté ne peut plus diverger.
 *
 * Les props historiques sont acceptées pour ne pas casser les gabarits qui
 * les passent encore ; elles ne décident de rien.
 */

export interface LienEspace {
  readonly href: string;
  readonly libelle: string;
}

export async function Cadre({
  children,
}: {
  liens?: readonly LienEspace[];
  personne?: { prenom: string; nom: string };
  contexte?: string | null;
  children: React.ReactNode;
}) {
  const ctx = await contexteApp();
  return (
    <ConteneurEffets>
      <Coque ctx={ctx}>{children}</Coque>
    </ConteneurEffets>
  );
}

/**
 * Titre de page, identique dans tous les espaces. L'action principale est à
 * droite sur grand écran et passe dessous sur téléphone — jamais cachée.
 */
export function TitreEspace({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="titre-page">{titre}</h1>
        {sousTitre ? <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">{sousTitre}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** État vide : une explication et une action — jamais une zone blanche. */
export function Vide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panneau border-dashed px-6 py-12 text-center">
      <p className="titre-bloc m-0 font-semibold">{titre}</p>
      <p className="mx-auto m-0 mt-2 max-w-[54ch] text-[color:var(--color-encre-faible)]">{texte}</p>
      {action ? <div className="mt-6 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Bandeau d'erreur : ce qui s'est passé, et de quoi réessayer. */
export function Erreur({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="panneau border-[color:var(--color-erreur-fond)] bg-[color:var(--color-erreur-fond)]">
      <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

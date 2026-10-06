import Link from "next/link";
import { ConteneurEffets } from "@/components/study/ConteneurEffets";
import { RubanStudy } from "@/components/study/ruban/RubanStudy";

/**
 * Cadre des écrans d'accès (connexion, première connexion, récupération,
 * invitation).
 *
 * Ordinateur (≥ 1024 px) : 45 % visuel rose pâle, 55 % formulaire de 420 px
 * au plus. Le ruban est contenu dans son cadre et chargé après le
 * formulaire : celui-ci est utilisable même si la 3D échoue ou tarde.
 *
 * Téléphone : une colonne, le logo, le titre et le formulaire d'abord. Pas
 * d'illustration — elle repousserait le formulaire sous le clavier. Le
 * contenu part du haut (pas de centrage vertical) pour que le clavier ouvert
 * laisse le champ actif, son erreur et le bouton à portée. Marges de 20 px,
 * zones sûres respectées.
 */
export function CadreConnexion({
  titre,
  sousTitre,
  children,
  visuel = "Retrouve ta classe, tes cours et tes échanges, au même endroit.",
}: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  visuel?: string;
}) {
  return (
    <ConteneurEffets>
    <div className="sans-debordement grid min-h-dvh bg-[color:var(--color-surface)] lg:grid-cols-[45fr_55fr]">
      <aside className="relative hidden flex-col bg-[color:var(--color-rose-clair)] px-12 pb-10 pt-11 lg:flex" aria-label="Study">
        <Link href="/" className="marque-study text-[2rem] leading-none" aria-label="Study, retour au site">
          study<span>.</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-8">
          <RubanStudy composition="petite" webgl className="aspect-[640/520] w-full max-w-[400px]" />
        </div>
        <p className="m-0 max-w-[30ch] text-[1.125rem] leading-[1.5] text-[color:var(--color-accent-fonce)]">{visuel}</p>
      </aside>

      <main
        id="contenu"
        className="flex flex-col px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:px-8 lg:justify-center lg:py-12"
      >
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="marque-study inline-block text-[1.75rem] leading-none lg:hidden" aria-label="Study, retour au site">
            study<span>.</span>
          </Link>
          <h1 className="m-0 mt-7 text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.25rem] lg:mt-0">{titre}</h1>
          {sousTitre ? <p className="m-0 mt-2 text-[1.0625rem] text-[color:var(--color-encre-faible)]">{sousTitre}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
    </ConteneurEffets>
  );
}

/** Le contexte établissement au-dessus du formulaire, avec « Changer ». */
export function BandeauEtablissement({ nom, changer }: { nom: string; changer: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] px-4 py-3">
      <div className="min-w-0">
        <p className="m-0 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">Établissement</p>
        <p className="m-0 font-semibold [overflow-wrap:anywhere]" data-testid="etablissement-nom">
          {nom}
        </p>
      </div>
      {changer}
    </div>
  );
}

/** Liens secondaires sous les formulaires d'accès. */
export function LiensAcces() {
  return (
    <ul className="m-0 mt-8 grid list-none gap-3 border-t border-[color:var(--color-bordure)] p-0 pt-6 text-[0.9375rem]">
      <li>
        Première connexion ?{" "}
        <Link href="/activer" className="font-semibold text-[color:var(--color-accent)]">
          Activer mon accès
        </Link>
      </li>
      <li>
        Un code de classe ?{" "}
        <Link href="/rejoindre" className="font-semibold text-[color:var(--color-accent)]">
          Rejoindre ma classe
        </Link>
      </li>
    </ul>
  );
}

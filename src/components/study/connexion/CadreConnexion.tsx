import Link from "next/link";
import { BookOpen, CalendarCheck, MessagesSquare } from "lucide-react";
import { MotSymbole } from "@/components/site/MotSymbole";
import { ConteneurEffets } from "@/components/study/ConteneurEffets";

/**
 * AuthShell R2 — cahier §06 et lecture des maquettes (connexion).
 *
 * Page gris clair, petit logo en haut. Ordinateur (≥ 1024 px) : deux colonnes
 * 40/60 — à gauche un panneau blush, titre et trois lignes Cours / Travail /
 * Échanges en composition typographique plate ; à droite le formulaire blanc,
 * 440 px au plus, bordure discrète, 32 px de marge intérieure.
 * Téléphone : logo, titre, formulaire et aides ; aucun panneau illustratif,
 * contenu depuis le haut pour que le clavier laisse le champ actif visible.
 */
export function CadreConnexion({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  /** Accepté pour compatibilité ; le panneau R2 a un texte fixe. */
  visuel?: string;
}) {
  return (
    <ConteneurEffets>
      <div className="sans-debordement min-h-dvh bg-[color:var(--color-fond)]">
        <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-5 sm:px-8 lg:h-[72px]">
          <Link href="/" className="inline-flex min-h-[44px] items-center text-[color:var(--color-encre)]">
            <MotSymbole titre="Study, retour au site" className="block h-auto w-[80px] lg:w-[92px]" />
          </Link>
        </header>
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 pb-[max(40px,env(safe-area-inset-bottom))] sm:px-8 lg:grid-cols-[2fr_3fr] lg:items-center lg:gap-16 lg:py-10">
          <aside className="hidden rounded-[var(--radius-grand)] bg-[color:var(--color-rose-clair)] p-12 lg:block" aria-label="Study en bref">
            <p className="m-0 text-[2.75rem] font-extrabold leading-[1.08] tracking-[-0.045em]">Ta classe commence ici.</p>
            <ul className="m-0 mt-10 grid list-none gap-6 p-0">
              {[
                { icone: BookOpen, titre: "Cours", texte: "Les séances et documents de tes professeurs." },
                { icone: CalendarCheck, titre: "Travail", texte: "Ce qui est à faire, et pour quand." },
                { icone: MessagesSquare, titre: "Échanges", texte: "Le salon de ta classe, avec ton professeur." },
              ].map((l) => (
                <li key={l.titre} className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[color:var(--color-surface)] text-[color:var(--color-accent)]">
                    <l.icone size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[1.125rem] font-extrabold">{l.titre}</span>
                    <span className="block text-[1rem] text-[color:var(--color-encre-faible)]">{l.texte}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <main id="contenu" className="w-full">
            <div className="mx-auto w-full max-w-[440px] lg:rounded-[var(--radius-carte)] lg:border lg:border-[color:var(--color-bordure)] lg:bg-[color:var(--color-surface)] lg:p-8">
              <h1 className="m-0 mt-4 text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.035em] sm:text-[2rem] lg:mt-0">{titre}</h1>
              {sousTitre ? <p className="m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)]">{sousTitre}</p> : null}
              <div className="mt-7">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </ConteneurEffets>
  );
}

/** Le contexte établissement au-dessus du formulaire, avec « Changer ». */
export function BandeauEtablissement({ nom, changer }: { nom: string; changer: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-rose-clair)] px-4 py-3">
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

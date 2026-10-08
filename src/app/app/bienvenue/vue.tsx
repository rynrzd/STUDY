import Link from "next/link";
import { Check } from "lucide-react";
import { EnTetePage, ICONE } from "@/components/study/ui";
import { terminerBienvenue } from "../reglages/actions";

export interface DonneesBienvenue {
  readonly prenom: string;
  readonly classe: string | null;
  readonly role: string;
  readonly matieres: readonly string[] | null;
  readonly nbDevoirs: number;
}

/**
 * A01 — vue de Bienvenue (maquette R2 n° 2, « Votre compte est prêt ») : à
 * gauche le rôle confirmé par le serveur, à droite les prochaines étapes.
 * Rendue par la page (données réelles) et par l'aperçu de développement.
 */
export function VueBienvenue({ prenom, classe, role, matieres, nbDevoirs }: DonneesBienvenue) {
  const etapes = [
    {
      titre: "Découvrir tes cours",
      texte: matieres && matieres.length > 0 ? `${matieres.length} matière${matieres.length > 1 ? "s" : ""} : ${matieres.slice(0, 4).join(", ")}.` : "Tes cours apparaîtront dès la première séance publiée.",
      lien: "/app/cours",
      action: "Voir mes cours",
    },
    {
      titre: classe ? `Rejoindre ${classe}` : "Rejoindre ta classe",
      texte: "Le salon, les délégués, l'entraide et la bibliothèque des bonnes explications.",
      lien: "/app/classe",
      action: "Découvrir ma classe",
    },
    {
      titre: "Organiser ton travail",
      texte: nbDevoirs > 0 ? `${nbDevoirs} devoir${nbDevoirs > 1 ? "s" : ""} publié${nbDevoirs > 1 ? "s" : ""} dans tes cours.` : "Aucun devoir pour l'instant. L'agenda les rassemblera.",
      lien: "/app/agenda",
      action: "Ouvrir l'agenda",
    },
  ];

  return (
    <div className="mx-auto max-w-[1040px]">
      <EnTetePage sourcil="Bienvenue" titre={`Ton compte est prêt, ${prenom}.`} sousTitre={classe ? `Tu as rejoint ${classe}.` : "Ton établissement a activé ton compte."} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-labelledby="role" className="panneau flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-4 inline-grid h-16 w-16 place-items-center rounded-full bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]">
            <Check size={28} strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 id="role" className="titre-section">
            Rôle confirmé : {role}
          </h2>
          <p className="m-0 mt-2 max-w-[40ch] text-[color:var(--color-encre-faible)]">Ton compte a été créé par ton établissement. Ce que tu vois dépend de tes classes.</p>
          <form action={terminerBienvenue} className="mt-6 flex flex-col items-center gap-2">
            <button type="submit" name="vers" value="/app" className="bouton bouton-primaire bouton-grand">
              <Check {...ICONE} /> Accéder à l&apos;accueil
            </button>
            <button type="submit" name="vers" value="/app" className="bouton bouton-discret">
              Ignorer pour l&apos;instant
            </button>
          </form>
        </section>

        <section aria-labelledby="etapes" className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6">
          <h2 id="etapes" className="titre-bloc m-0 font-bold">
            Prochaines étapes
          </h2>
          <ol className="m-0 mt-4 grid list-none gap-5 p-0">
            {etapes.map((e, i) => (
              <li key={e.titre} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--color-surface)] text-[0.875rem] font-extrabold text-[color:var(--color-accent)]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{e.titre}</span>
                  <span className="block text-[0.9375rem] text-[color:var(--color-encre-faible)]">{e.texte}</span>
                  <Link href={e.lien} className="mt-1 inline-flex min-h-[40px] items-center font-semibold text-[color:var(--color-accent)]">
                    {e.action}
                  </Link>
                </span>
              </li>
            ))}
          </ol>
          <p className="meta m-0 mt-5">Envie d&apos;un binôme pour démarrer ? Demande-le à ton professeur principal : c&apos;est toujours volontaire.</p>
        </section>
      </div>
    </div>
  );
}

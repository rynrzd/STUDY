import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, HandHelping, Lightbulb, MessageCircle, Megaphone, Users } from "lucide-react";
import { CaseFaite } from "@/components/app/CaseFaite";
import { RubanStudy } from "@/components/study/ruban/RubanStudy";
import { Etiquette, ICONE, dateLisible } from "@/components/study/ui";

/**
 * E01 — Aujourd'hui, mise en page du brief visuel (image de référence).
 *
 * Composant de présentation : il ne lit rien. La page le nourrit avec des
 * données déjà filtrées par la base sous le jeton de l'élève ; les aperçus de
 * développement le nourrissent avec des données fictives. Chaque bloc a son
 * état vide, et un bloc sans objet réel (consultation, révision collective)
 * n'invente rien.
 */

export interface DonneesAccueil {
  readonly prenom: string;
  readonly salut: string;
  readonly dateLibelle: string;
  readonly premiereVisite: boolean;
  readonly reprise: {
    readonly id: string;
    readonly titre: string;
    readonly objectif: string | null;
    readonly contexte: string;
    readonly dejaLue: boolean;
  } | null;
  readonly taches: readonly { readonly id: string; readonly titre: string; readonly matiere: string; readonly echeance: string }[];
  readonly cours: readonly { readonly id: string; readonly matiere: string; readonly libelle: string }[];
  readonly enDirect: { readonly titre: string; readonly sujet: string; readonly lien: string; readonly quand: string } | null;
  readonly consultation: { readonly titre: string; readonly lien: string; readonly fermeLe: string | null } | null;
  readonly ensemble: { readonly titre: string; readonly lien: string; readonly debut: string; readonly inscrits: number; readonly capacite: number } | null;
  readonly semaine: readonly { readonly cle: string; readonly jour: string; readonly titre: string; readonly genre: string }[] | null;
  readonly suggestion: { readonly notion: string; readonly cours: string; readonly explication: string } | null;
}

const TEINTES = [
  ["#d894ab", "#b67d92"],
  ["#efc6d3", "#d2a3b4"],
  ["#a95c79", "#874a61"],
  ["#e3aec2", "#c48ca1"],
] as const;

function sigle(matiere: string) {
  const m = matiere.toLowerCase();
  if (m.startsWith("math")) return "π";
  if (m.startsWith("fran")) return "Aa";
  const mots = matiere.split(/[\s-]+/u).filter(Boolean);
  return (mots.length > 1 ? `${mots[0]![0]}${mots[1]![0]}` : matiere.slice(0, 2)).toUpperCase();
}

export function AccueilEleve({ d }: { d: DonneesAccueil }) {
  return (
    <div className="accueil">
      <header className="entree-section mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h1 className="m-0 text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.375rem]">
            {d.salut} {d.prenom}.
          </h1>
          <p className="m-0 mt-1 text-[1.0625rem] text-[color:var(--color-encre-faible)]">Ta classe, tes idées, tes progrès.</p>
        </div>
        <p className="meta m-0 first-letter:uppercase">{d.dateLibelle}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <BlocReprise d={d} />

          <section className="panneau entree-section" style={{ "--delai": "60ms" } as React.CSSProperties} aria-labelledby="a-faire">
            <div className="flex items-center justify-between gap-3">
              <h2 id="a-faire" className="titre-section m-0">
                À faire aujourd&apos;hui
              </h2>
              <Link href="/app/devoirs" className="lien-fleche text-[0.8125rem]">
                Tout voir
              </Link>
            </div>
            {d.taches.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Rien à rendre pour le moment.</p>
            ) : (
              <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                {d.taches.map((t) => (
                  <li key={t.id} className="flex min-w-0 items-center gap-3 rounded-[12px] border border-[color:var(--color-bordure)] px-3 py-2.5">
                    <CaseFaite devoir={t.id} fait={false} libelle={t.titre} />
                    <Link href={`/app/devoirs/${t.id}`} className="min-w-0 flex-1 no-underline">
                      <span className="line-clamp-2 block font-semibold text-[color:var(--color-encre)]">{t.titre}</span>
                      <span className="meta block">
                        {t.echeance}
                        <span className="xl:hidden"> · {t.matiere}</span>
                      </span>
                    </Link>
                    <span className="hidden shrink-0 xl:inline-flex">
                      <Etiquette ton="rose">{t.matiere}</Etiquette>
                    </span>
                    <Link href={`/app/devoirs/${t.id}`} className="bouton bouton-secondaire bouton-compact hidden shrink-0 sm:inline-flex" tabIndex={-1} aria-hidden="true">
                      Ouvrir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panneau entree-section" style={{ "--delai": "120ms" } as React.CSSProperties} aria-labelledby="tes-cours">
            <div className="flex items-center justify-between gap-3">
              <h2 id="tes-cours" className="titre-section m-0">
                Tes cours
              </h2>
              <Link href="/app/cours" className="bouton-icone" aria-label="Tous mes cours">
                <ChevronRight {...ICONE} />
              </Link>
            </div>
            {d.cours.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Tes cours apparaîtront ici dès qu&apos;un professeur les aura ouverts.</p>
            ) : (
              <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {d.cours.slice(0, 6).map((c, i) => {
                  const [teinte, tranche] = TEINTES[i % TEINTES.length]!;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/app/cours/${c.id}`}
                        className="carte-cours carte-souleve flex min-h-[76px] items-center gap-3.5 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-4 py-3 no-underline"
                      >
                        <span className="livre" aria-hidden="true" style={{ "--teinte-livre": teinte, "--tranche-livre": tranche } as React.CSSProperties}>
                          {sigle(c.matiere)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold leading-snug text-[color:var(--color-encre)] [overflow-wrap:anywhere]">{c.matiere}</span>
                          <span className="meta block truncate">{c.libelle}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <section className="panneau entree-section" style={{ "--delai": "80ms" } as React.CSSProperties} aria-labelledby="en-direct">
            <h2 id="en-direct" className="titre-section m-0">
              La classe en direct
            </h2>
            {d.enDirect ? (
              <div className="mt-3 flex gap-3">
                <span className="avatar shrink-0" aria-hidden="true">
                  <MessageCircle size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 font-semibold">{d.enDirect.titre}</p>
                  <p className="meta m-0 mt-1 line-clamp-2">
                    {d.enDirect.sujet} · {d.enDirect.quand}
                  </p>
                  <Link href={d.enDirect.lien} className="lien-fleche mt-3 inline-flex text-[0.875rem]">
                    Ouvrir la discussion <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" className="fleche" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">
                Rien de neuf depuis ta dernière visite. <Link href="/app/messagerie">Ouvrir la messagerie</Link>
              </p>
            )}
          </section>

          {d.consultation ? (
            <section className="panneau panneau-rose entree-section relative overflow-hidden" style={{ "--delai": "140ms" } as React.CSSProperties} aria-labelledby="ta-voix">
              <div className="relative z-[1] max-w-[70%]">
                <h2 id="ta-voix" className="titre-section m-0">
                  Ta voix compte.
                </h2>
                <p className="m-0 mt-1 text-[0.875rem] text-[color:var(--color-accent-fonce)]">
                  {d.consultation.titre}
                  {d.consultation.fermeLe ? ` · jusqu'au ${dateLisible(d.consultation.fermeLe, { day: "numeric", month: "long" })}` : ""}
                </p>
                <Link href={d.consultation.lien} className="bouton bouton-primaire mt-4">
                  Donner mon avis
                </Link>
              </div>
              <Megaphone aria-hidden="true" size={64} strokeWidth={1.25} className="absolute right-4 top-1/2 -translate-y-1/2 -rotate-12 text-[color:var(--color-rose-moyen)]" />
            </section>
          ) : null}

          <section className="panneau entree-section" style={{ "--delai": "200ms" } as React.CSSProperties} aria-labelledby="ensemble">
            <h2 id="ensemble" className="titre-section m-0">
              Réviser ensemble
            </h2>
            {d.ensemble ? (
              <>
                <p className="m-0 mt-2 font-semibold">{d.ensemble.titre}</p>
                <p className="meta m-0 mt-1">
                  {d.ensemble.debut} · {d.ensemble.inscrits} inscrit{d.ensemble.inscrits > 1 ? "s" : ""} sur {d.ensemble.capacite}
                </p>
                <Link href={d.ensemble.lien} className="bouton bouton-secondaire mt-4">
                  <Users {...ICONE} /> Voir la séance
                </Link>
              </>
            ) : (
              <>
                <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">Aucune révision collective prévue. Une question ? Ta classe est là.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/app/aide" className="bouton bouton-secondaire">
                    <HandHelping {...ICONE} /> Débloque-moi
                  </Link>
                  <Link href="/app/classe?onglet=entraide" className="bouton bouton-discret">
                    L&apos;entraide
                  </Link>
                </div>
              </>
            )}
          </section>

          <section className="panneau entree-section" style={{ "--delai": "260ms" } as React.CSSProperties} aria-labelledby="semaine">
            <div className="flex items-center justify-between gap-3">
              <h2 id="semaine" className="titre-section m-0">
                Cette semaine
              </h2>
              <Link href="/app/agenda" className="bouton-icone" aria-label="Mon agenda">
                <CalendarDays {...ICONE} />
              </Link>
            </div>
            {d.semaine === null ? (
              <p className="m-0 mt-3 text-[color:var(--color-erreur)]">L&apos;agenda n&apos;a pas pu être chargé.</p>
            ) : d.semaine.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Rien de prévu dans les sept prochains jours.</p>
            ) : (
              <ul className="m-0 mt-2 list-none p-0">
                {d.semaine.map((e) => (
                  <li key={e.cle} className="ligne items-start">
                    <span className="min-w-0 flex-1">
                      <span className="sourcil mb-0.5">{e.jour}</span>
                      <span className="block font-semibold">{e.titre}</span>
                      <span className="meta">{e.genre}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.suggestion ? (
            <section className="panneau entree-section" style={{ "--delai": "300ms" } as React.CSSProperties} aria-labelledby="pourquoi">
              <h2 id="pourquoi" className="titre-section m-0">
                Pourquoi cette révision ?
              </h2>
              <p className="m-0 mt-2 font-semibold">{d.suggestion.notion}</p>
              <p className="meta m-0 mt-1">{d.suggestion.cours}</p>
              <p className="m-0 mt-3 flex gap-2 text-[0.8125rem]">
                <Lightbulb size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                {d.suggestion.explication}
              </p>
              <Link href="/app/reviser" className="bouton bouton-secondaire mt-4">
                Réviser maintenant
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BlocReprise({ d }: { d: DonneesAccueil }) {
  const contenu = d.premiereVisite
    ? {
        sourcil: "Bienvenue",
        titre: "Trois repères pour bien démarrer.",
        texte: "Tes cours, ta classe et tes échéances, en deux minutes. Tu peux passer cette étape.",
        lien: "/app/bienvenue",
        action: "Commencer",
        meta: null as string | null,
      }
    : d.reprise
      ? {
          sourcil: d.reprise.dejaLue ? "Ton prochain petit pas" : "Nouveau cours",
          titre: "Un petit pas. Un vrai progrès.",
          texte: d.reprise.objectif ? `${d.reprise.titre} — ${d.reprise.objectif}` : d.reprise.titre,
          lien: `/app/seances/${d.reprise.id}`,
          action: d.reprise.dejaLue ? "Reprendre ma séance" : "Ouvrir la séance",
          meta: d.reprise.contexte,
        }
      : {
          sourcil: "Pour commencer",
          titre: "Un petit pas. Un vrai progrès.",
          texte: "Aucune séance publiée pour l'instant. Dès qu'un professeur en publiera une, elle apparaîtra ici.",
          lien: "/app/cours",
          action: "Voir mes cours",
          meta: null,
        };
  return (
    <section
      className="entree-section relative grid min-h-[260px] overflow-hidden rounded-[16px] bg-[color:var(--color-rose-clair)] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)]"
      aria-labelledby="reprendre"
    >
      <div className="relative z-[1] p-6 sm:p-8">
        <span className="sourcil">{contenu.sourcil}</span>
        <h2 id="reprendre" className="m-0 mt-1 max-w-[16ch] text-[1.75rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.125rem]">
          {contenu.titre}
        </h2>
        <p className="m-0 mt-3 max-w-[44ch] text-[color:var(--color-accent-fonce)]">{contenu.texte}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={contenu.lien} className="bouton bouton-rose">
            {contenu.action} <ArrowRight {...ICONE} className="fleche" />
          </Link>
          {contenu.meta ? <span className="meta">{contenu.meta}</span> : null}
        </div>
      </div>
      {/* Le ruban n'occupe que la colonne droite : il ne passe jamais sous le texte ni sous le bouton. */}
      <RubanStudy composition="fragment" className="ruban-flotte hidden min-h-[200px] sm:block" controle={false} />
    </section>
  );
}

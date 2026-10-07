import Link from "next/link";
import { ArrowRight, CalendarDays, HandHelping, Lightbulb, MessageCircle, Users } from "lucide-react";
import { CaseFaite } from "@/components/app/CaseFaite";
import { ICONE, dateLisible } from "@/components/study/ui";

/**
 * A02 — Accueil élève, R2 (cahier §07).
 *
 * « Bonjour, prénom » puis, dans l'ordre : À faire en premier (trois au plus,
 * par échéance), Reprendre un cours, Questions de classe ; ensuite les cours
 * et la semaine. Aucun compteur de progression, aucun classement, aucun
 * bandeau de motivation.
 *
 * Composant de présentation : il ne lit rien. La page le nourrit avec des
 * données déjà filtrées par la base sous le jeton de l'élève ; les aperçus de
 * développement le nourrissent avec des données fictives. Chaque bloc a son
 * état vide, et un bloc sans objet réel n'invente rien.
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

function sigle(matiere: string) {
  const mots = matiere.split(/[\s-]+/u).filter(Boolean);
  return (mots.length > 1 ? `${mots[0]![0]}${mots[1]![0]}` : matiere.slice(0, 2)).toUpperCase();
}

function TitreBloc({ id, children, lien }: { id: string; children: React.ReactNode; lien?: { href: string; libelle: string } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="m-0 text-[1.25rem] font-extrabold tracking-[-0.02em]">
        {children}
      </h2>
      {lien ? (
        <Link href={lien.href} className="lien-fleche text-[0.9375rem]">
          {lien.libelle}
        </Link>
      ) : null}
    </div>
  );
}

export function AccueilEleve({ d }: { d: DonneesAccueil }) {
  return (
    <div className="accueil">
      <header className="mb-6">
        <h1 className="titre-page m-0">{d.prenom ? `${d.salut}, ${d.prenom}` : "Ton espace"}</h1>
        <p className="m-0 mt-1 text-[1rem] text-[color:var(--color-encre-faible)] first-letter:uppercase">{d.dateLibelle}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <section className="panneau" aria-labelledby="a-faire">
            <TitreBloc id="a-faire" lien={{ href: "/app/devoirs", libelle: "Voir tout" }}>
              À faire en premier
            </TitreBloc>
            {d.taches.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Rien à rendre pour le moment.</p>
            ) : (
              <ul className="m-0 mt-4 grid list-none gap-2 p-0">
                {d.taches.slice(0, 3).map((t) => (
                  <li key={t.id} className="flex min-w-0 items-center gap-3 rounded-[12px] border border-[color:var(--color-bordure)] px-3 py-3">
                    <CaseFaite devoir={t.id} fait={false} libelle={t.titre} />
                    <Link href={`/app/devoirs/${t.id}`} className="min-w-0 flex-1 no-underline">
                      <span className="line-clamp-2 block font-bold text-[color:var(--color-encre)]">{t.titre}</span>
                      <span className="meta block">
                        {t.matiere} · {t.echeance}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <BlocReprise d={d} />

          <section className="panneau" aria-labelledby="tes-cours">
            <TitreBloc id="tes-cours" lien={{ href: "/app/cours", libelle: "Tous mes cours" }}>
              Tes cours
            </TitreBloc>
            {d.cours.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Tes cours apparaîtront ici dès qu&apos;un professeur les aura ouverts.</p>
            ) : (
              <ul className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
                {d.cours.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/cours/${c.id}`}
                      className="carte-souleve flex min-h-[64px] items-center gap-3 rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-3 py-2.5 no-underline"
                    >
                      <span className="livre" aria-hidden="true">
                        {sigle(c.matiere)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-snug text-[color:var(--color-encre)] [overflow-wrap:anywhere]">{c.matiere}</span>
                        <span className="meta block truncate">{c.libelle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <section className="panneau" aria-labelledby="questions">
            <TitreBloc id="questions" lien={{ href: "/app/classe", libelle: "Ma classe" }}>
              Questions de classe
            </TitreBloc>
            {d.enDirect ? (
              <div className="mt-3 flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]" aria-hidden="true">
                  <MessageCircle size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 font-bold">{d.enDirect.titre}</p>
                  <p className="meta m-0 mt-1 line-clamp-2">
                    {d.enDirect.sujet} · {d.enDirect.quand}
                  </p>
                  <Link href={d.enDirect.lien} className="lien-fleche mt-2 inline-flex text-[0.9375rem]">
                    Ouvrir la discussion <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" className="fleche" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">
                Rien de neuf depuis ta dernière visite.{" "}
                <Link href="/app/messagerie" className="font-semibold text-[color:var(--color-accent)]">
                  Ouvrir le salon
                </Link>
              </p>
            )}
            {d.consultation ? (
              <div className="mt-4 rounded-[12px] bg-[color:var(--color-rose-clair)] p-4">
                <p className="m-0 font-bold">{d.consultation.titre}</p>
                <p className="meta m-0 mt-1">
                  Consultation de la classe
                  {d.consultation.fermeLe ? ` · jusqu'au ${dateLisible(d.consultation.fermeLe, { day: "numeric", month: "long" })}` : ""}
                </p>
                <Link href={d.consultation.lien} className="bouton bouton-primaire mt-3">
                  Donner mon avis
                </Link>
              </div>
            ) : null}
          </section>

          <section className="panneau" aria-labelledby="semaine">
            <TitreBloc id="semaine" lien={{ href: "/app/agenda", libelle: "Agenda" }}>
              Cette semaine
            </TitreBloc>
            {d.semaine === null ? (
              <p role="alert" className="m-0 mt-3 text-[color:var(--color-erreur)]">
                L&apos;agenda n&apos;a pas pu être chargé. Recharge la page pour réessayer.
              </p>
            ) : d.semaine.length === 0 ? (
              <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">Rien de prévu dans les sept prochains jours.</p>
            ) : (
              <ul className="m-0 mt-2 list-none p-0">
                {d.semaine.map((e) => (
                  <li key={e.cle} className="ligne items-start">
                    <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">{e.jour}</span>
                      <span className="block font-bold">{e.titre}</span>
                      <span className="meta">{e.genre}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.suggestion ? (
            <section className="panneau" aria-labelledby="pourquoi">
              <TitreBloc id="pourquoi">Réviser</TitreBloc>
              <p className="m-0 mt-2 font-bold">{d.suggestion.notion}</p>
              <p className="meta m-0 mt-1">{d.suggestion.cours}</p>
              <p className="m-0 mt-3 flex gap-2 text-[0.9375rem]">
                <Lightbulb size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                {d.suggestion.explication}
              </p>
              <Link href="/app/reviser" className="bouton bouton-secondaire mt-4">
                Réviser maintenant
              </Link>
            </section>
          ) : (
            <section className="panneau" aria-labelledby="ensemble">
              <TitreBloc id="ensemble">Réviser ensemble</TitreBloc>
              {d.ensemble ? (
                <>
                  <p className="m-0 mt-2 font-bold">{d.ensemble.titre}</p>
                  <p className="meta m-0 mt-1">
                    {d.ensemble.debut} · {d.ensemble.inscrits} inscrit{d.ensemble.inscrits > 1 ? "s" : ""} sur {d.ensemble.capacite}
                  </p>
                  <Link href={d.ensemble.lien} className="bouton bouton-secondaire mt-4">
                    <Users {...ICONE} /> Voir la séance
                  </Link>
                </>
              ) : (
                <>
                  <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">Aucune révision collective prévue. Bloqué sur un exercice ?</p>
                  <Link href="/app/aide" className="bouton bouton-secondaire mt-4">
                    <HandHelping {...ICONE} /> Débloque-moi
                  </Link>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function BlocReprise({ d }: { d: DonneesAccueil }) {
  const contenu = d.premiereVisite
    ? {
        titre: "Bienvenue dans ton espace",
        texte: "Tes cours, ta classe et tes échéances : trois repères pour bien démarrer." as string | null,
        lien: "/app/bienvenue",
        action: "Commencer",
        meta: null as string | null,
      }
    : d.reprise
      ? {
          titre: d.reprise.titre,
          texte: d.reprise.objectif,
          lien: `/app/seances/${d.reprise.id}`,
          action: d.reprise.dejaLue ? "Reprendre" : "Ouvrir la séance",
          meta: d.reprise.contexte,
        }
      : {
          titre: "Aucune séance publiée pour l'instant",
          texte: "Dès qu'un professeur en publiera une, elle apparaîtra ici.",
          lien: "/app/cours",
          action: "Voir mes cours",
          meta: null,
        };
  return (
    <section className="panneau panneau-rose" aria-labelledby="reprendre">
      <p className="m-0 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">
        {d.premiereVisite ? "Premiers pas" : "Reprendre un cours"}
      </p>
      <h2 id="reprendre" className="m-0 mt-2 text-[1.375rem] font-extrabold tracking-[-0.02em]">
        {contenu.titre}
      </h2>
      {contenu.meta ? <p className="meta m-0 mt-1">{contenu.meta}</p> : null}
      {contenu.texte ? <p className="m-0 mt-2 max-w-[56ch]">{contenu.texte}</p> : null}
      <Link href={contenu.lien} className="bouton bouton-primaire mt-4">
        {contenu.action} <ArrowRight {...ICONE} className="fleche" />
      </Link>
    </section>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { EnTetePage, EtatErreur, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { idRequete } from "@/lib/v6/contexte";
import type { agenda } from "@/lib/v6/eleve";
import { supprimerEvenement } from "./actions";
import { FormulaireEvenement } from "./FormulaireEvenement";

const TYPES: Record<string, { libelle: string; ton: "rose" | "attention" | "succes" | "neutre" }> = {
  controle: { libelle: "Contrôle", ton: "attention" },
  rendu: { libelle: "À rendre", ton: "rose" },
  cours: { libelle: "Cours", ton: "neutre" },
  revision: { libelle: "Révision", ton: "succes" },
  creneau: { libelle: "Créneau perso", ton: "neutre" },
  vie_de_classe: { libelle: "Vie de classe", ton: "rose" },
};

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAgenda({ debut, fin, evenements, cibles }: { debut: Date; fin: Date; evenements: Awaited<ReturnType<typeof agenda>>; cibles: readonly { valeur: string; libelle: string }[] }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  // Le jour se lit dans le fuseau de l'élève, pas en UTC (un contrôle à 0 h 30 reste le bon jour).
  const jourParis = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
  const jours = Array.from({ length: 5 }, (_, i) => new Date(debut.getTime() + i * 86_400_000));
  const weekend = (evenements ?? []).filter((e) => !jours.some((j) => jourParis(j) === jourParis(new Date(e.debut))));

  const ligneEvenement = (e: NonNullable<typeof evenements>[number]) => (
    <li key={`${e.kind}-${e.id}`} className="border-l-[3px] border-[color:var(--color-accent)] bg-[color:var(--color-surface)] py-1.5 pl-3 pr-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.8125rem] font-bold tabular-nums">{new Date(e.debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}</span>
        <Etiquette ton={TYPES[e.kind]?.ton ?? "neutre"}>{TYPES[e.kind]?.libelle ?? e.kind}</Etiquette>
      </span>
      {e.lien ? (
        <Link href={e.lien} className="mt-1 block font-semibold text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
          {e.titre}
        </Link>
      ) : (
        <span className="mt-1 block font-semibold">{e.titre}</span>
      )}
      {e.contexte ? <span className="meta block">{e.contexte}</span> : null}
      {e.modifiable ? (
        <form action={supprimerEvenement} className="mt-1">
          <input type="hidden" name="evenement" value={e.id} />
          <button type="submit" className="meta inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 underline" aria-label={`Supprimer « ${e.titre} »`}>
            <Trash2 size={12} strokeWidth={1.75} aria-hidden="true" /> Supprimer
          </button>
        </form>
      ) : null}
    </li>
  );

  return (
    <>
      <EnTetePage
        sourcil="Agenda"
        titre={`Semaine du ${dateLisible(debut.toISOString(), { day: "numeric", month: "long" })}`}
        sousTitre="Contrôles, rendus, cours et créneaux · heure de Paris"
        actions={
          <nav aria-label="Changer de semaine" className="flex gap-2">
            <Link href={`/app/agenda?semaine=${iso(new Date(debut.getTime() - 7 * 86_400_000))}`} className="bouton bouton-secondaire" aria-label="Semaine précédente">
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link href="/app/agenda" className="bouton bouton-secondaire">
              Cette semaine
            </Link>
            <Link href={`/app/agenda?semaine=${iso(fin)}`} className="bouton bouton-secondaire" aria-label="Semaine suivante">
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </nav>
        }
      />
      {evenements === null ? (
        <EtatErreur requestId={idRequete()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 md:grid-cols-5">
            {jours.map((j) => {
              const duJour = evenements.filter((e) => jourParis(new Date(e.debut)) === jourParis(j));
              const aujourdhui = jourParis(j) === jourParis(new Date());
              return (
                <section key={iso(j)} className="panneau min-h-[96px] p-3 md:min-h-[260px] md:p-3" aria-label={dateLisible(j.toISOString(), { weekday: "long", day: "numeric", month: "long" })}>
                  <h2 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-[0.875rem] font-extrabold ${aujourdhui ? "bg-[color:var(--color-accent)] text-white" : "text-[color:var(--color-encre)]"}`}>
                      {dateLisible(j.toISOString(), { day: "numeric" })}
                    </span>
                    {dateLisible(j.toISOString(), { weekday: "long" })}
                    {aujourdhui ? <span className="sr-only">(aujourd&apos;hui)</span> : null}
                  </h2>
                  {duJour.length === 0 ? <p className="meta m-0">Rien de prévu.</p> : <ul className="m-0 grid list-none gap-2 p-0">{duJour.map(ligneEvenement)}</ul>}
                </section>
              );
            })}
            {weekend.length > 0 ? (
              <section className="panneau p-3 md:col-span-5">
                <h2 className="mb-3 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">Week-end</h2>
                <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-3">{weekend.map(ligneEvenement)}</ul>
              </section>
            ) : null}
          </div>
          <Panneau titre="Ajouter un événement" as="aside" className="border-0 bg-[color:var(--color-rose-clair)]">
            <FormulaireEvenement cibles={cibles} />
            <p className="meta m-0 mt-3">Un créneau personnel n&apos;est visible que de toi. Un événement de classe ne porte jamais de contenu privé.</p>
          </Panneau>
        </div>
      )}
    </>
  );
}

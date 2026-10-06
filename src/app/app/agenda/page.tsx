import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { EnTetePage, EtatErreur, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { agenda } from "@/lib/v6/eleve";
import { supprimerEvenement } from "./actions";
import { FormulaireEvenement } from "./FormulaireEvenement";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const TYPES: Record<string, { libelle: string; ton: "rose" | "attention" | "succes" | "neutre" }> = {
  controle: { libelle: "Contrôle", ton: "attention" },
  rendu: { libelle: "À rendre", ton: "rose" },
  cours: { libelle: "Cours", ton: "neutre" },
  revision: { libelle: "Révision", ton: "succes" },
  creneau: { libelle: "Créneau perso", ton: "neutre" },
  vie_de_classe: { libelle: "Vie de classe", ton: "rose" },
};

function lundi(d: Date): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - jour);
  return r;
}

/**
 * E16 — Agenda : la semaine de cinq jours sur ordinateur, une liste sur
 * téléphone. Contrôles, rendus et créneaux sont distingués par un libellé
 * (la couleur n'est qu'un appui). On ne modifie que ses propres événements.
 * Fuseau affiché : Europe/Paris.
 */
export default async function PageAgenda({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const ctx = await contexteApp();
  const { semaine } = await searchParams;
  const base = semaine && /^\d{4}-\d{2}-\d{2}$/u.test(semaine) ? new Date(`${semaine}T12:00:00Z`) : new Date();
  const debut = new Date(lundi(base).getTime() + 12 * 3_600_000);
  const fin = new Date(debut.getTime() + 7 * 86_400_000);
  // Fenêtre élargie : lundi 0 h à Paris précède midi UTC de quatorze heures au plus.
  const evenements = await agenda(ctx.jeton, new Date(debut.getTime() - 14 * 3_600_000), new Date(fin.getTime() - 12 * 3_600_000));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  // Le jour se lit dans le fuseau de l'élève, pas en UTC (un contrôle à 0 h 30 reste le bon jour).
  const jourParis = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
  const jours = Array.from({ length: 5 }, (_, i) => new Date(debut.getTime() + i * 86_400_000));
  const weekend = (evenements ?? []).filter((e) => !jours.some((j) => jourParis(j) === jourParis(new Date(e.debut))));

  // Cibles collectives : seulement celles que l'équipe pédagogique peut renseigner.
  const cibles: { valeur: string; libelle: string }[] = [{ valeur: "moi", libelle: "Moi seulement" }];
  if (ctx.roles.professeur) {
    const { data } = await clientUtilisateur(ctx.jeton).rpc("mes_cours");
    for (const c of (data ?? []) as { id: string; matiere: string; classe: string | null; enseigne: boolean }[]) {
      if (c.enseigne) cibles.push({ valeur: `espace:${c.id}`, libelle: `${c.matiere}${c.classe ? ` — ${c.classe}` : ""}` });
    }
  }

  const ligneEvenement = (e: NonNullable<typeof evenements>[number]) => (
    <li key={`${e.kind}-${e.id}`} className="rounded-[8px] bg-[color:var(--color-surface-douce)] p-2.5">
      <span className="flex flex-wrap items-center gap-1.5">
        <Etiquette ton={TYPES[e.kind]?.ton ?? "neutre"}>{TYPES[e.kind]?.libelle ?? e.kind}</Etiquette>
        <span className="meta">{new Date(e.debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}</span>
      </span>
      {e.lien ? (
        <Link href={e.lien} className="mt-1 block font-semibold">
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
        titre="Agenda"
        sousTitre={`Semaine du ${dateLisible(debut.toISOString(), { day: "numeric", month: "long" })} · heure de Paris`}
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
              return (
                <section key={iso(j)} className="panneau min-h-[120px] p-3 md:min-h-[260px] md:p-3" aria-label={dateLisible(j.toISOString(), { weekday: "long", day: "numeric", month: "long" })}>
                  <h2 className="sourcil">{dateLisible(j.toISOString(), { weekday: "short", day: "numeric" })}</h2>
                  {duJour.length === 0 ? <p className="meta m-0">—</p> : <ul className="m-0 grid list-none gap-2 p-0">{duJour.map(ligneEvenement)}</ul>}
                </section>
              );
            })}
            {weekend.length > 0 ? (
              <section className="panneau p-3 md:col-span-5">
                <h2 className="sourcil">Week-end</h2>
                <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-3">{weekend.map(ligneEvenement)}</ul>
              </section>
            ) : null}
          </div>
          <Panneau titre="Ajouter" as="aside">
            <FormulaireEvenement cibles={cibles} />
            <p className="meta m-0 mt-3">Un créneau personnel n&apos;est visible que de toi. Un événement de classe ne porte jamais de contenu privé.</p>
          </Panneau>
        </div>
      )}
    </>
  );
}

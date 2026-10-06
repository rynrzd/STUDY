import Link from "next/link";
import { BookmarkCheck, HandHelping } from "lucide-react";
import { EnTetePage, EtatErreur, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { rattrapage } from "@/lib/v6/cours";
import { basculerRepere } from "../seances/actions";

export const metadata = { title: "Rattraper une absence" };
export const dynamic = "force-dynamic";

/** Minuit à Paris pour une date AAAA-MM-JJ, en ISO. */
function minuitParis(jour: string): string {
  const midi = new Date(`${jour}T12:00:00Z`);
  const decalage = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(midi)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const heures = Number(decalage.replace("GMT", "") || "0");
  return new Date(Date.parse(`${jour}T00:00:00Z`) - heures * 3_600_000).toISOString();
}

/**
 * E22 — Rattrapage : ce qui a été publié pendant une période, par matière.
 * Un filtre réel sur les dates ; aucune gestion d'absence, aucun
 * justificatif : un repère « relu » à titre personnel.
 */
export default async function PageRattrapage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const du = q.du && /^\d{4}-\d{2}-\d{2}$/u.test(q.du) ? q.du : null;
  const au = q.au && /^\d{4}-\d{2}-\d{2}$/u.test(q.au) ? q.au : null;
  const erreurDates = du && au && du > au ? "La date de fin doit suivre la date de début." : du && au && (Date.parse(au) - Date.parse(du)) / 86_400_000 > 62 ? "Choisis une période de deux mois au plus." : null;
  const lignes = du && au && !erreurDates ? await rattrapage(ctx.jeton, minuitParis(du), new Date(Date.parse(minuitParis(au)) + 86_400_000).toISOString()) : null;
  const relus =
    lignes && lignes.length > 0
      ? new Set(
          (((await clientUtilisateur(ctx.jeton).from("reperes_seance").select("lesson_id").eq("kind", "relu").in("lesson_id", lignes.map((l) => l.id))).data ?? []) as { lesson_id: string }[]).map(
            (r) => r.lesson_id,
          ),
        )
      : new Set<string>();
  const parMatiere = new Map<string, NonNullable<typeof lignes>>();
  for (const l of lignes ?? []) {
    const m = l.teaching_spaces?.subjects?.label ?? "Cours";
    parMatiere.set(m, [...(parMatiere.get(m) ?? []), l]);
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <EnTetePage filAriane={[{ href: "/app/cours", libelle: "Mes cours" }]} titre="Rattraper une absence" sousTitre="Retrouve tout ce qui a été publié dans tes cours pendant une période." />
      <form method="get" className="panneau mb-6 flex flex-wrap items-end gap-3" noValidate>
        <div>
          <label htmlFor="du" className="mb-1.5 block text-[0.8125rem] font-semibold">
            Du
          </label>
          <input id="du" name="du" type="date" className="champ" defaultValue={du ?? ""} max={aujourdhui} aria-invalid={erreurDates ? true : undefined} aria-describedby={erreurDates ? "erreur-dates" : undefined} required />
        </div>
        <div>
          <label htmlFor="au" className="mb-1.5 block text-[0.8125rem] font-semibold">
            Au
          </label>
          <input id="au" name="au" type="date" className="champ" defaultValue={au ?? aujourdhui} max={aujourdhui} aria-invalid={erreurDates ? true : undefined} aria-describedby={erreurDates ? "erreur-dates" : undefined} required />
        </div>
        <button type="submit" className="bouton bouton-primaire">
          Afficher
        </button>
        {erreurDates ? (
          <p id="erreur-dates" role="alert" className="m-0 w-full text-[0.8125rem] font-medium text-[color:var(--color-erreur)]">
            {erreurDates}
          </p>
        ) : null}
      </form>

      {lignes === null && du && au && !erreurDates ? <EtatErreur requestId={idRequete()} /> : null}
      {lignes && lignes.length === 0 ? <EtatVide titre="Rien de publié sur cette période" texte="Aucune séance n'a été publiée dans tes cours entre ces deux dates." /> : null}
      <div className="grid gap-6">
        {[...parMatiere.entries()].map(([matiere, seances]) => (
          <Panneau key={matiere} titre={matiere}>
            <ul className="m-0 list-none p-0">
              {seances.map((s) => (
                <li key={s.id} className="ligne">
                  <Link href={`/app/seances/${s.id}`} className="min-w-0 flex-1 no-underline">
                    <span className="block font-semibold text-[color:var(--color-encre)]">{s.title}</span>
                    <span className="meta">Publiée le {dateLisible(s.published_at)}</span>
                  </Link>
                  <form action={basculerRepere}>
                    <input type="hidden" name="seance" value={s.id} />
                    <input type="hidden" name="kind" value="relu" />
                    <input type="hidden" name="actif" value={relus.has(s.id) ? "non" : "oui"} />
                    <button type="submit" className={`bouton bouton-compact ${relus.has(s.id) ? "bouton-secondaire" : "bouton-discret"}`} aria-pressed={relus.has(s.id)}>
                      <BookmarkCheck size={14} strokeWidth={1.75} aria-hidden="true" /> {relus.has(s.id) ? "Relue" : "Marquer relue"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Panneau>
        ))}
      </div>
      {lignes && lignes.length > 0 && ctx.classeActive ? (
        <p className="mt-6">
          <Link href={`/app/classes/${ctx.classeActive.classe}`} className="bouton bouton-secondaire">
            <HandHelping {...ICONE} /> Demander une séance d&apos;entraide à la classe
          </Link>
        </p>
      ) : null}
    </div>
  );
}

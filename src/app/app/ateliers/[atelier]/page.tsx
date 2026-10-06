import { AccesIndisponible, EnTetePage, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { FormulaireReponseAtelier } from "../formulaires";

export const metadata = { title: "Atelier" };
export const dynamic = "force-dynamic";

/** E38/E39 côté élève : sources datées, annotation justifiée, corrigé après clôture, contestation. */
export default async function PageAtelier({ params }: { params: Promise<{ atelier: string }> }) {
  const ctx = await contexteApp();
  const { atelier: id } = await params;
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const [a, corrige, reponse] = await Promise.all([
    client.from("ateliers").select("id, kind, titre, question, consigne, sources, texte_examine, etat, synthese").eq("id", id).maybeSingle(),
    client.from("ateliers_corriges").select("corrige").eq("atelier_id", id).maybeSingle(),
    client.from("ateliers_reponses").select("annotations, contestation, version").eq("atelier_id", id).eq("author_id", ctx.personne.profileId).maybeSingle(),
  ]);
  const at = a.data as {
    kind: "actualite" | "verifier_ia";
    titre: string;
    question: string;
    consigne: string | null;
    sources: { titre: string; auteur: string; date: string; url: string; extrait: string }[];
    texte_examine: string | null;
    etat: string;
    synthese: string | null;
  } | null;
  if (at === null || at.etat === "brouillon") return <AccesIndisponible retour="/app/cours" />;
  const r = reponse.data as { annotations: { passage?: string; affirmation?: string; categorie: string; justification: string; source: number | null }[]; version: number } | null;
  const clos = at.etat === "clos";

  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage sourcil={at.kind === "actualite" ? "Atelier actualité" : "Vérifier une réponse d'IA"} titre={at.titre} sousTitre={at.question} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          {at.consigne ? <Panneau titre="Consigne"><p className="m-0 whitespace-pre-line">{at.consigne}</p></Panneau> : null}
          {at.texte_examine ? (
            <Panneau titre="Texte à vérifier">
              <p className="lecture m-0 whitespace-pre-line">{at.texte_examine}</p>
              <p className="meta m-0 mt-2">Un exemple choisi par ton professeur. Personne ne prétend savoir qui ou quoi l&apos;a écrit.</p>
            </Panneau>
          ) : null}
          <Panneau titre="Sources">
            <ul className="m-0 grid list-none gap-3 p-0">
              {at.sources.map((s, i) => (
                <li key={i} className="rounded-[10px] border border-[color:var(--color-bordure)] p-3">
                  <p className="m-0 font-semibold">{s.titre}</p>
                  <p className="meta m-0">
                    {s.auteur}
                    {s.date ? ` · ${dateLisible(s.date)}` : ""}
                  </p>
                  {s.extrait ? <p className="m-0 mt-2 text-[0.875rem]">{s.extrait}</p> : null}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="meta break-all">
                      {s.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
        <div className="grid content-start gap-4">
          {clos && corrige.data ? (
            <Panneau titre="Corrigé">
              <p className="m-0 whitespace-pre-line">{(corrige.data as { corrige: string }).corrige}</p>
            </Panneau>
          ) : null}
          {at.synthese ? <Panneau titre="Synthèse du professeur"><p className="m-0 whitespace-pre-line">{at.synthese}</p></Panneau> : null}
          <Panneau titre="Ma réponse">
            <div className="mb-3">
              <Etiquette>{clos ? "Atelier clos" : "Réponse individuelle, lue par ton professeur"}</Etiquette>
            </div>
            <FormulaireReponseAtelier
              atelier={id}
              kind={at.kind}
              version={r?.version ?? 0}
              clos={clos}
              sources={at.sources}
              initiales={(r?.annotations ?? []).map((x) => ({ passage: x.passage ?? x.affirmation ?? "", categorie: x.categorie, justification: x.justification, source: x.source ?? null }))}
            />
          </Panneau>
        </div>
      </div>
    </div>
  );
}

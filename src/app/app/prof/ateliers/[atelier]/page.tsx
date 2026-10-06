import Link from "next/link";
import { AccesIndisponible, EnTetePage, Etiquette, Panneau } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { changerEtatAtelier } from "../../../ateliers/actions";
import { FormulaireSyntheseAtelier } from "../../../ateliers/formulaires";

export const metadata = { title: "Atelier" };
export const dynamic = "force-dynamic";

const CATS: Record<string, string> = { fait: "Fait", interpretation: "Interprétation", opinion: "Opinion", etaye: "Étayé", a_verifier: "À vérifier", contredit: "Contredit" };

export default async function PageAtelierProf({ params, searchParams }: { params: Promise<{ atelier: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const ctx = await contexteApp();
  const { atelier: id } = await params;
  const { erreur } = await searchParams;
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const [a, reponses] = await Promise.all([
    client.from("ateliers").select("id, kind, titre, question, consigne, sources, texte_examine, etat, synthese, teaching_space_id").eq("id", id).maybeSingle(),
    client.from("ateliers_reponses").select("author_id, annotations, contestation, updated_at").eq("atelier_id", id),
  ]);
  const at = a.data as {
    id: string;
    kind: "actualite" | "verifier_ia";
    titre: string;
    question: string;
    consigne: string | null;
    sources: { titre: string; auteur: string; date: string; url: string; extrait: string }[];
    texte_examine: string | null;
    etat: string;
    synthese: string | null;
  } | null;
  if (at === null) return <AccesIndisponible retour="/app/prof/ateliers" />;
  const lignes = (reponses.data ?? []) as { author_id: string; annotations: { passage?: string; categorie: string; justification: string }[]; contestation: string | null }[];
  const noms = await nomsAffichables(ctx.jeton, lignes.map((l) => l.author_id));

  return (
    <>
      <EnTetePage filAriane={[{ href: "/app/prof/ateliers", libelle: "Ateliers" }]} titre={at.titre} sousTitre={at.question} />
      {erreur ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-[color:var(--color-erreur-fond)] p-3 text-[color:var(--color-erreur)]">
          {erreur === "sources" ? "Pour publier : deux à cinq sources datées (actualité), ou un texte à vérifier." : "Ce changement d'état n'est pas possible."}
        </p>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Etiquette ton={at.etat === "publie" ? "succes" : "attention"}>{at.etat === "publie" ? "Publié" : at.etat === "clos" ? "Clos" : "Brouillon"}</Etiquette>
        {at.etat !== "clos" ? (
          <form action={changerEtatAtelier}>
            <input type="hidden" name="atelier" value={id} />
            <input type="hidden" name="etat" value={at.etat === "brouillon" ? "publie" : "clos"} />
            <button type="submit" className="bouton bouton-primaire bouton-compact">
              {at.etat === "brouillon" ? "Publier aux élèves" : "Clore et montrer le corrigé"}
            </button>
          </form>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="grid content-start gap-6">
          <Panneau titre={`Réponses (${lignes.length})`}>
            {lignes.length === 0 ? <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune réponse pour l&apos;instant.</p> : null}
            {lignes.map((l) => (
              <section key={l.author_id} className="border-b border-[color:var(--color-bordure)] py-3 last:border-0">
                <p className="m-0 font-semibold">{noms.get(l.author_id)?.affichage ?? "Élève"}</p>
                <ul className="m-0 mt-1 grid gap-1 pl-5 text-[0.875rem]">
                  {l.annotations.map((x, i) => (
                    <li key={i}>
                      « {x.passage} » — <strong>{CATS[x.categorie] ?? x.categorie}</strong> : {x.justification}
                    </li>
                  ))}
                </ul>
                {l.contestation ? <p className="m-0 mt-2 rounded-[8px] bg-[color:var(--color-attention-fond)] p-2 text-[0.875rem]">Contestation : {l.contestation}</p> : null}
              </section>
            ))}
            <p className="meta m-0 mt-3">Aucune note : les opinions ne sont pas évaluées, seule la justification par une source compte.</p>
          </Panneau>
          {at.etat !== "brouillon" ? (
            <Panneau titre="Synthèse">
              <FormulaireSyntheseAtelier atelier={id} synthese={at.synthese ?? ""} />
            </Panneau>
          ) : null}
        </div>
        {at.etat === "brouillon" ? (
          <Panneau titre="Brouillon" as="aside">
            <p className="m-0 text-[color:var(--color-encre-faible)]">Reprenez l&apos;assistant à l&apos;étape voulue ; le brouillon est enregistré à chacune.</p>
            <ol className="m-0 mt-3 grid gap-1 pl-5">
              {["Objectif", "Sources datées", "Consignes", "Corrigé et publication"].map((e, i) => (
                <li key={e}>
                  <Link href={`/app/prof/ateliers/${id}/assistant?etape=${i + 1}`}>{e}</Link>
                </li>
              ))}
            </ol>
          </Panneau>
        ) : (
          <Panneau titre="Sources" as="aside">
            <ul className="m-0 grid gap-2 pl-5 text-[0.875rem]">
              {at.sources.map((s, i) => (
                <li key={i}>
                  {s.titre} — {s.auteur} {s.date ? `(${s.date})` : ""}
                </li>
              ))}
            </ul>
          </Panneau>
        )}
      </div>
    </>
  );
}

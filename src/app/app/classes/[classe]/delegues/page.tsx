import Link from "next/link";
import {
  FormulaireChangerDecision,
  FormulaireConsultation,
  FormulaireDecision,
  FormulaireSynthese,
} from "@/components/study/classe-formulaires";
import { AccesIndisponible, AvisVisibilite, Etiquette, Panneau, dateHeure } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { consultations, decisions, droits as lireDroits, nomsAffichables, STATUTS_DECISION, TRANSITIONS_DECISION } from "@/lib/v6/classe";
import { changerEtatConsultation, preparerSynthese } from "../../../classes/actions";

export const metadata = { title: "Bureau des délégués" };
export const dynamic = "force-dynamic";

const CATEGORIES: Record<string, string> = {
  charge: "Charge de travail",
  aide: "Besoin d'aide",
  projets: "Projets",
  vie_quotidienne: "Vie quotidienne",
};

/**
 * E12 — Bureau des délégués. Participation agrégée, sujets regroupés,
 * synthèse relue puis publiée, suivi des décisions avec motif, responsable et
 * date. Réservé aux délégués en mandat et au professeur principal ; un mandat
 * expiré ferme l'accès (CLASS-02).
 */
export default async function PageDelegues({ params }: { params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const droits = await lireDroits(ctx.jeton, classe);
  if (!droits.delegue && !droits.principal) return <AccesIndisponible retour={`/app/classes/${classe}`} />;

  const client = clientUtilisateur(ctx.jeton);
  const [lesConsultations, lesDecisions] = await Promise.all([consultations(ctx.jeton, classe), decisions(ctx.jeton, classe)]);
  const courante = lesConsultations.find((c) => ["ouverte", "close", "synthetisee"].includes(c.etat)) ?? null;

  const [participation, reponses, synthese] = courante
    ? await Promise.all([
        client.rpc("consultation_participation", { p_consultation: courante.id }),
        client
          .from("consultation_reponses")
          .select("author_id, ce_qui_fonctionne, difficulte, proposition, categorie, updated_at")
          .eq("consultation_id", courante.id)
          .order("categorie"),
        client.from("consultation_syntheses").select("texte, etat, version").eq("consultation_id", courante.id).maybeSingle(),
      ])
    : [null, null, null];

  const part = ((participation?.data ?? []) as { reponses: number; effectif: number }[])[0];
  const lignes = (reponses?.data ?? []) as {
    author_id: string;
    ce_qui_fonctionne: string | null;
    difficulte: string | null;
    proposition: string | null;
    categorie: string;
    updated_at: string;
  }[];
  const noms = await nomsAffichables(ctx.jeton, lignes.map((l) => l.author_id));
  const parCategorie = Object.keys(CATEGORIES).map((cat) => ({ cat, lignes: lignes.filter((l) => l.categorie === cat) })).filter((g) => g.lignes.length > 0);
  const s = synthese?.data as { texte: string; etat: string; version: number } | null;

  return (
    <div className="grid gap-6">
      <AvisVisibilite>
        Les réponses ci-dessous sont nominatives et confidentielles : elles ne sortent pas de ce bureau. Le compte rendu publié à la classe
        ne doit contenir aucun nom ni détail personnel — rien n&apos;est publié sans votre relecture.
      </AvisVisibilite>

      <Panneau titre="Consultation" id={courante ? `consultation-${courante.id}` : "consultation"}>
        {courante === null ? (
          <>
            <p className="m-0 mb-4 text-[color:var(--color-encre-faible)]">Aucune consultation en cours. Préparez la prochaine :</p>
            <FormulaireConsultation classe={classe} />
            {lesConsultations
              .filter((c) => c.etat === "brouillon")
              .map((c) => (
                <form key={c.id} action={changerEtatConsultation} className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{c.titre}</span>
                  <Etiquette>Brouillon</Etiquette>
                  <input type="hidden" name="consultation" value={c.id} />
                  <input type="hidden" name="classe" value={classe} />
                  <input type="hidden" name="etat" value="ouverte" />
                  <input type="hidden" name="jours" value="7" />
                  <button type="submit" className="bouton bouton-primaire bouton-compact">
                    Ouvrir pour 7 jours
                  </button>
                </form>
              ))}
          </>
        ) : (
          <>
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{courante.titre}</span>
              <Etiquette ton={courante.etat === "ouverte" ? "succes" : "neutre"}>{courante.etat === "ouverte" ? "Ouverte" : courante.etat === "close" ? "Close" : "Synthèse en cours"}</Etiquette>
              {courante.fermeLe ? <span className="meta">jusqu&apos;au {dateHeure(courante.fermeLe)}</span> : null}
            </p>
            {part ? (
              <p className="m-0 mt-3">
                <span className="font-[family-name:var(--font-titre)] text-[1.75rem] font-bold">{part.reponses}</span>
                <span className="text-[color:var(--color-encre-faible)]"> réponse{part.reponses > 1 ? "s" : ""} sur {part.effectif} élèves</span>
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {courante.etat === "ouverte" ? (
                <form action={changerEtatConsultation}>
                  <input type="hidden" name="consultation" value={courante.id} />
                  <input type="hidden" name="classe" value={classe} />
                  <input type="hidden" name="etat" value="close" />
                  <button type="submit" className="bouton bouton-secondaire">
                    Clore la consultation
                  </button>
                </form>
              ) : (
                <form action={preparerSynthese}>
                  <input type="hidden" name="consultation" value={courante.id} />
                  <input type="hidden" name="classe" value={classe} />
                  <button type="submit" className="bouton bouton-secondaire">
                    {s ? "Regénérer le brouillon de synthèse" : "Préparer un brouillon de synthèse"}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </Panneau>

      {parCategorie.length > 0 ? (
        <Panneau titre="Sujets regroupés">
          <div className="grid gap-5">
            {parCategorie.map((g) => (
              <section key={g.cat}>
                <h3 className="titre-bloc mb-2">
                  {CATEGORIES[g.cat]} <span className="meta">({g.lignes.length})</span>
                </h3>
                <ul className="m-0 list-none p-0">
                  {g.lignes.map((l, i) => (
                    <li key={`${l.author_id}-${i}`} className="ligne items-start">
                      <span className="min-w-0 flex-1">
                        {l.proposition ? <span className="block">Proposition : {l.proposition}</span> : null}
                        {l.difficulte ? <span className="block">Difficulté : {l.difficulte}</span> : null}
                        {l.ce_qui_fonctionne ? <span className="block">Fonctionne : {l.ce_qui_fonctionne}</span> : null}
                        <span className="meta">{noms.get(l.author_id)?.affichage ?? "Élève"} · confidentiel</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panneau>
      ) : null}

      {courante && s && s.etat === "brouillon" ? (
        <Panneau titre="Compte rendu à relire">
          <FormulaireSynthese classe={classe} consultation={courante.id} texte={s.texte} version={s.version} />
        </Panneau>
      ) : null}

      <Panneau titre="Suivi des décisions">
        {lesDecisions.length === 0 ? <p className="m-0 mb-4 text-[color:var(--color-encre-faible)]">Aucun sujet suivi.</p> : null}
        <ul className="m-0 mb-5 list-none p-0">
          {lesDecisions.map((d) => (
            <li key={d.id} className="ligne block">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{d.titre}</span>
                <Etiquette ton={STATUTS_DECISION[d.statut]?.ton ?? "neutre"}>{STATUTS_DECISION[d.statut]?.libelle ?? d.statut}</Etiquette>
              </div>
              {d.explication ? <p className="meta m-0 mt-1">{d.explication}</p> : null}
              {d.responsable ? (
                <p className="meta m-0">
                  Responsable : {d.responsable}
                  {d.suiviLe ? ` · suivi le ${d.suiviLe}` : ""}
                </p>
              ) : null}
              <FormulaireChangerDecision classe={classe} decision={d.id} version={d.version} suivants={TRANSITIONS_DECISION[d.statut] ?? []} />
            </li>
          ))}
        </ul>
        <FormulaireDecision classe={classe} consultation={courante?.id} />
      </Panneau>

      <p className="meta m-0">
        Les votes restent consultatifs ; Study ne simule aucune élection officielle.{" "}
        <Link href={`/app/classes/${classe}`}>Retour à la vie de classe</Link>
      </p>
    </div>
  );
}

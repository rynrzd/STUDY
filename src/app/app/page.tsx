import { redirect } from "next/navigation";
import { AccueilEleve, type DonneesAccueil } from "@/components/study/accueil/AccueilEleve";
import { dateLisible } from "@/components/study/ui";
import { echeanceLisible, trierDevoirs } from "@/lib/echeances";
import { devoirsDeLEleve, coursDeLEleve } from "@/lib/espace-eleve";
import { travauxFaits } from "@/lib/parcours-eleve";
import { consultations } from "@/lib/v6/classe";
import { contexteApp } from "@/lib/v6/contexte";
import { agenda, decrireNotification, notifications, revisionsCollectives, seanceAReprendre } from "@/lib/v6/eleve";
import { suggestionsDeRevision } from "@/lib/v6/revision";

export const metadata = { title: "Aujourd'hui" };
export const dynamic = "force-dynamic";

/**
 * E01 — Aujourd'hui. Une prochaine action utile, sans surcharge : reprendre,
 * deux priorités, les cours, la classe. Aucun score, aucune fausse
 * progression : ce qui est affiché vient des données de l'élève, lues sous
 * son jeton. La mise en page vit dans `AccueilEleve`.
 */
export default async function PageAujourdhui() {
  const ctx = await contexteApp();
  if (!ctx.roles.eleve) {
    if (ctx.roles.professeur) redirect("/professeur");
    if (ctx.roles.admin) redirect("/admin");
    redirect("/app/reglages");
  }

  const maintenant = new Date();
  const dans7 = new Date(maintenant.getTime() + 7 * 86_400_000);
  const classe = ctx.classeActive?.classe ?? null;
  const [reprise, devoirs, faits, cours, semaine, nouvelles, revision, entraide, sondages, preferences] = await Promise.all([
    seanceAReprendre(ctx.jeton),
    devoirsDeLEleve(ctx.jeton),
    travauxFaits(ctx.jeton),
    coursDeLEleve(ctx.jeton),
    agenda(ctx.jeton, maintenant, dans7),
    notifications(ctx.jeton, { limite: 6 }),
    suggestionsDeRevision(ctx.jeton, { limite: 1 }),
    revisionsCollectives(ctx.jeton, classe),
    classe ? consultations(ctx.jeton, classe) : Promise.resolve([]),
    import("@/lib/supabase-serveur").then(({ clientUtilisateur }) =>
      clientUtilisateur(ctx.jeton).from("preferences_notifications").select("bienvenue_faite").maybeSingle(),
    ),
  ]);

  const libelles = new Map(cours.map((c) => [c.id, c.matiere] as const));
  const priorites = trierDevoirs(devoirs).aVenir.filter((d) => !faits.has(d.id)).slice(0, 3);
  const heure = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(maintenant));
  const suggestion = revision.suggestions[0];
  const recente = (nouvelles ?? []).find((n) => ["reponse_fil", "annonce", "consultation_ouverte"].includes(n.genre));
  const ouverte = sondages.find((c) => c.etat === "ouverte");
  const prochaine = entraide.find((r) => Date.parse(r.debut) >= maintenant.getTime()) ?? null;

  const d: DonneesAccueil = {
    prenom: ctx.personne.prenom,
    salut: heure >= 18 || heure < 5 ? "Bonsoir" : "Bonjour",
    dateLibelle: dateLisible(maintenant.toISOString(), { weekday: "long", day: "numeric", month: "long" }),
    premiereVisite: reprise?.dejaLue !== true && preferences.data?.bienvenue_faite !== true,
    reprise: reprise
      ? {
          id: reprise.seance.id,
          titre: reprise.seance.titre,
          objectif: reprise.seance.objectif,
          contexte: [reprise.seance.cours, reprise.seance.chapitre].filter(Boolean).join(" · "),
          dejaLue: reprise.dejaLue,
        }
      : null,
    taches: priorites.map((t) => ({
      id: t.id,
      titre: t.title,
      matiere: libelles.get(t.teaching_space_id) ?? "Cours",
      echeance: echeanceLisible(t.due_at),
    })),
    cours: cours.map((c) => ({ id: c.id, matiere: c.matiere, libelle: c.libelle })),
    enDirect: recente
      ? (() => {
          const x = decrireNotification(recente);
          return {
            titre: x.titre,
            sujet: x.sujet,
            lien: x.lien,
            quand: dateLisible(recente.survenuLe, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          };
        })()
      : null,
    consultation:
      ouverte && classe ? { titre: ouverte.titre, lien: `/app/classes/${classe}/consultations/${ouverte.id}`, fermeLe: ouverte.fermeLe } : null,
    ensemble: prochaine
      ? {
          titre: prochaine.titre,
          lien: `/app/entraide/${prochaine.id}`,
          debut: dateLisible(prochaine.debut, { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          inscrits: prochaine.inscrits,
          capacite: prochaine.capacite,
        }
      : null,
    semaine:
      semaine === null
        ? null
        : semaine.slice(0, 4).map((e) => ({
            cle: `${e.kind}-${e.id}`,
            jour: dateLisible(e.debut, { weekday: "short", day: "numeric" }),
            titre: e.titre,
            genre: `${LIBELLE_AGENDA[e.kind] ?? e.kind}${e.contexte ? ` · ${e.contexte}` : ""}`,
          })),
    suggestion: suggestion ? { notion: suggestion.notion, cours: suggestion.cours ?? "", explication: suggestion.explication } : null,
  };

  return <AccueilEleve d={d} />;
}

const LIBELLE_AGENDA: Record<string, string> = {
  controle: "Contrôle",
  rendu: "À rendre",
  cours: "Cours",
  revision: "Révision",
  creneau: "Créneau personnel",
  vie_de_classe: "Vie de classe",
};

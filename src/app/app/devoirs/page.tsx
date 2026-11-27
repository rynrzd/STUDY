import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { devoirsDeLEleve, type Devoir, type EtatRemise } from "@/lib/devoirs";
import { coursDeLEleve } from "@/lib/espace-eleve";
import { instantLisible } from "@/lib/horodatage";
import { classerDevoirsEleve } from "@/lib/priorites-eleve";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { RubriqueCoursEleve } from "@/components/study/Rubriques";

export const metadata: Metadata = { title: "À faire" };

/**
 * À faire — cahier V5, §3.1.
 *
 * Trois groupes, dans l'ordre où ils intéressent l'élève : urgent,
 * plus tard, puis terminé ou fermé. Pas de
 * pourcentage d'avancement ni de série quotidienne — AvecStudy ne prétend pas
 * savoir ce qu'un élève a réellement compris.
 *
 * L'état affiché vient de la base, jamais d'un calcul refait ici : l'écran ne
 * doit pas pouvoir dire « ouvert » quand le serveur refuse.
 */
export const dynamic = "force-dynamic";

interface Ligne {
  readonly devoir: Devoir;
  readonly cours: string;
  readonly etat: EtatRemise;
  readonly corrige: boolean;
}

export default async function PageDevoirsEleve() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const [cours, devoirs] = await Promise.all([coursDeLEleve(jeton), devoirsDeLEleve(jeton)]);
  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));

  // Les états de remise en un seul aller-retour : une requête par devoir
  // multiplierait les allers-retours sans rien apporter.
  const client = clientUtilisateur(jeton);
  const { data: copies } = await client
    .from("submissions")
    .select("assignment_id, state")
    .in(
      "assignment_id",
      devoirs.map((d) => d.id),
    );

  const parDevoir = new Map(
    ((copies ?? []) as { assignment_id: string; state: EtatRemise }[]).map((c) => [
      c.assignment_id,
      c.state,
    ]),
  );

  const { data: retours } = await client
    .from("feedback")
    .select("submission_version_id, published_at")
    .not("published_at", "is", null);

  const corriges = new Set(
    ((retours ?? []) as { submission_version_id: string }[]).map((r) => r.submission_version_id),
  );

  const { data: versions } = await client
    .from("submission_versions")
    .select("id, submission_id")
    .in("id", [...corriges]);

  const copiesCorrigees = new Set(
    ((versions ?? []) as { submission_id: string }[]).map((v) => v.submission_id),
  );

  const { data: sesCopies } = await client.from("submissions").select("id, assignment_id");
  const devoirsCorriges = new Set(
    ((sesCopies ?? []) as { id: string; assignment_id: string }[])
      .filter((c) => copiesCorrigees.has(c.id))
      .map((c) => c.assignment_id),
  );

  const lignes: Ligne[] = devoirs.map((devoir) => ({
    devoir,
    cours: libelles.get(devoir.cours) ?? "Cours",
    etat: parDevoir.get(devoir.id) ?? "non_commence",
    corrige: devoirsCorriges.has(devoir.id),
  }));

  const priorites = classerDevoirsEleve(lignes);
  const groupes = [
    {
      cle: "bientot",
      titre: "À rendre bientôt",
      explication: "Échéance dans les sept prochains jours, ou déjà passée si le dépôt reste ouvert.",
      lignes: priorites.bientot,
    },
    {
      cle: "plus-tard",
      titre: "À faire plus tard",
      explication: "Tu as encore du temps, ou aucune date limite n'est fixée.",
      lignes: priorites.plusTard,
    },
    {
      cle: "termines",
      titre: "Terminés ou fermés",
      explication: "Copies remises, corrections reçues et devoirs dont la remise est fermée.",
      lignes: priorites.termines,
    },
  ];

  if (devoirs.length === 0) {
    return (
      <>
        <RubriqueCoursEleve actif="/app/devoirs" />
        <TitreEspace titre="À faire" />
        <div className="mt-8">
          <Vide
            titre="Rien à rendre pour le moment."
            texte="Les devoirs donnés par vos professeurs apparaissent ici, du plus proche au plus lointain, avec le cours auquel ils se rattachent."
            action={
              <Link href="/app/cours" className="bouton bouton-secondaire">
                Voir mes cours
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const aFaire = priorites.nombreAFaire;

  return (
    <>
      <RubriqueCoursEleve actif="/app/devoirs" />
      <TitreEspace
        titre="À faire"
        sousTitre={`${aFaire} devoir${aFaire > 1 ? "s" : ""} à rendre`}
      />

      {groupes.map((groupe) =>
        groupe.lignes.length === 0 ? null : (
          <section key={groupe.cle} className="mt-10" data-testid={`groupe-${groupe.cle}`}>
            <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              {groupe.titre} <span className="text-base font-normal text-[color:var(--color-encre-faible)]">({groupe.lignes.length})</span>
            </h2>
            <p className="m-0 mt-1 text-sm text-[color:var(--color-encre-faible)]">{groupe.explication}</p>

            <ul className="m-0 mt-4 list-none space-y-2 p-0">
              {groupe.lignes.map((ligne) => (
                <li key={ligne.devoir.id}>
                  <Link
                    href={`/app/devoirs/${ligne.devoir.id}`}
                    data-testid="devoir-lien"
                    data-devoir={ligne.devoir.id}
                    className="flex min-h-[72px] min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 no-underline transition-colors hover:border-[color:var(--color-accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-semibold">{ligne.devoir.titre}</span>
                      <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {ligne.cours}
                        {ligne.devoir.echeance === null
                          ? ""
                          : ` — à rendre le ${instantLisible(ligne.devoir.echeance)}`}
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-[color:var(--color-rose-clair)] px-2.5 py-1 font-semibold text-[color:var(--color-accent)]">
                        {libelleEtat(ligne)}
                      </span>
                      <span className="text-[color:var(--color-encre-faible)]">
                        {ligne.devoir.mode === "papier"
                          ? "Sur papier"
                          : ligne.devoir.mode === "aucune"
                            ? "Sans dépôt"
                            : "Fichier"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  );
}

function libelleEtat(ligne: Ligne): string {
  if (ligne.corrige || ligne.etat === "retour_disponible") return "Corrigé";
  if (ligne.etat === "remis" || ligne.etat === "remis_en_retard") return "Copie remise";
  if (ligne.devoir.etat === "ferme") return "Remise fermée";
  if (ligne.etat === "a_reprendre") return "À reprendre";
  if (ligne.devoir.etat === "publie_en_retard") return "En retard";
  return "À faire";
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { devoirsDeLEleve, type Devoir, type EtatRemise } from "@/lib/devoirs";
import { coursDeLEleve } from "@/lib/espace-eleve";
import { instantLisible } from "@/lib/horodatage";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata: Metadata = { title: "À faire" };

/**
 * À faire — cahier V5, §3.1.
 *
 * Quatre groupes, dans l'ordre où ils intéressent l'élève : ce qui reste à
 * faire, ce qui est remis, ce qui est corrigé, ce qui est fermé. Pas de
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

  const remis = (etat: EtatRemise) => etat === "remis" || etat === "remis_en_retard";

  const groupes = [
    {
      cle: "a-faire",
      titre: "À faire",
      lignes: lignes.filter(
        (l) => !l.corrige && !remis(l.etat) && l.devoir.etat !== "ferme",
      ),
    },
    {
      cle: "remis",
      titre: "Remis, en attente de correction",
      lignes: lignes.filter((l) => !l.corrige && remis(l.etat)),
    },
    { cle: "corriges", titre: "Corrigés", lignes: lignes.filter((l) => l.corrige) },
    {
      cle: "fermes",
      titre: "Fermés",
      lignes: lignes.filter((l) => !l.corrige && !remis(l.etat) && l.devoir.etat === "ferme"),
    },
  ];

  if (devoirs.length === 0) {
    return (
      <>
        <TitreEspace titre="À faire" />
        <div className="mt-8">
          <Vide
            titre="Rien à rendre pour le moment."
            texte="Les devoirs donnés par vos professeurs apparaissent ici, du plus proche au plus lointain, avec le cours auquel ils se rattachent."
            action={
              <Link href="/eleve/cours" className="bouton bouton-secondaire">
                Voir mes cours
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const aFaire = groupes[0]!.lignes.length;

  return (
    <>
      <TitreEspace
        titre="À faire"
        sousTitre={`${aFaire} devoir${aFaire > 1 ? "s" : ""} à rendre`}
      />

      {groupes.map((groupe) =>
        groupe.lignes.length === 0 ? null : (
          <section key={groupe.cle} className="mt-10" data-testid={`groupe-${groupe.cle}`}>
            <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              {groupe.titre}
            </h2>

            <ul className="m-0 mt-4 list-none space-y-2 p-0">
              {groupe.lignes.map((ligne) => (
                <li key={ligne.devoir.id}>
                  <Link
                    href={`/eleve/devoirs/${ligne.devoir.id}`}
                    data-testid="devoir-lien"
                    data-devoir={ligne.devoir.id}
                    className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4 no-underline hover:border-[color:var(--color-bordure-forte)]"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{ligne.devoir.titre}</span>
                      <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {ligne.cours}
                        {ligne.devoir.echeance === null
                          ? ""
                          : ` — à rendre le ${instantLisible(ligne.devoir.echeance)}`}
                      </span>
                    </span>

                    <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                      {ligne.devoir.mode === "papier"
                        ? "papier"
                        : ligne.devoir.mode === "aucune"
                          ? "rien à rendre"
                          : "fichier"}
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

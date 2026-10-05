import Link from "next/link";
import { EnTetePage, EtatVide, Panneau } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { exercicesDeLaSeance, seanceDetail } from "@/lib/v6/cours";
import { ParcoursDebloque } from "./ParcoursDebloque";

export const metadata = { title: "Débloque-moi" };
export const dynamic = "force-dynamic";

/**
 * E08 — Débloque-moi. Exercice → ce que j'ai essayé → indice → exemple si
 * besoin → nouvelle vérification → relais humain. Les aides viennent de ce
 * que le professeur a préparé ; rien n'est généré. Après deux aides sans
 * résolution, un adulte ou la classe prennent le relais, sans bloquer le cours.
 */
export default async function PageDebloque({ searchParams }: { searchParams: Promise<{ seance?: string; version?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  const client = clientUtilisateur(ctx.jeton);

  // Un exercice précis (depuis un entraînement) ou les exercices d'une séance.
  let exercices: { versionId: string; enonce: string; seance: string | null; titreSeance: string | null; choix: readonly string[] | null; kind: string }[] = [];
  let salon: string | null = null;
  if (q.version && /^[0-9a-f-]{36}$/iu.test(q.version)) {
    const { data } = await client
      .from("exercice_versions")
      .select("id, enonce, kind, choix, exercices(lesson_id, teaching_space_id, lessons(title))")
      .eq("id", q.version)
      .maybeSingle();
    const v = data as unknown as {
      id: string;
      enonce: string;
      kind: string;
      choix: string[] | null;
      exercices: { lesson_id: string | null; teaching_space_id: string; lessons: { title: string } | null } | null;
    } | null;
    if (v) {
      exercices = [{ versionId: v.id, enonce: v.enonce, kind: v.kind, choix: v.choix, seance: v.exercices?.lesson_id ?? null, titreSeance: v.exercices?.lessons?.title ?? null }];
      const s = await client.from("salons").select("id, class_id").eq("teaching_space_id", v.exercices?.teaching_space_id ?? "").maybeSingle();
      if (s.data) salon = `/app/classes/${(s.data as { class_id: string }).class_id}/salons/${(s.data as { id: string }).id}`;
    }
  } else if (q.seance && /^[0-9a-f-]{36}$/iu.test(q.seance)) {
    const [detail, liste] = await Promise.all([seanceDetail(ctx.jeton, q.seance), exercicesDeLaSeance(ctx.jeton, q.seance)]);
    if (detail) {
      exercices = liste.map((e) => ({ versionId: e.versionId, enonce: e.enonce, kind: e.kind, choix: e.choix, seance: detail.id, titreSeance: detail.titre }));
      const s = await client.from("salons").select("id, class_id").eq("teaching_space_id", detail.coursId).maybeSingle();
      if (s.data) salon = `/app/classes/${(s.data as { class_id: string }).class_id}/salons/${(s.data as { id: string }).id}`;
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <EnTetePage
        filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]}
        titre="Débloque-moi"
        sousTitre="Une aide graduelle, tirée de ce que ton professeur a préparé : un indice, un exemple, puis quelqu'un pour t'aider."
      />
      {exercices.length === 0 ? (
        <div className="grid gap-6">
          <EtatVide
            titre="Sur quel exercice bloques-tu ?"
            texte="Ouvre Débloque-moi depuis une séance (onglet Exercices) ou depuis un entraînement : les aides sont attachées à chaque exercice."
            action={
              <Link href="/app/cours" className="bouton bouton-primaire">
                Choisir une séance
              </Link>
            }
          />
          <Panneau titre="Une photo d'exercice ?">
            <p className="m-0 text-[color:var(--color-encre-faible)]">
              La lecture automatique des photos n&apos;est pas disponible dans Study. Recopie l&apos;énoncé dans une question au salon de la
              matière, ou écris à ton professeur : une formule mal lue serait une mauvaise aide.
            </p>
            <Link href="/app/demandes/nouvelle" className="bouton bouton-secondaire mt-4">
              Écrire à un professeur
            </Link>
          </Panneau>
        </div>
      ) : (
        <ParcoursDebloque exercices={exercices} salon={salon} />
      )}
    </div>
  );
}

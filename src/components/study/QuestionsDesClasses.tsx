import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { Panneau, dateLisible } from "./ui";

/**
 * E20 — demandes d'aide de vos classes : les questions sans réponse,
 * triées par nombre de « même question ». Aucun indice ne classe les élèves ;
 * la liste nominative de qui a la même question n'est pas affichée ici.
 */
export async function QuestionsDesClasses({ jeton }: { jeton: string }) {
  const client = clientUtilisateur(jeton);
  const { data } = await client
    .from("messages_salon")
    .select("id, salon_id, body, created_at, lesson_id, salons(label, class_id)")
    .eq("kind", "question")
    .is("parent_id", null)
    .is("deleted_at", null)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  const lignes = (data ?? []) as unknown as {
    id: string;
    salon_id: string;
    body: string;
    created_at: string;
    salons: { label: string; class_id: string | null } | null;
  }[];
  const compteurs = lignes.length
    ? (((await client.rpc("salon_compteurs", { p_messages: lignes.map((l) => l.id) })).data ?? []) as { message_id: string; meme_question: number; reponses: number }[])
    : [];
  const parId = new Map(compteurs.map((c) => [c.message_id, c]));
  const sansReponse = lignes
    .filter((l) => (parId.get(l.id)?.reponses ?? 0) === 0)
    .sort((a, b) => (parId.get(b.id)?.meme_question ?? 0) - (parId.get(a.id)?.meme_question ?? 0))
    .slice(0, 6);

  return (
    <Panneau titre="Questions en attente de réponse">
      {sansReponse.length === 0 ? (
        <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune question sans réponse dans vos salons.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sansReponse.map((q) => {
            const href = q.salons?.class_id ? `/app/classes/${q.salons.class_id}/salons/${q.salon_id}?fil=${q.id}` : `/app/messagerie/${q.salon_id}?fil=${q.id}`;
            const meme = parId.get(q.id)?.meme_question ?? 0;
            return (
              <li key={q.id} className="ligne">
                <CircleHelp size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                <Link href={href} className="min-w-0 flex-1 no-underline">
                  <span className="block truncate text-[color:var(--color-encre)]">{q.body}</span>
                  <span className="meta">
                    {q.salons?.label ?? "Salon"} · {dateLisible(q.created_at, { day: "numeric", month: "short" })}
                    {meme > 0 ? ` · ${meme} élève${meme > 1 ? "s ont" : " a"} la même question` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panneau>
  );
}

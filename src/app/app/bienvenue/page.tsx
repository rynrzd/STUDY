import Link from "next/link";
import { BookOpen, CalendarDays, Check, Users } from "lucide-react";
import { EnTetePage, ICONE } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { mesCours } from "@/lib/v6/cours";
import { terminerBienvenue } from "../reglages/actions";

export const metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

/**
 * E27 — Bienvenue : trois repères, une progression réelle (ce qui existe
 * vraiment), et « Ignorer pour l'instant ». Seulement après une appartenance
 * active ; la demande en attente a son propre écran.
 */
export default async function PageBienvenue() {
  const ctx = await contexteApp();
  const [cours, devoirs] = await Promise.all([
    mesCours(ctx.jeton),
    clientUtilisateur(ctx.jeton).from("assignments").select("id", { count: "exact", head: true }).eq("state", "publiee"),
  ]);
  const classe = ctx.classeActive;
  const etapes = [
    {
      icone: BookOpen,
      titre: "Tes cours",
      texte: cours && cours.length > 0 ? `${cours.length} matière${cours.length > 1 ? "s" : ""} : ${cours.map((c) => c.matiere).slice(0, 4).join(", ")}.` : "Tes cours apparaîtront dès la première séance publiée.",
      lien: "/app/cours",
      action: "Voir mes cours",
    },
    {
      icone: Users,
      titre: classe ? `Ta classe : ${classe.libelle}` : "Ta classe",
      texte: "Le salon de la classe, les délégués, l'entraide et la bibliothèque des bonnes explications.",
      lien: "/app/classe",
      action: "Découvrir ma classe",
    },
    {
      icone: CalendarDays,
      titre: "Tes échéances",
      texte: (devoirs.count ?? 0) > 0 ? `${devoirs.count} devoir${(devoirs.count ?? 0) > 1 ? "s" : ""} publié${(devoirs.count ?? 0) > 1 ? "s" : ""} dans tes cours.` : "Aucun devoir pour l'instant.",
      lien: "/app/agenda",
      action: "Ouvrir l'agenda",
    },
  ];

  return (
    <div className="mx-auto max-w-[820px]">
      <EnTetePage sourcil="Bienvenue" titre={`Bienvenue ${ctx.personne.prenom}`} sousTitre="Trois repères, deux minutes. Tu peux revenir ici quand tu veux." />
      <ol className="m-0 grid list-none gap-4 p-0">
        {etapes.map((e, i) => (
          <li key={e.titre} className="panneau flex flex-wrap items-center gap-4">
            <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]">
              <e.icone {...ICONE} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="meta block">Étape {i + 1}</span>
              <span className="titre-bloc block font-bold">{e.titre}</span>
              <span className="block text-[color:var(--color-encre-faible)]">{e.texte}</span>
            </span>
            <Link href={e.lien} className="bouton bouton-secondaire">
              {e.action}
            </Link>
          </li>
        ))}
      </ol>
      <p className="meta mt-4">Envie d&apos;un binôme pour démarrer ? Demande-le à ton professeur principal : c&apos;est toujours volontaire.</p>
      <form action={terminerBienvenue} className="mt-6 flex flex-wrap gap-2">
        <button type="submit" name="vers" value="/app" className="bouton bouton-primaire">
          <Check {...ICONE} /> C&apos;est parti
        </button>
        <button type="submit" name="vers" value="/app" className="bouton bouton-discret">
          Ignorer pour l&apos;instant
        </button>
      </form>
    </div>
  );
}

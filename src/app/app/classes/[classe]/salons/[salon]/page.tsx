import { ListeSalons } from "@/components/study/ListeSalons";
import { ModeSalon } from "@/components/study/ModeSalon";
import { Salon } from "@/components/study/Salon";
import { AccesIndisponible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { mesSalons, pageMessages } from "@/lib/v6/messagerie";

export const metadata = { title: "Salon" };
export const dynamic = "force-dynamic";

/**
 * E09 — Salon classe et professeur. Ordinateur : salons à gauche,
 * conversation, fil à droite si la place le permet. Téléphone : salon puis
 * fil en plein écran. Une séance peut être citée (?seance=…&citation=…).
 */
export default async function PageSalon({
  params,
  searchParams,
}: {
  params: Promise<{ classe: string; salon: string }>;
  searchParams: Promise<{ fil?: string; seance?: string; citation?: string }>;
}) {
  const ctx = await contexteApp();
  const { classe, salon: id } = await params;
  const q = await searchParams;
  const [salons, page] = await Promise.all([mesSalons(ctx.jeton), pageMessages(ctx.jeton, ctx.personne.profileId, id)]);
  const salon = (salons ?? []).find((s) => s.id === id && s.classId === classe);
  if (!page.accessible || !salon) return <AccesIndisponible retour="/app/messagerie" />;

  let seanceCitee: { id: string; titre: string } | null = null;
  if (q.seance && /^[0-9a-f-]{36}$/iu.test(q.seance)) {
    const { data } = await clientUtilisateur(ctx.jeton).from("lessons").select("id, title").eq("id", q.seance).maybeSingle();
    if (data) seanceCitee = { id: (data as { id: string }).id, titre: (data as { title: string }).title };
  }

  const salonsClasse = (salons ?? []).filter((s) => s.classId === classe);
  return (
    <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Salons de la classe" className="hidden lg:block">
        <ListeSalons salons={salonsClasse} actif={id} />
      </nav>
      <div className="min-w-0">
        <details className="mb-3 lg:hidden">
          <summary className="bouton bouton-secondaire bouton-compact">Changer de salon</summary>
          <div className="panneau mt-2 p-2">
            <ListeSalons salons={salonsClasse} actif={id} />
          </div>
        </details>
        {page.animateur ? <ModeSalon salon={id} mode={salon.mode} chemin={`/app/classes/${classe}/salons/${id}`} /> : null}
        <Salon
          salon={{ id, label: salon.label, mode: salon.mode }}
          classe={classe}
          moi={{ id: ctx.personne.profileId, prenom: ctx.personne.prenom }}
          initiale={page}
          filInitial={q.fil && /^[0-9a-f-]{36}$/iu.test(q.fil) ? q.fil : null}
          seanceCitee={seanceCitee}
          citation={q.citation ? q.citation.slice(0, 600) : null}
        />
      </div>
    </div>
  );
}

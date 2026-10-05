import { redirect } from "next/navigation";
import { ListeSalons } from "@/components/study/ListeSalons";
import { ModeSalon } from "@/components/study/ModeSalon";
import { Salon } from "@/components/study/Salon";
import { AccesIndisponible, EnTetePage } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { mesSalons, pageMessages } from "@/lib/v6/messagerie";

export const metadata = { title: "Salon" };
export const dynamic = "force-dynamic";

/** Salon hors classe : groupe interclasses ou projet. Mêmes garanties que E09. */
export default async function PageSalonGenerique({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ fil?: string }> }) {
  const ctx = await contexteApp();
  const { salon: id } = await params;
  const { fil } = await searchParams;
  const [salons, page] = await Promise.all([mesSalons(ctx.jeton), pageMessages(ctx.jeton, ctx.personne.profileId, id)]);
  const salon = (salons ?? []).find((s) => s.id === id);
  if (!page.accessible || !salon) return <AccesIndisponible retour="/app/messagerie" />;
  if (salon.classId && salon.kind !== "projet") redirect(`/app/classes/${salon.classId}/salons/${id}`);

  return (
    <>
      <EnTetePage filAriane={[{ href: "/app/messagerie", libelle: "Messagerie" }]} titre={salon.label} />
      <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav aria-label="Mes salons" className="hidden lg:block">
          <ListeSalons salons={salons ?? []} actif={id} />
        </nav>
        <div className="min-w-0">
          {page.animateur && salon.kind !== "projet" ? <ModeSalon salon={id} mode={salon.mode} chemin={`/app/messagerie/${id}`} /> : null}
          <Salon
            salon={{ id, label: salon.label, mode: salon.mode }}
            classe={null}
            moi={{ id: ctx.personne.profileId, prenom: ctx.personne.prenom }}
            initiale={page}
            filInitial={fil && /^[0-9a-f-]{36}$/iu.test(fil) ? fil : null}
            seanceCitee={null}
            citation={null}
          />
        </div>
      </div>
    </>
  );
}

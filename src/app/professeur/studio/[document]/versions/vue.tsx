import { History } from "lucide-react";
import { RestaurerVersion } from "@/components/studio/RestaurerVersion";
import { EnTetePage, Etiquette } from "@/components/study/ui";
import type { VersionDocument } from "@/lib/studio-documents";

/** Une date UTC lue à l'heure de Paris. */
function aParis(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Vue de l'historique, rendue avec des données réelles (page.tsx) ou fictives (aperçu). */
export function VueVersions({ document, titre, versions }: { document: string; titre: string; versions: readonly VersionDocument[] }) {
  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/studio", libelle: "Mes cours" },
          { href: "/professeur/studio", libelle: "Documents importés" },
          { href: `/professeur/studio/${document}`, libelle: titre },
        ]}
        sourcil="Historique"
        titre="Versions du document"
        sousTitre="Chaque enregistrement est gardé. Restaurer une version la recopie en nouvelle version de travail : rien n'est effacé, et vos élèves gardent la version publiée tant que vous ne republiez pas."
      />

      <ol className="m-0 list-none space-y-3 p-0">
        {versions.map((v) => (
          <li key={v.version} className="panneau flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="tuile" aria-hidden="true">
                <History size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">Version {v.numero}</span>
                  {v.courante ? <Etiquette ton="rose">Version de travail</Etiquette> : null}
                  {v.enLigneDans.length > 0 ? <Etiquette ton="succes">En ligne</Etiquette> : null}
                </span>
                <span className="meta block">
                  {aParis(v.creeeLe)} · {v.titre}
                </span>
                {v.enLigneDans.length > 0 ? <span className="meta block">Vue par les élèves de : {v.enLigneDans.join(", ")}</span> : null}
              </span>
            </div>
            {v.courante ? null : <RestaurerVersion document={document} version={v.version} numero={v.numero} />}
          </li>
        ))}
      </ol>
      <p className="meta m-0 mt-4">Les versions enregistrées avant le 12 octobre 2026 ne sont pas toutes rattachées à leur document : seule la plus récente apparaît ici.</p>
    </>
  );
}

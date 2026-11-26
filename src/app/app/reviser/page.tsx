import { contexteApp } from "@/lib/v6/contexte";
import { mesFiches } from "@/lib/v6/fiches";
import { maProgression } from "@/lib/v6/progression";
import { maSemaine } from "@/lib/v6/semaine";
import { suggestionsDeRevision } from "@/lib/v6/revision";
import { VueReviser } from "./vue";
import Link from "next/link";
import { revisionsDesDevoirs } from "@/lib/revision/devoirs";
import { lancerRevisionDevoir } from "./actions";
import { coursDeLEleve } from "@/lib/espace-eleve";

export const metadata = { title: "Réviser" };
export const dynamic = "force-dynamic";

/**
 * A06 — Réviser (maquettes R2 n° 1 et 3) : d'abord ce qui est dû (les
 * suggestions calculées par le serveur), puis les activités, puis les fiches
 * de l'élève. Aucune note, aucun classement : des repères pour soi.
 */
export default async function PageReviser({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const ctx = await contexteApp();
  const { erreur } = await searchParams;
  const [fiches, priorites, progression, semaine] = await Promise.all([
    mesFiches(ctx.jeton),
    suggestionsDeRevision(ctx.jeton, { limite: 5 }),
    maProgression(ctx.jeton, ctx.personne.profileId),
    maSemaine(ctx.jeton, ctx.personne.profileId),
  ]);

  const recommandations = await revisionsDesDevoirs(ctx.jeton);
  const recommandation = recommandations?.find(r => r.versions.length > 0);
  const matieres = await coursDeLEleve(ctx.jeton);
  return <>
    {recommandations === null ? <p role="status">Les révisions liées aux devoirs sont momentanément indisponibles. Tes cours restent accessibles.</p> : null}
    {recommandation ? <section className="panneau mb-6" aria-label="Préparer mon devoir">
      <h2 className="titre-section">Préparer {recommandation.titre}</h2>
      <p>{recommandation.notion} · {Math.min(3, recommandation.versions.length)} exercices · environ {Math.min(3, recommandation.versions.length) * 2} min</p>
      <p>{matieres.find(m => m.id === recommandation.espace_id)?.libelle}</p>
      {recommandation.echeance ? <p>À rendre le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(recommandation.echeance))}</p> : null}
      <Link href={`/app/devoirs/${recommandation.devoir_id}`}>Voir le devoir</Link>
      <form action={lancerRevisionDevoir} className="mt-4">
        <input type="hidden" name="devoir" value={recommandation.devoir_id} />
        <input type="hidden" name="notion" value={recommandation.notion_id} />
        <button className="bouton bouton-primaire">Commencer</button>
      </form>
    </section> : null}
    <section className="panneau mb-6" aria-label="Mes matières">
      <h2 className="titre-section">Mes matières</h2>
      {!recommandation ? <p>Choisis une matière pour réviser ou retrouver ton cours.</p> : null}
      <ul className="grid list-none gap-3 p-0">
        {matieres.map(m => <li key={m.id}>
          <Link href={`/app/cours/${m.id}`} className="bouton bouton-secondaire">{m.libelle}</Link>
          {!recommandations?.some(r => r.espace_id === m.id && r.versions.length > 0) ? <p className="meta">Retrouve les notions disponibles dans ton cours.</p> : null}
        </li>)}
      </ul>
    </section>
    <VueReviser erreur={erreur} fiches={fiches} priorites={priorites} progression={progression} semaine={semaine} />
  </>;
}

import { EnTetePage, EtatVide, Panneau } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { FormulaireNouvelleDemande } from "../formulaires";

export const metadata = { title: "Écrire à un adulte" };
export const dynamic = "force-dynamic";

/** « Poser discrètement » (§8.4) : le destinataire est choisi parmi les adultes qui encadrent l'élève. */
export default async function PageNouvelleDemande({ searchParams }: { searchParams: Promise<{ seance?: string; sujet?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  const { data } = await clientUtilisateur(ctx.jeton).rpc("demande_destinataires");
  const destinataires = ((data ?? []) as { profile_id: string; prenom: string; nom: string; qualite: string }[]).map((d) => ({
    id: d.profile_id,
    nom: `${d.prenom} ${d.nom}`,
    qualite: d.qualite,
  }));
  return (
    <div className="mx-auto max-w-[680px]">
      <EnTetePage filAriane={[{ href: "/app/demandes", libelle: "Demandes personnelles" }]} titre="Écrire à un adulte" />
      {destinataires.length === 0 ? (
        <EtatVide titre="Aucun destinataire disponible" texte="Les professeurs de tes classes apparaîtront ici. En attendant, adresse-toi à la vie scolaire." />
      ) : (
        <Panneau>
          <FormulaireNouvelleDemande destinataires={destinataires} lecon={q.seance && /^[0-9a-f-]{36}$/iu.test(q.seance) ? q.seance : undefined} sujetInitial={q.sujet?.slice(0, 140)} />
        </Panneau>
      )}
    </div>
  );
}

import Link from "next/link";
import { MessageSquareLock, Plus } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, ICONE, Ligne, ListeLignes, dateHeure } from "@/components/study/ui";
import type { nomsAffichables } from "@/lib/v6/classe";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueDemandes({ lignes, noms, moi, eleve }: {
  lignes: readonly { id: string; subject: string; state: string; created_at: string; author_id: string; recipient_id: string }[];
  noms: Awaited<ReturnType<typeof nomsAffichables>>;
  moi: string;
  eleve: boolean;
}) {
  return (
    <>
      <EnTetePage
        sourcil="Demandes personnelles"
        titre="Tes échanges privés"
        sousTitre="Un échange privé avec un adulte qui t'encadre, hors du salon de classe."
        actions={
          eleve ? (
            <Link href="/app/demandes/nouvelle" className="bouton bouton-primaire">
              <Plus {...ICONE} /> Nouvelle demande
            </Link>
          ) : null
        }
      />
      {lignes.length === 0 ? (
        <EtatVide icone={MessageSquareLock} titre="Aucune demande" texte="Les demandes envoyées et reçues apparaissent ici. Elles ne sont visibles que par leur auteur et leur destinataire." />
      ) : (
        <ListeLignes>
          {lignes.map((l) => {
            const autre = l.author_id === moi ? l.recipient_id : l.author_id;
            return (
              <Ligne
                key={l.id}
                href={`/app/demandes/${l.id}`}
                icone={MessageSquareLock}
                titre={l.subject}
                detail={`${l.author_id === moi ? "À" : "De"} ${noms.get(autre)?.affichage ?? "—"} · ${dateHeure(l.created_at)}`}
                fin={<Etiquette ton={l.state === "ouverte" ? "rose" : "neutre"}>{l.state === "ouverte" ? "Ouverte" : "Close"}</Etiquette>}
              />
            );
          })}
        </ListeLignes>
      )}
    </>
  );
}

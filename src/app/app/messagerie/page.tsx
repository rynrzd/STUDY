import Link from "next/link";
import { MessageCircle, MessageSquareLock } from "lucide-react";
import { ListeSalons } from "@/components/study/ListeSalons";
import { EnTetePage, EtatErreur, EtatVide, ICONE, Panneau } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { mesSalons } from "@/lib/v6/messagerie";

export const metadata = { title: "Messagerie" };
export const dynamic = "force-dynamic";

/**
 * Messagerie — liste des salons (E09). Sur téléphone : liste → salon → fil.
 * Les demandes personnelles à un adulte ont leur propre circuit, distinct.
 */
export default async function PageMessagerie() {
  const ctx = await contexteApp();
  const salons = await mesSalons(ctx.jeton);

  return (
    <>
      <EnTetePage
        titre="Messagerie"
        sousTitre="Les salons de tes classes et de tes projets, avec tes professeurs."
        actions={
          <Link href="/app/demandes" className="bouton bouton-secondaire">
            <MessageSquareLock {...ICONE} /> Demandes personnelles
          </Link>
        }
      />
      {salons === null ? (
        <EtatErreur requestId={idRequete()} action={<Link href="/app/messagerie" className="bouton bouton-secondaire">Réessayer</Link>} />
      ) : salons.length === 0 ? (
        <EtatVide icone={MessageCircle} titre="Aucun salon pour l'instant" texte="Les salons apparaissent dès que tu es inscrit dans une classe ou un projet de groupe." />
      ) : (
        <Panneau className="max-w-[640px]">
          <ListeSalons salons={salons} />
        </Panneau>
      )}
    </>
  );
}

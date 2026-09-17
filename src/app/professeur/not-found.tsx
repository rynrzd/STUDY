import Link from "next/link";
import { Vide } from "@/components/app/Cadre";

/**
 * Page introuvable dans l'espace professeur.
 *
 * Elle vit dans le segment plutôt qu'à la racine pour garder le cadre de
 * l'application : la barre, le nom, la déconnexion. Retomber sur le 404 du
 * site public donne l'impression d'avoir été déconnecté.
 */
export default function Introuvable() {
  return (
    <div className="mt-8">
      <Vide
        titre="Cette page n’existe pas, ou elle ne vous appartient pas."
        texte="Un cours d’un collègue, un document supprimé, une adresse recopiée de travers : tous donnent cette page. C’est voulu — vous dire lequel reviendrait à vous renseigner sur ce que vous n’avez pas le droit de voir."
        action={
          <Link href="/professeur" className="bouton bouton-secondaire">
            Retour à l&apos;accueil
          </Link>
        }
      />
    </div>
  );
}

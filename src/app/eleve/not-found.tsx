import Link from "next/link";
import { Vide } from "@/components/app/Cadre";

/**
 * Page introuvable dans l'espace élève.
 *
 * Elle vit dans le segment plutôt qu'à la racine pour garder le cadre de
 * l'application : la barre, le nom, la déconnexion. Retomber sur le 404 du
 * site public donne l'impression d'avoir été déconnecté.
 */
export default function Introuvable() {
  return (
    <div className="mt-8">
      <Vide
        titre="Cette page n’existe pas, ou elle ne vous est pas destinée."
        texte="Une séance qui n’est pas encore publiée, ou qui appartient à une autre classe, se présente exactement ainsi. Ce n’est pas une panne."
        action={
          <Link href="/eleve" className="bouton bouton-secondaire">
            Retour à mon espace
          </Link>
        }
      />
    </div>
  );
}

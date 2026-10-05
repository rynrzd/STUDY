import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata = { title: "Ma classe" };
export const dynamic = "force-dynamic";

/** Ma classe : la classe active parmi les affectations vérifiées. */
export default async function PageMaClasse() {
  const ctx = await contexteApp();
  if (ctx.classeActive) redirect(`/app/classes/${ctx.classeActive.classe}`);
  return (
    <>
      <EnTetePage titre="Ma classe" />
      <EtatVide
        icone={Users}
        titre="Aucune classe active"
        texte="Ton compte n'est rattaché à aucune classe pour l'instant. Si ton professeur t'a donné un code, tu peux demander à rejoindre sa classe."
        action={
          <a href="/rejoindre" className="bouton bouton-primaire">
            Saisir un code de classe
          </a>
        }
      />
    </>
  );
}

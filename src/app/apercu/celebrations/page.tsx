import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { AccuseDeRemise } from "@/components/eleve/RemiseCopie";
import {
  BarreProgression,
  BilanEntrainement,
  EnteteRetour,
  IndiceDevoile,
  MaSemaine,
  NotionConsolidee,
  RetourReponse,
} from "@/components/study/Celebrations";

/**
 * Aperçu de développement : les huit célébrations, avec des données fictives,
 * dans l'ordre de la planche de référence. Recharger la page les rejoue.
 */
export default function ApercuCelebrations() {
  const semaine = { jours: [true, true, false, true, true, false, false], aujourdHui: 4, actifs: 4 };
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8">
      <p className="meta m-0">Aperçu de développement · données fictives · recharger pour rejouer</p>
      <h1 className="m-0 mt-2 text-[2rem] font-extrabold tracking-[-0.04em]">Les animations d&apos;AvecStudy</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <Case n={1} titre="Fin d'entraînement" texte="Un bilan, pas une note.">
          <BilanEntrainement reussies={6} corrigees={8} semaine={null}>
            <Link href="#" className="bouton bouton-primaire">
              Mon carnet d&apos;erreurs
            </Link>
          </BilanEntrainement>
        </Case>

        <Case n={2} titre="Copie remise" texte="L'accusé du serveur, sans ambiguïté.">
          <AccuseDeRemise etat={{ etat: "remis", reference: "AS-7K2F-91QX", remisLe: "2026-10-12T12:32:00Z", numero: 1, enRetard: false }} />
        </Case>

        <Case n={3} titre="Bonne réponse" texte="Rapide et net.">
          <Choix etat="juste" />
          <RetourReponse ton="succes">
            <EnteteRetour juste sansIndice />
            <p className="m-0 mt-3">Sur le graphique, on part de 2 sur l&apos;axe horizontal et on lit la hauteur : 3.</p>
          </RetourReponse>
        </Case>

        <Case n={4} titre="Pas encore" texte="Clair, sans secousse.">
          <Choix etat="faux" />
          <RetourReponse ton="erreur">
            <EnteteRetour juste={false} sansIndice />
            <p className="m-0 mt-3">L&apos;image se lit sur l&apos;axe vertical, pas sur l&apos;axe horizontal.</p>
          </RetourReponse>
        </Case>

        <Case n={5} titre="Progression" texte="La barre se remplit, la moitié s'annonce.">
          <div className="panneau">
            <div className="flex items-center justify-between gap-3">
              <p className="meta m-0">Question 4 sur 8 · Image d&apos;un nombre</p>
              <BarreProgression fait={4} total={8} />
            </div>
          </div>
        </Case>

        <Case n={6} titre="Ta semaine" texte="Les jours d'entraînement s'allument. Rien ne se perd.">
          <div className="panneau">
            <MaSemaine semaine={semaine} />
          </div>
        </Case>

        <Case n={7} titre="Notion consolidée" texte="Le vrai passage, selon la règle du moteur.">
          <NotionConsolidee notion="Fonctions affines" />
        </Case>

        <Case n={8} titre="Indice dévoilé" texte="L'indice prévu par le professeur.">
          <div className="panneau">
            <p className="m-0 font-semibold">Sur le graphique, quelle est l&apos;image de 2 par f ?</p>
            <IndiceDevoile texte="Pars de 2 sur l'axe horizontal, monte jusqu'à la courbe, puis lis la hauteur." />
          </div>
        </Case>
      </div>
    </main>
  );
}

function Case({ n, titre, texte, children }: { n: number; titre: string; texte: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`case-${n}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-[color:var(--color-accent)] font-extrabold text-white">{n}</span>
        <div>
          <h2 id={`case-${n}`} className="m-0 text-[1.0625rem] font-extrabold">
            {titre}
          </h2>
          <p className="meta m-0">{texte}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Choix({ etat }: { etat: "juste" | "faux" }) {
  const choix = ["f(2) = 1", "f(2) = 3", "f(2) = -1"];
  const choisi = etat === "juste" ? 1 : 0;
  return (
    <div className="grid gap-2">
      {choix.map((c, i) => {
        const ton =
          i !== choisi
            ? "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]"
            : etat === "juste"
              ? "border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)]"
              : "border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)]";
        return (
          <div key={c} className={`flex min-h-[48px] items-center gap-3 border px-4 py-3 ${ton}`}>
            <span className="grid h-6 w-6 place-items-center border border-current text-[0.75rem] font-bold">{String.fromCharCode(65 + i)}</span>
            <span className="flex-1">{c}</span>
            {i === choisi ? (
              etat === "juste" ? (
                <CheckCircle2 size={18} className="text-[color:var(--color-succes)]" aria-label="Ta réponse, juste" />
              ) : (
                <XCircle size={18} className="text-[color:var(--color-erreur)]" aria-label="Ta réponse" />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

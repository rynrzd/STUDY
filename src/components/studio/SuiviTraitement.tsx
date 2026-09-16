"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Suivi d'un import — S05.
 *
 * Des noms d'étape, pas un pourcentage. Le cahier est explicite : un
 * pourcentage qui n'est pas mesuré est un mensonge poli, et celui d'une
 * extraction ne l'est pas. « Lecture du document » dit ce qui se passe sans
 * prétendre savoir combien de temps il reste.
 *
 * L'interrogation s'espace de 2 à 10 secondes, s'arrête quand l'onglet passe en
 * arrière-plan et cesse dès que l'état est terminal (P03). Une page laissée
 * ouverte sur un bureau ne doit pas taper sur le serveur toute la journée.
 */

const ETAPES = [
  { cle: "importe", libelle: "Transfert" },
  { cle: "traitement", libelle: "Lecture du document" },
  { cle: "a_verifier", libelle: "À vérifier" },
] as const;

export function SuiviTraitement({ document: id, titre }: { document: string; titre: string }) {
  const [etat, setEtat] = useState<string>("traitement");
  const [erreur, setErreur] = useState<string | null>(null);
  const routeur = useRouter();

  useEffect(() => {
    let vivant = true;
    let delai = 2000;
    let minuteur: number | undefined;

    const interroger = async () => {
      if (!vivant) return;

      // En arrière-plan, on ne demande rien : on reprendra au retour.
      if (window.document.visibilityState === "hidden") {
        minuteur = window.setTimeout(interroger, delai);
        return;
      }

      try {
        const reponse = await fetch(`/professeur/studio/${id}/etat`, { cache: "no-store" });
        if (reponse.ok) {
          const donnees = (await reponse.json()) as { etat: string; erreur: string | null };

          if (donnees.etat === "a_verifier" || donnees.etat === "pret") {
            routeur.refresh();
            return;
          }
          if (donnees.etat === "echec") {
            setErreur(donnees.erreur);
            routeur.refresh();
            return;
          }
          setEtat(donnees.etat);
        }
      } catch {
        // Une requête perdue n'est pas un échec du traitement : on réessaiera.
      }

      delai = Math.min(10_000, Math.round(delai * 1.5));
      minuteur = window.setTimeout(interroger, delai);
    };

    minuteur = window.setTimeout(interroger, delai);
    return () => {
      vivant = false;
      if (minuteur !== undefined) window.clearTimeout(minuteur);
    };
  }, [id, routeur]);

  const rang = ETAPES.findIndex((etape) => etape.cle === etat);

  return (
    <div className="mt-6 max-w-[var(--spacing-lecture)]">
      <h1 className="m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        {titre}
      </h1>

      <ol className="m-0 mt-8 list-none space-y-4 p-0">
        {ETAPES.map((etape, index) => {
          const faite = index < rang;
          const courante = index === rang;
          return (
            <li key={etape.cle} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold ${
                  faite
                    ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]"
                    : courante
                      ? "bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"
                      : "bg-[color:var(--color-survol)] text-[color:var(--color-encre-tres-faible)]"
                }`}
              >
                {faite ? "✓" : index + 1}
              </span>
              <span
                className={
                  courante
                    ? "font-semibold"
                    : faite
                      ? "text-[color:var(--color-encre-faible)]"
                      : "text-[color:var(--color-encre-tres-faible)]"
                }
              >
                {etape.libelle}
              </span>
            </li>
          );
        })}
      </ol>

      <p role="status" className="m-0 mt-8 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
        {erreur ??
          "La lecture se poursuit même si vous fermez cet onglet : vous retrouverez le cours dans la liste."}
      </p>
    </div>
  );
}

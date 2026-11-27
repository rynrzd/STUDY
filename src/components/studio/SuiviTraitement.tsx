"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EtapesParcours } from "@/components/study/EtapesParcours";

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
  const [longueAttente, setLongueAttente] = useState(false);
  const routeur = useRouter();

  useEffect(() => {
    let vivant = true;
    let delai = 2000;
    let minuteur: number | undefined;
    const debut = Date.now();

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

      if (Date.now() - debut >= 60_000) setLongueAttente(true);

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
      <h1 className="titre-page m-0">
        {titre}
      </h1>

      <div className="mt-8">
        <EtapesParcours etapes={ETAPES.map((etape) => etape.libelle)} active={Math.max(0, rang)} titre="Avancement du traitement du document" />
      </div>

      <p role="status" className="m-0 mt-8 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
        {erreur ??
          (longueAttente
            ? "La conversion prend plus longtemps que prévu. Tu peux fermer cet onglet et revenir dans Mes documents ; si elle échoue, le motif sera affiché."
            : "La lecture se poursuit même si vous fermez cet onglet : vous retrouverez le cours dans la liste.")}
      </p>
    </div>
  );
}

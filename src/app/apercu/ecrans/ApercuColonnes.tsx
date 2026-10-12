"use client";

import { useState } from "react";
import { VerifierColonnes, type Choix } from "@/components/admin/DepotRentree";
import type { FichierColonnes } from "@/app/admin/import/etats";

/** D02c — étape « Vérifier les colonnes » de l'import, avec un fichier fictif. */
const FICHIER: FichierColonnes = {
  nom: "liste-1ere-G2.xlsx",
  lignes: 31,
  erreur: null,
  echantillon: [],
  colonnes: [
    { index: 0, entete: "Apprenant", champ: null, confiance: "non_reconnu", exemple: "Martin" },
    { index: 1, entete: "Petit nom", champ: "nom", confiance: "a_confirmer", exemple: "Lina" },
    { index: 2, entete: "Division", champ: "classe", confiance: "sur", exemple: "1ere G2" },
    { index: 3, entete: "INE", champ: "identifiantExterne", confiance: "sur", exemple: "E123" },
    { index: 4, entete: "Remarque", champ: null, confiance: "non_reconnu", exemple: "—" },
  ],
};

export function ApercuColonnes() {
  const [choix, setChoix] = useState<Choix>({ [FICHIER.nom]: { nom: 1, classe: 2, identifiantExterne: 3 } });
  const c = choix[FICHIER.nom] ?? {};
  const manquants = (["nom", "prenom"] as const).filter((k) => c[k] === undefined).map((k) => `${FICHIER.nom} : ${k === "nom" ? "nom" : "prénom"}`);
  return <VerifierColonnes cible="eleves" apercu={[FICHIER]} choix={choix} setChoix={setChoix} manquants={manquants} />;
}

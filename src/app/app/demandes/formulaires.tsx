"use client";

import { useActionState, useMemo } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { AvisVisibilite } from "@/components/study/ui";
import { ouvrirDemande, repondreDemande } from "./actions";

export function FormulaireNouvelleDemande({
  destinataires,
  lecon,
  sujetInitial,
}: {
  destinataires: readonly { id: string; nom: string; qualite: string }[];
  lecon?: string;
  sujetInitial?: string;
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ouvrirDemande, {});
  // Un identifiant client par brouillon : un double envoi rend la même demande.
  const client = useMemo(() => crypto.randomUUID(), []);
  const choisi = destinataires.find((d) => d.id === etat.valeurs?.destinataire);
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <input type="hidden" name="client" value={client} />
      {lecon ? <input type="hidden" name="lecon" value={lecon} /> : null}
      <Liste
        libelle="À qui veux-tu écrire ?"
        nom="destinataire"
        valeur={etat.valeurs?.destinataire ?? ""}
        erreurs={etat.champs?.destinataire}
        options={[{ valeur: "", libelle: "Choisir un adulte…" }, ...destinataires.map((d) => ({ valeur: d.id, libelle: `${d.nom} — ${d.qualite}` }))]}
      />
      <div className="mb-4">
        <AvisVisibilite>
          Seule la personne choisie{choisi ? ` (${choisi.nom})` : ""} lira ce message, et toi. Ni ta classe, ni les autres professeurs, ni
          l&apos;administration ne le voient. S&apos;il y a un danger, préviens aussi un adulte de vive voix.
        </AvisVisibilite>
      </div>
      <Champ libelle="Sujet" nom="sujet" requis maxLength={140} valeur={etat.valeurs?.sujet ?? sujetInitial} erreurs={etat.champs?.sujet} />
      <ZoneTexte libelle="Message" nom="corps" requis lignes={6} maxLength={4000} valeur={etat.valeurs?.corps} erreurs={etat.champs?.corps} />
      <BoutonEnvoi enCours="Envoi…">Envoyer</BoutonEnvoi>
    </form>
  );
}

export function FormulaireReponseDemande({ demande }: { demande: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(repondreDemande.bind(null, demande), {});
  const client = useMemo(() => crypto.randomUUID(), [etat]); // nouveau message après chaque envoi réussi
  return (
    <form action={action} key={etat.ok ? client : "saisie"}>
      <RetourFormulaire etat={etat} />
      <input type="hidden" name="client" value={client} />
      <ZoneTexte libelle="Répondre" nom="corps" requis lignes={3} maxLength={4000} valeur={etat.ok ? "" : etat.valeurs?.corps} erreurs={etat.champs?.corps} />
      <BoutonEnvoi enCours="Envoi…">Envoyer</BoutonEnvoi>
    </form>
  );
}

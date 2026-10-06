"use client";

import { useActionState, useMemo, useState } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { AvisVisibilite } from "@/components/study/ui";
import { ajouterNote, ajouterTache, creerProjet, inviter } from "./actions";

export function FormulaireProjet({ classes }: { classes: readonly { id: string; libelle: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerProjet, {});
  const [visibilite, setVisibilite] = useState(etat.valeurs?.visibilite ?? "prive");
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <Champ libelle="Nom du projet" nom="titre" requis maxLength={120} valeur={etat.valeurs?.titre} erreurs={etat.champs?.titre} />
      <ZoneTexte libelle="Objectif" nom="description" lignes={2} maxLength={4000} valeur={etat.valeurs?.description} />
      <fieldset className="mb-4">
        <legend className="mb-2 text-[0.8125rem] font-semibold">Qui le voit ?</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="visibilite" value="prive" checked={visibilite === "prive"} onChange={() => setVisibilite("prive")} /> Moi seulement (projet personnel)
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="visibilite" value="groupe" checked={visibilite === "groupe"} onChange={() => setVisibilite("groupe")} disabled={classes.length === 0} /> Un groupe de ma
          classe, sur invitation
        </label>
      </fieldset>
      {visibilite === "groupe" ? (
        <Liste libelle="Classe" nom="classe" valeur={etat.valeurs?.classe} erreurs={etat.champs?.classe} options={classes.map((c) => ({ valeur: c.id, libelle: c.libelle }))} />
      ) : null}
      <div className="mb-4">
        <AvisVisibilite>
          {visibilite === "prive"
            ? "Un projet personnel n'est visible par personne d'autre : ni camarades, ni professeurs, ni administration."
            : "Seules les personnes que tu invites, et qui acceptent, verront le projet. Rien n'est public."}
        </AvisVisibilite>
      </div>
      <BoutonEnvoi enCours="Création…">Créer le projet</BoutonEnvoi>
    </form>
  );
}

export function FormulaireInvitationProjet({ projet, candidats }: { projet: string; candidats: readonly { id: string; nom: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(inviter.bind(null, projet), {});
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-3 sm:grid-cols-[1fr_160px]">
        <Liste libelle="Inviter" nom="profil" erreurs={etat.champs?.profil} options={[{ valeur: "", libelle: "Choisir…" }, ...candidats.map((c) => ({ valeur: c.id, libelle: c.nom }))]} />
        <Liste
          libelle="Rôle"
          nom="role"
          options={[
            { valeur: "editor", libelle: "Peut modifier" },
            { valeur: "viewer", libelle: "Lecture seule" },
          ]}
        />
      </div>
      <BoutonEnvoi variante="secondaire" enCours="Invitation…">
        Inviter
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireTache({ projet, membres }: { projet: string; membres: readonly { id: string; nom: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ajouterTache.bind(null, projet), {});
  // Un formulaire neuf après chaque ajout réussi.
  const cle = useMemo(() => (etat.ok ? crypto.randomUUID() : "saisie"), [etat]);
  return (
    <form action={action} key={cle}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-3 sm:grid-cols-[1fr_180px_160px]">
        <Champ libelle="Nouvelle tâche" nom="titre" requis maxLength={200} valeur={etat.ok ? "" : etat.valeurs?.titre} erreurs={etat.champs?.titre} />
        <Liste libelle="Responsable" nom="responsable" requis={false} valeur={etat.valeurs?.responsable ?? ""} options={[{ valeur: "", libelle: "Volontaire à trouver" }, ...membres.map((m) => ({ valeur: m.id, libelle: m.nom }))]} />
        <Champ libelle="Échéance" nom="echeance" type="date" valeur={etat.ok ? "" : etat.valeurs?.echeance} />
      </div>
      <BoutonEnvoi variante="secondaire" enCours="Ajout…">
        Ajouter
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireNote({ projet }: { projet: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ajouterNote.bind(null, projet), {});
  const cle = useMemo(() => (etat.ok ? crypto.randomUUID() : "saisie"), [etat]);
  return (
    <form action={action} key={cle}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-3 sm:grid-cols-[160px_1fr]">
        <Liste
          libelle="Type"
          nom="kind"
          valeur={etat.valeurs?.kind ?? "document"}
          options={[
            { valeur: "document", libelle: "Document" },
            { valeur: "decision", libelle: "Décision" },
            { valeur: "lien", libelle: "Lien" },
          ]}
        />
        <Champ libelle="Titre" nom="titre" requis maxLength={160} valeur={etat.ok ? "" : etat.valeurs?.titre} erreurs={etat.champs?.titre} />
      </div>
      <ZoneTexte libelle="Contenu" nom="corps" lignes={3} maxLength={12000} valeur={etat.ok ? "" : etat.valeurs?.corps} />
      <Champ libelle="Lien" nom="url" type="url" valeur={etat.ok ? "" : etat.valeurs?.url} erreurs={etat.champs?.url} />
      <BoutonEnvoi variante="secondaire" enCours="Ajout…">
        Ajouter
      </BoutonEnvoi>
    </form>
  );
}

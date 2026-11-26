"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { MAX_ENSEIGNEMENTS_SOUHAITES } from "@/lib/projet-professeur";
import { DemandeLien, UtiliserCode } from "./AccesCourriel";
import { inscrireProfesseur } from "./actions";
import { ETAT_INSCRIPTION_PROFESSEUR, type EtatInscriptionProfesseur } from "./etats";

type NomChamp = "prenom" | "nom" | "email" | "motDePasse" | "confirmation";
function ChampInscription({ nom, label, erreurs, valeur, type = "text", autoComplete }: { nom: NomChamp; label: string; erreurs?: EtatInscriptionProfesseur["champs"]; valeur?: string; type?: string; autoComplete?: string }) {
  return <div><label className="etiquette" htmlFor={nom}>{label}</label><input className="champ champ-acces" id={nom} name={nom} type={type} autoComplete={autoComplete} defaultValue={valeur} required aria-invalid={erreurs?.[nom] ? true : undefined} />{erreurs?.[nom] ? <p className="aide-champ font-semibold text-[color:var(--color-erreur)]">{erreurs[nom]}</p> : null}</div>;
}

export function FormulaireInscriptionProfesseur() {
  const [etat, action, attente] = useActionState(inscrireProfesseur, ETAT_INSCRIPTION_PROFESSEUR);
  const [aCorriger, setACorriger] = useState<EtatInscriptionProfesseur | null>(null);
  const [enseignements, setEnseignements] = useState([{ id: 0, classe: "", matiere: "" }]);
  const ajouter = () => setEnseignements((actuels) => actuels.length >= MAX_ENSEIGNEMENTS_SOUHAITES
    ? actuels : [...actuels, { id: Math.max(...actuels.map((e) => e.id)) + 1, classe: "", matiere: "" }]);
  const changer = (id: number, cle: "classe" | "matiere", valeur: string) => setEnseignements((actuels) =>
    actuels.map((e) => e.id === id ? { ...e, [cle]: valeur } : e));
  const retirer = (id: number) => setEnseignements((actuels) => actuels.length === 1
    ? [{ id: actuels[0]!.id, classe: "", matiere: "" }]
    : actuels.filter((e) => e.id !== id));
  if (etat.etat === "envoyee" && etat !== aCorriger) {
    return (
      <>
        <p role="status" className="rounded bg-[color:var(--color-succes-fond)] p-4">{etat.message}</p>
        <UtiliserCode adresse={etat.valeurs?.email} />
        <DemandeLien mode="confirmation" adresse={etat.valeurs?.email} />
        <button type="button" className="bouton bouton-discret mt-3" onClick={() => setACorriger(etat)}>Corriger mon adresse</button>
      </>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      {etat.etat === "refus" ? <p role="alert" className="m-0 rounded bg-[color:var(--color-attention-fond)] p-3">{etat.message}</p> : null}
      <p className="mb-0 mt-1 text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--color-accent)]">01 · Ton compte</p>
      <div className="grid grid-cols-2 gap-3">
        <ChampInscription nom="prenom" label="Prénom" autoComplete="given-name" erreurs={etat.champs} valeur={etat.valeurs?.prenom} />
        <ChampInscription nom="nom" label="Nom" autoComplete="family-name" erreurs={etat.champs} valeur={etat.valeurs?.nom} />
      </div>
      <ChampInscription nom="email" label="E-mail" type="email" autoComplete="email" erreurs={etat.champs} valeur={etat.valeurs?.email} />
      <ChampInscription nom="motDePasse" label="Mot de passe" type="password" autoComplete="new-password" erreurs={etat.champs} />
      <p className="aide-champ -mt-3">Au moins 12 caractères. Une phrase courte convient.</p>
      <ChampInscription nom="confirmation" label="Confirmer le mot de passe" type="password" autoComplete="new-password" erreurs={etat.champs} />

      <fieldset className="mt-2 grid min-w-0 gap-4 border-t border-[color:var(--color-bordure)] pt-5">
        <legend className="sr-only">Ton établissement, tes classes et tes matières</legend>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--color-accent)]">02 · Ton enseignement</p>
          <h2 className="m-0 text-lg font-bold">Tu enseignes quoi et à qui ?</h2>
          <p className="mb-0 mt-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Deux petites questions pour te proposer les bonnes classes dès ton arrivée. Tu pourras compléter plus tard.</p>
        </div>
        <div>
          <label className="etiquette" htmlFor="etablissement">Ton établissement (facultatif)</label>
          <input className="champ champ-acces" id="etablissement" name="etablissement" type="text" maxLength={120} placeholder="Ex. Lycée Raoul-Follereau" defaultValue={etat.valeurs?.etablissement} autoComplete="organization" />
          <p className="aide-champ mb-0">Le nom sert à personnaliser ton espace. Il ne donne pas automatiquement accès aux classes du lycée.</p>
        </div>
        <div className="grid gap-3">
          <p className="m-0 text-sm font-bold">Tes classes et tes matières</p>
          {enseignements.map((enseignement, index) => (
            <div key={enseignement.id} className="rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-fond)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Enseignement {index + 1}</span>
                <button type="button" aria-label={`Retirer l'enseignement ${index + 1}`} onClick={() => retirer(enseignement.id)} className="grid min-h-9 min-w-9 place-items-center rounded-lg text-[color:var(--color-encre-faible)] hover:bg-[color:var(--color-rose-clair)]"><X size={17} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="etiquette" htmlFor={`classe-${enseignement.id}`}>Classe</label><input className="champ" id={`classe-${enseignement.id}`} name="classeSouhaitee" value={enseignement.classe} onChange={(e) => changer(enseignement.id, "classe", e.target.value)} maxLength={80} placeholder="1re générale" list="niveaux-enseignants" /></div>
                <div><label className="etiquette" htmlFor={`matiere-${enseignement.id}`}>Matière</label><input className="champ" id={`matiere-${enseignement.id}`} name="matiereSouhaitee" value={enseignement.matiere} onChange={(e) => changer(enseignement.id, "matiere", e.target.value)} maxLength={80} placeholder="Français" /></div>
              </div>
            </div>
          ))}
          <datalist id="niveaux-enseignants">
            <option value="Seconde générale" /><option value="Première générale" /><option value="Terminale générale" />
            <option value="Première STI2D" /><option value="Terminale STI2D" />
          </datalist>
          {etat.champs?.projet ? <p role="alert" className="m-0 text-sm text-[color:var(--color-erreur)]">{etat.champs.projet}</p> : null}
          <button className="bouton bouton-secondaire justify-self-start" type="button" onClick={ajouter} disabled={enseignements.length >= MAX_ENSEIGNEMENTS_SOUHAITES}><Plus size={17} aria-hidden="true" /> Ajouter une autre classe ou matière</button>
        </div>
      </fieldset>
      <button className="bouton bouton-primaire bouton-acces w-full" disabled={attente}>{attente ? "Création…" : "Créer mon compte"}</button>
      <Link href="/inscription/professeur/acces?mode=confirmation" className="text-center underline">J’ai déjà reçu un code de confirmation</Link>
    </form>
  );
}

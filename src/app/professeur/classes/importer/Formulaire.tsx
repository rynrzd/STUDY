"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import type { EleveImporte } from "@/lib/liste-classe";
import { analyserListe, appliquerListe, type EtatImportClasse } from "./actions";

export function FormulaireImportClasse({ classe }: { classe: string }) {
  const [analyse, actionAnalyse, analyseEnCours] = useActionState<EtatImportClasse, FormData>(analyserListe, {});
  const fichierRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState("");

  if (analyse.etat === "apercu" && analyse.eleves?.length) {
    return <ApercuImport classe={classe} initiaux={analyse.eleves} message={analyse.message} />;
  }

  return (
    <form
      action={actionAnalyse}
      onSubmit={() => setNomFichier("")}
      className="grid w-full min-w-0 max-w-2xl gap-5 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4 sm:p-6"
      encType="multipart/form-data"
    >
      <div className="min-w-0">
        <label className="etiquette mb-2" htmlFor="fichier">Liste des élèves</label>
        <p className="m-0 text-sm leading-6 text-[color:var(--color-encre-faible)]">
          Ajoute la liste de ta classe. Tu pourras vérifier chaque nom avant de créer les comptes.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 rounded-xl border border-dashed border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 sm:flex sm:items-center">
        <input
          ref={fichierRef}
          id="fichier"
          name="fichier"
          type="file"
          accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => setNomFichier(e.currentTarget.files?.[0]?.name ?? "")}
          aria-describedby="fichier-selection fichier-formats"
        />
        <button
          type="button"
          className="bouton bouton-secondaire w-full min-w-0 whitespace-normal py-3 leading-5 sm:w-auto sm:shrink-0"
          onClick={() => {
            setNomFichier("");
            if (fichierRef.current) {
              fichierRef.current.value = "";
              fichierRef.current.click();
            }
          }}
        >
          <FileUp size={18} aria-hidden="true" />
          Choisir un fichier
        </button>
        <p id="fichier-selection" role="status" className="m-0 min-w-0 break-words text-sm text-[color:var(--color-encre-faible)]">
          {nomFichier || "Aucun fichier sélectionné"}
        </p>
      </div>

      <p id="fichier-formats" className="aide-champ m-0 text-sm leading-6">
        PDF avec texte sélectionnable, CSV ou Excel (.xlsx) · 4 Mo maximum. La liste doit contenir les noms et prénoms.
      </p>
      {analyse.etat === "erreur" ? (
        <p role="alert" className="m-0 break-words text-sm text-[color:var(--color-erreur)]">{analyse.message}</p>
      ) : null}

      <button
        className="bouton bouton-primaire w-full min-w-0 whitespace-normal py-3 text-center leading-5 sm:w-fit"
        disabled={analyseEnCours || !nomFichier}
      >
        {analyseEnCours ? "Lecture…" : "Analyser et vérifier"}
      </button>
    </form>
  );
}

function ApercuImport({ classe, initiaux, message }: { classe: string; initiaux: readonly EleveImporte[]; message?: string }) {
  const [application, actionAppliquer, applicationEnCours] = useActionState<EtatImportClasse, FormData>(appliquerListe, {});
  const [eleves, setEleves] = useState<EleveImporte[]>([...initiaux]);

  function modifier(index: number, champ: "prenom" | "nom", valeur: string) {
    setEleves((actuels) => actuels.map((eleve, i) => i === index ? { ...eleve, [champ]: valeur } : eleve));
  }

  if (application.etat === "termine") {
    return (
      <section className="min-w-0">
        <p role="status" className="rounded-lg bg-[color:var(--color-succes-fond)] p-4 font-semibold text-[color:var(--color-succes)]">{application.message}</p>
        <ul className="mt-4 divide-y divide-[color:var(--color-bordure)] pl-0">
          {application.resultats?.map((eleve) => (
            <li key={`${eleve.login}-${eleve.nom}`} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <span className="min-w-0 break-words font-medium">{eleve.nom.toUpperCase()} {eleve.prenom}</span>
              <span className="max-w-full break-all font-mono text-sm text-[color:var(--color-encre-faible)]">
                {eleve.login}{eleve.deja ? " · déjà connu" : ""}
              </span>
            </li>
          ))}
        </ul>
        <Link className="bouton bouton-primaire mt-6 w-full min-w-0 whitespace-normal py-3 text-center leading-5 sm:w-auto" href={`/app/classes/${classe}/membres`}>
          Créer les liens ou QR codes d’invitation
        </Link>
      </section>
    );
  }

  return (
    <form action={actionAppliquer} className="min-w-0">
      <input type="hidden" name="classe" value={classe} />
      <input type="hidden" name="eleves" value={JSON.stringify(eleves)} />
      <p role="status" className="mb-4 rounded-lg bg-[color:var(--color-succes-fond)] p-4">{message}</p>
      <p className="mb-5 text-sm leading-6 text-[color:var(--color-encre-faible)]">Vérifie les prénoms et les noms. Tu peux corriger une erreur avant de confirmer.</p>

      <div className="grid min-w-0 gap-3 sm:hidden">
        {eleves.map((eleve, index) => (
          <section key={`${eleve.externe}-${index}`} className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--color-bordure)] p-4">
            <h2 className="m-0 text-sm font-bold">Élève {index + 1} · ligne {eleve.ligne}</h2>
            <div className="min-w-0">
              <label className="etiquette" htmlFor={`prenom-mobile-${index}`}>Prénom</label>
              <input id={`prenom-mobile-${index}`} className="champ min-w-0" value={eleve.prenom} onChange={(e) => modifier(index, "prenom", e.target.value)} maxLength={80} />
            </div>
            <div className="min-w-0">
              <label className="etiquette" htmlFor={`nom-mobile-${index}`}>Nom</label>
              <input id={`nom-mobile-${index}`} className="champ min-w-0" value={eleve.nom} onChange={(e) => modifier(index, "nom", e.target.value)} maxLength={80} />
            </div>
          </section>
        ))}
      </div>

      <div className="hidden min-w-0 overflow-x-auto sm:block">
        <table className="w-full min-w-[480px]">
          <thead><tr><th className="p-2 text-left">Ligne</th><th className="p-2 text-left">Prénom</th><th className="p-2 text-left">Nom</th></tr></thead>
          <tbody>
            {eleves.map((eleve, index) => (
              <tr key={`${eleve.externe}-${index}`} className="border-t border-[color:var(--color-bordure)]">
                <td className="p-2">{eleve.ligne}</td>
                <td className="p-2"><input aria-label={`Prénom, ligne ${eleve.ligne}`} className="champ min-w-0" value={eleve.prenom} onChange={(e) => modifier(index, "prenom", e.target.value)} maxLength={80} /></td>
                <td className="p-2"><input aria-label={`Nom, ligne ${eleve.ligne}`} className="champ min-w-0" value={eleve.nom} onChange={(e) => modifier(index, "nom", e.target.value)} maxLength={80} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {application.etat === "erreur" ? <p role="alert" className="mt-4 break-words text-sm text-[color:var(--color-erreur)]">{application.message}</p> : null}
      <button className="bouton bouton-primaire mt-5 w-full min-w-0 whitespace-normal py-3 text-center leading-5 sm:w-auto" disabled={applicationEnCours}>
        {applicationEnCours ? "Création…" : "Confirmer et préparer les comptes"}
      </button>
    </form>
  );
}

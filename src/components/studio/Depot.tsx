"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importerDocument } from "@/app/professeur/studio/actions";
import { ETAT_IMPORT_STUDIO, type EtatImportStudio } from "@/app/professeur/studio/etats";

/**
 * Dépôt d'un document — S02.
 *
 * Une zone rose, un glisser-déposer et un bouton. Les deux mènent au même
 * endroit : le glisser-déposer est un confort, jamais le seul chemin — au
 * clavier comme au lecteur d'écran, c'est le bouton qui compte (P07).
 *
 * Dès que le serveur a accepté, on ouvre l'éditeur : c'est là que la
 * progression s'affiche, et c'est ce que la personne est venue voir.
 */
export function Depot() {
  const [etat, action] = useActionState<EtatImportStudio, FormData>(
    importerDocument,
    ETAT_IMPORT_STUDIO,
  );
  const [survol, setSurvol] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const routeur = useRouter();

  useEffect(() => {
    if (etat.etat === "envoi" && etat.document) {
      routeur.push(`/professeur/studio/${etat.document}`);
    }
  }, [etat, routeur]);

  function deposer(evenement: React.DragEvent) {
    evenement.preventDefault();
    setSurvol(false);

    const fichier = evenement.dataTransfer.files[0];
    if (fichier === undefined || champ.current === null) return;

    const contenu = new DataTransfer();
    contenu.items.add(fichier);
    champ.current.files = contenu.files;
    formulaire.current?.requestSubmit();
  }

  return (
    <form ref={formulaire} action={action} encType="multipart/form-data">
      <div
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
        className={`rounded-[var(--radius-carte)] border border-dashed px-6 py-12 text-center transition-colors duration-[160ms] ${
          survol
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]"
            : "border-[color:var(--color-rose-decor)] bg-[color:var(--color-rose-clair)]/55"
        }`}
      >
        <p className="m-0 text-[length:var(--text-corps)]">Déposez votre PDF ou Word ici</p>

        <label className="bouton bouton-primaire mt-4 cursor-pointer">
          <input
            ref={champ}
            type="file"
            name="fichier"
            accept=".pdf,.docx"
            className="sr-only"
            onChange={() => formulaire.current?.requestSubmit()}
          />
          Choisir un fichier
        </label>

        <Attente />

        <p className="m-0 mt-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          PDF avec du texte, ou document Word (.docx). 30 Mo et 50 pages au
          maximum. Les documents numérisés ne sont pas encore reconnus.
        </p>

        {etat.etat === "erreur" ? (
          <p
            role="alert"
            className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
          >
            {etat.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Attente() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p role="status" className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
      Transfert du document…
    </p>
  );
}

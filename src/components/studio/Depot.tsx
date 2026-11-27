"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { TAILLE_MAX_DEPOT } from "@/lib/limites-depot";
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
  const [etat, action, pending] = useActionState<EtatImportStudio, FormData>(
    importerDocument,
    ETAT_IMPORT_STUDIO,
  );
  const [erreur, setErreur] = useState("");
  const [nom, setNom] = useState("");
  const [survol, setSurvol] = useState(false);
  const [intention, setIntention] = useState<"conserver" | "transformer">("transformer");
  const intentionEnvoyee = useRef<"conserver" | "transformer">("transformer");
  const champ = useRef<HTMLInputElement>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const routeur = useRouter();

  useEffect(() => {
    if (etat.etat === "envoi" && etat.document) {
      const parametres = new URLSearchParams();
      if (etat.deja) parametres.set("deja", "1");
      if (intentionEnvoyee.current === "conserver") parametres.set("vue", "original");
      routeur.push(`/professeur/studio/${etat.document}${parametres.size ? `?${parametres}` : ""}`);
    }
  }, [etat, routeur]);

  function envoyer(fichier?: File) {
    if (!fichier || pending) return;
    setNom(fichier.name);
    const message = !/\.(pdf|docx)$/i.test(fichier.name) ? "Choisis un PDF ou un Word (.docx)." :
      !fichier.size ? "Ce fichier est vide." : fichier.size > TAILLE_MAX_DEPOT ? "Ce fichier dépasse 4 Mo. Réduis sa taille avant de recommencer." : "";
    setErreur(message);
    if (!message) {
      intentionEnvoyee.current = intention;
      formulaire.current?.requestSubmit();
    }
  }

  function deposer(evenement: React.DragEvent) {
    evenement.preventDefault();
    setSurvol(false);

    const fichier = evenement.dataTransfer.files[0];
    if (fichier === undefined || champ.current === null) return;

    const contenu = new DataTransfer();
    contenu.items.add(fichier);
    champ.current.files = contenu.files;
    envoyer(fichier);
  }

  return (
    <form ref={formulaire} action={action} encType="multipart/form-data">
      <fieldset className="m-0 mb-5 border-0 p-0" disabled={pending}>
        <legend className="mb-3 text-base font-bold">Que veux-tu faire de ton document ?</legend>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="studio-choix-import">
          {([
            ["conserver", "Le garder tel quel", "Consulter ou télécharger ton original intact, même si le PDF ne contient pas de texte."],
            ["transformer", "Le rendre plus beau", "Créer une version modifiable, choisir une mise en page et exporter un nouveau PDF."],
          ] as const).map(([valeur, titre, description]) => (
            <label key={valeur} className={`flex min-h-36 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${intention === valeur ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]"}`}>
              <input
                type="radio"
                name="intention"
                value={valeur}
                checked={intention === valeur}
                onChange={() => setIntention(valeur)}
                className="mt-1 size-5 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="block min-w-0">
                <span className="block text-base font-bold">{titre}</span>
                <span className="mt-2 block text-sm leading-relaxed text-[color:var(--color-encre-faible)]">{description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="m-0 mt-3 text-sm text-[color:var(--color-encre-faible)]">
          Dans les deux cas, le fichier d&apos;origine reste conservé sans modification. AvecStudy prépare aussi une version modifiable en arrière-plan ; tu es libre de ne pas l&apos;utiliser.
          {" "}<Link href="/exemple-pdf" className="font-semibold underline">Voir un vrai exemple avant/après</Link>
        </p>
      </fieldset>
      <div
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
        className={`rounded-[var(--radius-carte)] border border-dashed p-4 sm:p-6 transition-colors duration-[160ms] ${
          survol
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]"
            : "border-[color:var(--color-rose-decor)] bg-[color:var(--color-rose-clair)]/55"
        }`}
      >
        <p className="m-0 text-[length:var(--text-corps)]">{intention === "conserver" ? "Ajouter mon document original" : "Importer le document à améliorer"}</p>

        <label className="bouton bouton-primaire mt-3 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2">
          <input
            ref={champ}
            type="file"
            name="fichier"
            accept=".pdf,.docx"
            className="sr-only"
            disabled={pending}
            onClick={(e) => { e.currentTarget.value = ""; }}
            onChange={(e) => envoyer(e.currentTarget.files?.[0])}
          />
          Choisir un fichier
        </label>

        {pending && <p role="status" className="mt-2 break-words">Transfert de {nom}…</p>}

        <p className="m-0 mt-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          PDF avec texte ou .docx · 4 Mo · 50 pages maximum.
          Relis les tableaux et formules après conversion.
        </p>

        {!pending && (erreur || etat.etat === "erreur") ? (
          <p
            role="alert"
            className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
          >
            {erreur || etat.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { remettreUneCopie } from "@/app/app/devoirs/actions";
import { EnteteRemise } from "@/components/study/Celebrations";
import { ETAT_REMISE_INITIAL, type EtatRemiseAction } from "@/app/app/devoirs/etats";
import { instantLisible } from "@/lib/horodatage";
import { ACCEPT_SUPPORTS, FORMATS_ACCEPTES, tailleLisible } from "@/lib/formats-documents";
import { LIMITE_DEPOT_LIBELLE } from "@/lib/limites-depot";
import { verifierSelectionCopie } from "@/lib/validation-copie";

/**
 * Remettre une copie — cahier V5, §3.2.
 *
 * Trois partis pris, et chacun répond à une inquiétude d'élève.
 *
 * **On voit ce qu'on s'apprête à envoyer.** Le nom et la taille s'affichent
 * avant l'envoi : un élève qui a choisi la mauvaise photo doit s'en apercevoir
 * avant, pas en relisant la confirmation.
 *
 * **La confirmation ne ment pas.** Elle n'apparaît qu'après l'écriture en base
 * et dans le stockage. Tant que le serveur n'a pas répondu, l'écran dit
 * « envoi en cours » — jamais « remis ».
 *
 * **Un double clic ne rend pas deux fois.** Une clé d'idempotence est tirée à
 * l'ouverture de l'écran et voyage avec le formulaire : deux envois portant la
 * même clé ne font qu'une version. Désactiver le bouton ne suffirait pas — un
 * rechargement le réactive.
 */
export function RemiseCopie({
  devoir,
  titreDevoir,
  remplacement,
  dejaRemis,
  enRetardSiRemisMaintenant,
}: {
  devoir: string;
  titreDevoir: string;
  remplacement: boolean;
  dejaRemis: boolean;
  enRetardSiRemisMaintenant: boolean;
}) {
  const [etat, envoyer] = useActionState<EtatRemiseAction, FormData>(
    remettreUneCopie,
    ETAT_REMISE_INITIAL,
  );

  const champ = useId();
  const champFichier = useRef<HTMLInputElement>(null);
  const urlLocale = useRef<string | null>(null);
  const [choisi, setChoisi] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);

  useEffect(() => () => {
    if (urlLocale.current !== null) URL.revokeObjectURL(urlLocale.current);
  }, []);

  function selectionner(fichier: File | null) {
    if (urlLocale.current !== null) URL.revokeObjectURL(urlLocale.current);
    urlLocale.current = null;
    setApercu(null);
    setChoisi(null);

    const erreur = verifierSelectionCopie(fichier);
    setErreurFichier(fichier === null ? null : erreur);
    if (erreur !== null || fichier === null) {
      if (champFichier.current !== null) champFichier.current.value = "";
      return;
    }

    // Une image est décodée par le navigateur comme image. Pas de document
    // tiers dans une iframe ni de lien blob : le serveur vérifie les octets.
    if (["image/png", "image/jpeg", "image/webp"].includes(fichier.type)) {
      urlLocale.current = URL.createObjectURL(fichier);
      setApercu(urlLocale.current);
    }
    setChoisi(fichier);
  }

  // Tirée une fois, à l'ouverture de l'écran, et lisible pendant le rendu —
  // c'est pourquoi c'est un état à initialisation paresseuse et non une ref :
  // une ref ne se lit pas pendant le rendu. Elle change quand la personne
  // revient déposer une autre version : c'est bien un autre envoi.
  const [cle] = useState(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  if (etat.etat === "remis") {
    return <AccuseDeRemise etat={etat} />;
  }

  if (dejaRemis && !remplacement) {
    return (
      <p className="m-0 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4 text-[length:var(--text-tableau)]">
        Votre copie est remise. Ce devoir n&apos;autorise pas de la remplacer.
      </p>
    );
  }

  return (
    <form action={envoyer} encType="multipart/form-data" data-testid="remise-formulaire">
      <input type="hidden" name="devoir" value={devoir} />
      <input type="hidden" name="idempotence" value={cle} />

      <div
        onDragOver={(evenement) => {
          if (!evenement.dataTransfer.types.includes("Files")) return;
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setSurvol(false);
          const fichier = evenement.dataTransfer.files[0] ?? null;
          if (fichier !== null && champFichier.current !== null) {
            const transfert = new DataTransfer();
            transfert.items.add(fichier);
            champFichier.current.files = transfert.files;
          }
          selectionner(fichier);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors focus-within:border-[color:var(--color-accent)] ${survol ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)]"}`}
        data-testid="remise-zone-fichier"
      >
        <label className="etiquette mb-3 block text-center" htmlFor={champ}>
          {dejaRemis ? "Choisir une nouvelle version" : "Choisir ma copie"}
        </label>
        <input
          ref={champFichier}
          id={champ}
          data-testid="remise-fichier"
          name="copie"
          type="file"
          accept={ACCEPT_SUPPORTS}
          required
          aria-describedby={`${champ}-aide`}
          className="sr-only"
          onChange={(evenement) => selectionner(evenement.target.files?.[0] ?? null)}
        />
        <label htmlFor={champ} className="bouton bouton-secondaire inline-flex cursor-pointer items-center justify-center">
          Choisir mon fichier
        </label>
        <p className="m-0 mt-3 text-sm text-[color:var(--color-encre-faible)]">
          Ou glisse-le ici depuis ton ordinateur.
        </p>
      </div>

      <p id={`${champ}-aide`} className="aide-champ">
        {FORMATS_ACCEPTES} · {LIMITE_DEPOT_LIBELLE} maximum. Le format est vérifié sur le contenu du fichier.
      </p>

      {erreurFichier !== null ? (
        <p role="alert" data-testid="remise-erreur-fichier" className="m-0 mt-3 text-sm font-semibold text-[color:var(--color-erreur)]">
          {erreurFichier}
        </p>
      ) : null}

      {choisi !== null ? (
        <div data-testid="remise-choisi" className="mt-4 rounded-xl border border-[color:var(--color-bordure)] p-4">
          <h3 className="m-0 text-lg font-bold">Vérifie avant d&apos;envoyer</h3>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
            <dt className="font-semibold">Devoir</dt><dd className="m-0 break-words">{titreDevoir}</dd>
            <dt className="font-semibold">Fichier</dt><dd className="m-0 break-all">{choisi.name}</dd>
            <dt className="font-semibold">Taille</dt><dd className="m-0">{tailleLisible(choisi.size)}</dd>
          </dl>
          {apercu !== null && choisi.type.startsWith("image/") ? (
            <Image src={apercu} alt="Aperçu local de la copie sélectionnée" width={440} height={260} unoptimized className="mt-3 max-h-64 w-full rounded-lg object-contain" />
          ) : null}
          <button
            type="button"
            data-testid="remise-retirer-fichier"
            onClick={() => selectionner(null)}
            className="bouton bouton-secondaire bouton-compact mt-4"
          >
            Retirer et choisir un autre fichier
          </button>
          {dejaRemis ? (
            <p className="m-0 mt-3 text-sm text-[color:var(--color-encre-faible)]">
              La nouvelle version deviendra la copie courante. L&apos;historique de l&apos;ancienne sera conservé.
            </p>
          ) : null}
        </div>
      ) : null}

      {enRetardSiRemisMaintenant ? (
        <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-erreur)]">
          L&apos;échéance est passée : votre copie sera enregistrée comme remise
          en retard. Votre professeur le verra.
        </p>
      ) : null}

      {etat.etat === "erreur" ? (
        <p
          role="alert"
          data-testid="remise-erreur"
          className="m-0 mt-4 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonRemettre dejaRemis={dejaRemis} disponible={choisi !== null} />
    </form>
  );
}

function BoutonRemettre({ dejaRemis, disponible }: { dejaRemis: boolean; disponible: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        data-testid="remise-envoyer"
        disabled={pending || !disponible}
        className="bouton bouton-primaire mt-4"
      >
        {pending ? "Envoi en cours…" : dejaRemis ? "Confirmer le remplacement" : "Confirmer et remettre ma copie"}
      </button>

      {/* Annoncé aux lecteurs d'écran : un envoi silencieux laisse croire que
          rien ne se passe, et la personne clique une seconde fois. */}
      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Envoi de votre copie en cours." : ""}
      </p>
    </>
  );
}

/**
 * L'accusé d'enregistrement.
 *
 * Ce n'est **pas** une preuve juridique, et l'écran le dit. C'est ce que le
 * serveur a enregistré : une référence, un instant, un état. Laisser croire à
 * une valeur probante serait promettre ce qu'on ne peut pas tenir.
 */
export function AccuseDeRemise({ etat }: { etat: Extract<EtatRemiseAction, { etat: "remis" }> }) {
  return (
    <div
      data-testid="remise-accuse"
      className="relative overflow-hidden rounded-[var(--rayon-xl)] border border-t-[3px] border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-5 shadow-[var(--ombre-douce)]"
    >
      <EnteteRemise />
      <h3 className="m-0 mt-3 text-center text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-succes)]">
        Copie remise !
      </h3>
      <p className="m-0 mt-1 text-center text-[color:var(--color-encre-faible)]">Ton devoir a bien été envoyé.</p>

      <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-[length:var(--text-tableau)] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="font-semibold">Référence</dt>
        <dd className="m-0 font-mono" data-testid="remise-reference">
          {etat.reference}
        </dd>

        <dt className="font-semibold">Enregistrée le</dt>
        <dd className="m-0">{instantLisible(etat.remisLe)}</dd>

        <dt className="font-semibold">Version</dt>
        <dd className="m-0">n° {etat.numero}</dd>

        <dt className="font-semibold">État</dt>
        <dd className="m-0">{etat.enRetard ? "Remise en retard" : "Remise à l'heure"}</dd>
      </dl>

      <p className="m-0 mt-4 max-w-[60ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Cet accusé est un enregistrement interne à AvecStudy, horodaté par le
        serveur. Ce n&apos;est pas un constat juridique. Rechargez la page :
        votre copie y sera.
      </p>
    </div>
  );
}

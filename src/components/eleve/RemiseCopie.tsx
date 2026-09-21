"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { remettreUneCopie } from "@/app/eleve/devoirs/actions";
import { ETAT_REMISE_INITIAL, type EtatRemiseAction } from "@/app/eleve/devoirs/etats";
import { instantLisible } from "@/lib/horodatage";
import { tailleLisible } from "@/lib/formats-documents";

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
  remplacement,
  dejaRemis,
  enRetardSiRemisMaintenant,
}: {
  devoir: string;
  remplacement: boolean;
  dejaRemis: boolean;
  enRetardSiRemisMaintenant: boolean;
}) {
  const [etat, envoyer] = useActionState<EtatRemiseAction, FormData>(
    remettreUneCopie,
    ETAT_REMISE_INITIAL,
  );

  const champ = useId();
  const [choisi, setChoisi] = useState<{ nom: string; taille: number } | null>(null);

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
      <p className="m-0 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-fond-doux)] p-4 text-[length:var(--text-tableau)]">
        Votre copie est remise. Ce devoir n&apos;autorise pas de la remplacer.
      </p>
    );
  }

  return (
    <form action={envoyer} encType="multipart/form-data" data-testid="remise-formulaire">
      <input type="hidden" name="devoir" value={devoir} />
      <input type="hidden" name="idempotence" value={cle} />

      <label className="etiquette" htmlFor={champ}>
        {dejaRemis ? "Remplacer ma copie" : "Ma copie"}
      </label>

      <input
        id={champ}
        data-testid="remise-fichier"
        name="copie"
        type="file"
        required
        aria-describedby={`${champ}-aide`}
        className="champ h-auto py-2"
        onChange={(evenement) => {
          const fichier = evenement.target.files?.[0];
          setChoisi(fichier === undefined ? null : { nom: fichier.name, taille: fichier.size });
        }}
      />

      <p id={`${champ}-aide`} className="aide-champ">
        PDF, image ou document. 20 Mo au maximum. Le fichier est vérifié sur son
        contenu, pas sur son nom.
      </p>

      {choisi !== null ? (
        <p
          data-testid="remise-choisi"
          className="m-0 mt-3 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-3 text-[length:var(--text-tableau)]"
        >
          Prêt à envoyer : <strong>{choisi.nom}</strong>{" "}
          <span className="text-[color:var(--color-encre-faible)]">
            ({tailleLisible(choisi.taille)})
          </span>
        </p>
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

      <BoutonRemettre dejaRemis={dejaRemis} />
    </form>
  );
}

function BoutonRemettre({ dejaRemis }: { dejaRemis: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        data-testid="remise-envoyer"
        disabled={pending}
        className="bouton bouton-primaire mt-4"
      >
        {pending ? "Envoi en cours…" : dejaRemis ? "Remplacer ma copie" : "Remettre ma copie"}
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
function AccuseDeRemise({ etat }: { etat: Extract<EtatRemiseAction, { etat: "remis" }> }) {
  return (
    <div
      data-testid="remise-accuse"
      className="carte border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-5"
    >
      <h3 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-succes)]">
        Copie remise
      </h3>

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

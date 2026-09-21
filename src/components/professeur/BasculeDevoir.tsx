"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { basculerArchive, basculerPublication } from "@/app/professeur/devoirs/actions";
import { ETAT_DEVOIR_INITIAL, type EtatDevoirAction } from "@/app/professeur/devoirs/etats";

/**
 * Publier, dépublier, archiver — cahier V5, §2.1.
 *
 * Trois gestes, trois formulaires distincts : chacun marche sans JavaScript,
 * et aucun n'a besoin de savoir ce que font les autres.
 *
 * Dépublier n'est possible que tant que personne n'a rien rendu. Le refus
 * vient du serveur, avec sa raison : le masquer ici ferait disparaître le
 * bouton sans que le professeur comprenne pourquoi.
 */
export function BasculeDevoir({
  devoir,
  publie,
  archive,
}: {
  devoir: string;
  publie: boolean;
  archive: boolean;
}) {
  const [etatPublication, publier] = useActionState<EtatDevoirAction, FormData>(
    basculerPublication,
    ETAT_DEVOIR_INITIAL,
  );
  const [etatArchive, archiver] = useActionState<EtatDevoirAction, FormData>(
    basculerArchive,
    ETAT_DEVOIR_INITIAL,
  );

  const retour = etatPublication.etat !== "vierge" ? etatPublication : etatArchive;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {!archive ? (
          <form action={publier}>
            <input type="hidden" name="devoir" value={devoir} />
            <input type="hidden" name="publier" value={publie ? "non" : "oui"} />
            <Bouton
              libelle={publie ? "Dépublier" : "Publier à la classe"}
              marque="devoir-publication"
              principal={!publie}
            />
          </form>
        ) : null}

        <form action={archiver}>
          <input type="hidden" name="devoir" value={devoir} />
          <input type="hidden" name="archiver" value={archive ? "non" : "oui"} />
          <Bouton
            libelle={archive ? "Sortir des archives" : "Archiver"}
            marque="devoir-archive"
            principal={false}
          />
        </form>
      </div>

      {retour.etat !== "vierge" ? (
        <p
          role={retour.etat === "erreur" ? "alert" : "status"}
          data-testid="bascule-retour"
          className={`m-0 mt-3 max-w-[60ch] text-[length:var(--text-tableau)] ${
            retour.etat === "erreur"
              ? "text-[color:var(--color-erreur)]"
              : "text-[color:var(--color-succes)]"
          }`}
        >
          {retour.message}
        </p>
      ) : null}
    </div>
  );
}

function Bouton({
  libelle,
  marque,
  principal,
}: {
  libelle: string;
  marque: string;
  principal: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className={`bouton ${principal ? "bouton-primaire" : "bouton-secondaire"}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}

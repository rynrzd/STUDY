"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { archiverChapitre, deplacerChapitre, renommerChapitre } from "@/app/studio/actions";
import { ETAT_STUDIO_INITIAL, type EtatStudio } from "@/app/studio/etats";

/**
 * Gestes d'un chapitre — cahier des charges ch. 13 (COURS-02) : renommer,
 * monter, descendre, archiver ou restaurer. Des boutons, pas de glisser-
 * déposer : tout se fait au clavier. Archiver ne touche pas aux séances.
 */
export function GestesChapitre({ id, label, premier, dernier, archive = false }: { id: string; label: string; premier: boolean; dernier: boolean; archive?: boolean }) {
  const [renommage, setRenommage] = useState(false);
  const garde = (f: (p: EtatStudio, d: FormData) => Promise<EtatStudio>) => async (p: EtatStudio, d: FormData) => {
    try {
      return await f(p, d);
    } catch {
      return { etat: "erreur" as const, message: "La réponse du serveur n'est pas arrivée." };
    }
  };
  const [etatNom, actionNom] = useActionState<EtatStudio, FormData>(async (p, d) => {
    const r = await garde(renommerChapitre)(p, d);
    if (r.etat === "ok") setRenommage(false);
    return r;
  }, ETAT_STUDIO_INITIAL);
  const [etatOrdre, actionOrdre] = useActionState<EtatStudio, FormData>(garde(deplacerChapitre), ETAT_STUDIO_INITIAL);
  const [etatArchive, actionArchive] = useActionState<EtatStudio, FormData>(garde(archiverChapitre), ETAT_STUDIO_INITIAL);
  const erreur = [etatNom, etatOrdre, etatArchive].find((e) => e.etat === "erreur");

  if (renommage) {
    return (
      <form action={actionNom} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`nom-chapitre-${id}`}>
          Nouveau titre du chapitre
        </label>
        <input id={`nom-chapitre-${id}`} name="label" defaultValue={label} maxLength={120} required autoFocus className="champ h-10 py-0 text-[0.875rem]" />
        <button type="submit" className="bouton bouton-compact bouton-primaire">
          Renommer
        </button>
        <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setRenommage(false)}>
          Annuler
        </button>
        {etatNom.etat === "erreur" ? <span role="alert" className="text-[0.8125rem] text-[color:var(--color-erreur)]">{etatNom.message}</span> : null}
      </form>
    );
  }

  return (
    <div className="gestes-chapitre flex flex-wrap items-center gap-1">
      {archive ? null : (
        <>
          <button type="button" className="bouton-icone" aria-label={`Renommer le chapitre « ${label} »`} title="Renommer" onClick={() => setRenommage(true)}>
            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <form action={actionOrdre}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="sens" value="haut" />
            <button type="submit" className="bouton-icone" disabled={premier} aria-label={`Monter le chapitre « ${label} »`} title="Monter">
              <ArrowUp size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
          <form action={actionOrdre}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="sens" value="bas" />
            <button type="submit" className="bouton-icone" disabled={dernier} aria-label={`Descendre le chapitre « ${label} »`} title="Descendre">
              <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
        </>
      )}
      <form action={actionArchive}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archiver" value={archive ? "non" : "oui"} />
        <button type="submit" className="bouton bouton-compact bouton-discret" aria-label={`${archive ? "Restaurer" : "Archiver"} le chapitre « ${label} »`}>
          {archive ? <ArchiveRestore size={16} strokeWidth={1.75} aria-hidden="true" /> : <Archive size={16} strokeWidth={1.75} aria-hidden="true" />} {archive ? "Restaurer" : "Archiver"}
        </button>
      </form>
      {erreur ? (
        <span role="alert" className="w-full text-[0.8125rem] text-[color:var(--color-erreur)]">
          {erreur.message}
        </span>
      ) : null}
    </div>
  );
}

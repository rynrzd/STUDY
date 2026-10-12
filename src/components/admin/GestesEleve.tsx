"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightLeft, CircleAlert, CircleCheck, LogOut, Minus, Plus, Equal } from "lucide-react";
import { apercuDuChangement, changerDeClasse, enregistrerDepart } from "@/app/admin/eleves/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

interface MouvementCours {
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly mouvement: "perdu" | "gagne" | "garde";
}

interface Option {
  readonly id: string;
  readonly label: string;
}

/**
 * Gestes de la fiche élève — cahier des charges ch. 09 (EL-03, EL-04, EL-11).
 *
 * Changer de classe montre d'abord ce que l'élève perdra, gagnera et gardera :
 * on ne déplace pas quelqu'un sans savoir ce que ça change pour lui. Le départ
 * se confirme en deux temps, et dit ce qui est conservé.
 */
export function ChangerClasse({ eleve, classes, actuelle }: { eleve: string; classes: readonly Option[]; actuelle: string | null }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(securiser(changerDeClasse), ETAT_ADMIN_INITIAL);
  const [classe, setClasse] = useState("");
  const [apercu, setApercu] = useState<{ classe: string; mouvements: readonly MouvementCours[] | null } | null>(null);

  async function choisir(id: string) {
    setClasse(id);
    if (id === "") {
      setApercu(null);
      return;
    }
    const mouvements = await apercuDuChangement(eleve, id).catch(() => null);
    setApercu({ classe: id, mouvements });
  }

  const libelle = classes.find((c) => c.id === classe)?.label ?? "";
  const pret = apercu !== null && apercu.classe === classe;

  return (
    <form action={action}>
      <input type="hidden" name="eleve" value={eleve} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <label className="etiquette" htmlFor="nouvelle-classe">
            Nouvelle classe
          </label>
          <select id="nouvelle-classe" name="classe" className="champ" value={classe} onChange={(e) => void choisir(e.target.value)} required>
            <option value="">Choisir…</option>
            {classes
              .filter((c) => c.label !== actuelle)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="date-changement">
            À partir du <span className="font-normal text-[color:var(--color-encre-faible)]">(vide : aujourd&apos;hui)</span>
          </label>
          <input id="date-changement" name="date" type="date" className="champ" />
        </div>
      </div>

      {classe !== "" ? (
        <div className="mt-4 rounded-[var(--rayon-m)] border border-[color:var(--bordure-douce,var(--color-bordure))] p-4" aria-live="polite">
          <p className="m-0 font-bold">Ce que ça change</p>
          {!pret ? (
            <p className="meta m-0 mt-2">Calcul…</p>
          ) : apercu.mouvements === null ? (
            <p className="meta m-0 mt-2">L&apos;aperçu est indisponible. Le changement reste possible.</p>
          ) : apercu.mouvements.length === 0 ? (
            <p className="meta m-0 mt-2">Aucun cours n&apos;est encore ouvert dans ces classes.</p>
          ) : (
            <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-[0.9375rem]">
              {apercu.mouvements.map((m, i) => (
                <li key={`${m.mouvement}-${m.cible}-${m.matiere}-${i}`} className="flex items-center gap-2">
                  <span className="mouvement-cours" data-mouvement={m.mouvement} aria-hidden="true">
                    {m.mouvement === "perdu" ? <Minus size={12} strokeWidth={3} /> : m.mouvement === "gagne" ? <Plus size={12} strokeWidth={3} /> : <Equal size={12} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="font-semibold">{m.matiere}</span> · {m.cible}
                    <span className="meta"> — {m.mouvement === "perdu" ? "n'y aura plus accès" : m.mouvement === "gagne" ? "y aura accès" : "garde l'accès (groupe)"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="meta m-0 mt-3">Ses copies, rendus et notes restent rattachés aux cours où ils ont été faits.</p>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Envoyer libelle={libelle === "" ? "Changer de classe" : `Déplacer en ${libelle}`} desactive={classe === ""} icone="deplacer" />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

export function DepartEleve({ eleve, nom }: { eleve: string; nom: string }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(securiser(enregistrerDepart), ETAT_ADMIN_INITIAL);
  const [confirmation, setConfirmation] = useState(false);

  if (etat.etat === "ok") return <Retour etat={etat} />;

  return (
    <form action={action}>
      <input type="hidden" name="eleve" value={eleve} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="date-depart">
            Dernier jour <span className="font-normal text-[color:var(--color-encre-faible)]">(vide : aujourd&apos;hui)</span>
          </label>
          <input id="date-depart" name="date" type="date" className="champ" />
        </div>
        <label className="flex items-end gap-2 pb-3 text-[0.9375rem]">
          <input type="checkbox" name="suspendre" value="oui" defaultChecked className="size-4 accent-[color:var(--color-accent)]" />
          Désactiver aussi son compte
        </label>
      </div>

      {!confirmation ? (
        <div className="mt-4 flex justify-end">
          <button type="button" className="bouton bouton-secondaire" onClick={() => setConfirmation(true)}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" /> Enregistrer le départ…
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--rayon-m)] bg-[color:var(--color-attention-fond)] p-4">
          <p className="m-0 font-bold text-[color:var(--color-attention)]">Confirmer le départ de {nom} ?</p>
          <p className="m-0 mt-1 text-[0.9375rem]">
            Sa classe et ses groupes seront clos au dernier jour indiqué : il ne verra plus aucun cours ensuite. Rien n&apos;est supprimé ; ses copies et son historique restent.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="bouton bouton-secondaire" onClick={() => setConfirmation(false)}>
              Annuler
            </button>
            <Envoyer libelle="Confirmer le départ" icone="depart" />
          </div>
        </div>
      )}
      <Retour etat={etat} />
    </form>
  );
}

/** Une réponse perdue ne finit pas sur l'écran d'erreur général. */
function securiser(action: (p: EtatAdmin, d: FormData) => Promise<EtatAdmin>) {
  return async (precedent: EtatAdmin, donnees: FormData): Promise<EtatAdmin> => {
    try {
      return await action(precedent, donnees);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la fiche pour voir l'état réel." };
    }
  };
}

function Envoyer({ libelle, desactive = false, icone }: { libelle: string; desactive?: boolean; icone: "deplacer" | "depart" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || desactive} className="bouton bouton-primaire">
      {icone === "deplacer" ? <ArrowRightLeft size={18} strokeWidth={1.75} aria-hidden="true" /> : <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />}
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.etat === "vierge" || etat.message === undefined) return null;
  const ok = etat.etat === "ok";
  const Icone = ok ? CircleCheck : CircleAlert;
  return (
    <p role="status" className="resultat-publication m-0 mt-3" data-ton={ok ? "ok" : "erreur"}>
      <Icone size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> {etat.message}
    </p>
  );
}

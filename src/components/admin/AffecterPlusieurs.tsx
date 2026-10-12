"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, Link2, Plus, Trash2, X } from "lucide-react";
import { affecterPlusieursCours } from "@/app/admin/actions";
import { ETAT_AFFECTATIONS_INITIAL, type EtatAffectations } from "@/app/admin/etats";

interface Option {
  readonly id: string;
  readonly label: string;
}

/**
 * Affecter un professeur à plusieurs cours en une fois — cahier des charges,
 * ch. 08 (PROF-03 à PROF-05).
 *
 * Chaque ligne est un couple explicite « classe ou groupe × matière » : la
 * fenêtre ne fabrique jamais de combinaisons que personne n'a écrites. Le
 * résultat revient ligne par ligne (créée, déjà en place, refusée) ; rejouer
 * la demande ne crée rien de plus.
 */
export function AffecterPlusieurs({
  professeur,
  nom,
  classes,
  groupes,
  matieres,
  libelle = "Affecter à des cours",
  variante = "secondaire",
}: {
  professeur: string;
  nom: string;
  classes: readonly Option[];
  groupes: readonly Option[];
  matieres: readonly Option[];
  libelle?: string;
  variante?: "primaire" | "secondaire";
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [cle, setCle] = useState(0);
  const idTitre = useId();

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <>
      <button ref={declencheur} type="button" className={`bouton bouton-compact bouton-${variante}`} onClick={() => setOuvert(true)}>
        <Link2 size={16} strokeWidth={1.75} aria-hidden="true" /> {libelle}
      </button>
      <dialog
        ref={dialogue}
        className="dialogue dialogue-large"
        aria-labelledby={idTitre}
        onClose={() => {
          setOuvert(false);
          setCle((n) => n + 1);
          declencheur.current?.focus();
        }}
      >
        {ouvert ? (
          <Contenu key={cle} idTitre={idTitre} professeur={professeur} nom={nom} classes={classes} groupes={groupes} matieres={matieres} fermer={() => setOuvert(false)} />
        ) : null}
      </dialog>
    </>
  );
}

interface Ligne {
  readonly id: number;
  readonly cible: string; // « classe:<uuid> » ou « groupe:<uuid> »
  readonly matiere: string;
}

function Contenu({
  idTitre,
  professeur,
  nom,
  classes,
  groupes,
  matieres,
  fermer,
}: {
  idTitre: string;
  professeur: string;
  nom: string;
  classes: readonly Option[];
  groupes: readonly Option[];
  matieres: readonly Option[];
  fermer: () => void;
}) {
  const [etat, action] = useActionState<EtatAffectations, FormData>(async (precedent, donnees) => {
    try {
      return await affecterPlusieursCours(precedent, donnees);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rouvrez la fiche : rejouer ne crée pas de doublon." };
    }
  }, ETAT_AFFECTATIONS_INITIAL);
  const [lignes, setLignes] = useState<readonly Ligne[]>([{ id: 1, cible: "", matiere: "" }]);
  const [suivant, setSuivant] = useState(2);
  // Les libellés des lignes envoyées, figés au moment de l'envoi : le résultat
  // doit nommer ce qui a été demandé, même si on retouche la liste ensuite.
  const [envoyees, setEnvoyees] = useState<readonly string[]>([]);

  const nomDe = new Map<string, string>([
    ...classes.map((c) => [`classe:${c.id}`, c.label] as const),
    ...groupes.map((g) => [`groupe:${g.id}`, g.label] as const),
  ]);
  const matiereDe = new Map(matieres.map((m) => [m.id, m.label]));
  const completes = lignes.filter((l) => l.cible !== "" && l.matiere !== "");
  const charge = JSON.stringify(
    completes.map((l) => {
      const [genre, cible] = l.cible.split(":");
      return { genre, cible, matiere: l.matiere };
    }),
  );

  function modifier(id: number, champ: "cible" | "matiere", valeur: string) {
    setLignes((prec) => prec.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));
  }

  if (classes.length + groupes.length === 0 || matieres.length === 0) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitre} className="titre-section">
            Affecter {nom}
          </h2>
          <BoutonFermer fermer={fermer} />
        </div>
        <p className="ajout-identifiant mt-4">Il faut au moins une classe ou un groupe, et une matière, pour créer un cours.</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setEnvoyees(completes.map((l) => `${matiereDe.get(l.matiere) ?? "Matière"} — ${nomDe.get(l.cible) ?? "Cours"}`))}
    >
      <input type="hidden" name="professeur" value={professeur} />
      <input type="hidden" name="lignes" value={charge} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={idTitre} className="titre-section">
            Affecter {nom}
          </h2>
          <p className="m-0 mt-1 text-[color:var(--color-encre-faible)]">Une ligne par cours : une classe ou un groupe, et la matière enseignée.</p>
        </div>
        <BoutonFermer fermer={fermer} />
      </div>

      <ul className="m-0 mt-5 list-none space-y-3 p-0">
        {lignes.map((l, i) => (
          <li key={l.id} className="ligne-affectation">
            <span className="ligne-affectation-rang" aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <label className="sr-only" htmlFor={`cible-${l.id}`}>
                Classe ou groupe, ligne {i + 1}
              </label>
              <select id={`cible-${l.id}`} className="champ" value={l.cible} onChange={(e) => modifier(l.id, "cible", e.target.value)}>
                <option value="">Classe ou groupe…</option>
                {classes.length > 0 ? (
                  <optgroup label="Classes">
                    {classes.map((c) => (
                      <option key={c.id} value={`classe:${c.id}`}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupes.length > 0 ? (
                  <optgroup label="Groupes">
                    {groupes.map((g) => (
                      <option key={g.id} value={`groupe:${g.id}`}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </span>
            <span className="min-w-0 flex-1">
              <label className="sr-only" htmlFor={`matiere-${l.id}`}>
                Matière, ligne {i + 1}
              </label>
              <select id={`matiere-${l.id}`} className="champ" value={l.matiere} onChange={(e) => modifier(l.id, "matiere", e.target.value)}>
                <option value="">Matière…</option>
                {matieres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </span>
            <button
              type="button"
              className="ajout-fermer"
              aria-label={`Retirer la ligne ${i + 1}`}
              disabled={lignes.length === 1}
              onClick={() => setLignes((prec) => prec.filter((x) => x.id !== l.id))}
            >
              <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[0.9375rem] font-semibold text-[color:var(--color-accent)]"
        disabled={lignes.length >= 60}
        onClick={() => {
          setLignes((prec) => [...prec, { id: suivant, cible: "", matiere: "" }]);
          setSuivant((n) => n + 1);
        }}
      >
        <Plus size={18} strokeWidth={2} aria-hidden="true" /> Ajouter un cours
      </button>

      {etat.etat !== "vierge" && etat.message !== undefined ? (
        <div className="mt-4" role="status">
          <p className="resultat-publication m-0" data-ton={etat.etat}>
            {etat.etat === "ok" ? <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> : <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />} {etat.message}
          </p>
          {etat.issues !== undefined ? (
            <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[0.875rem]">
              {etat.issues.map((issue) => (
                <li key={issue.rang} className="flex justify-between gap-3">
                  <span className="font-semibold">{envoyees[issue.rang - 1] ?? `Ligne ${issue.rang}`}</span>
                  <span className={issue.resultat === "refusee" ? "text-[color:var(--color-erreur)]" : issue.resultat === "creee" ? "text-[color:var(--color-succes)]" : "meta"}>
                    {issue.resultat === "creee" ? "Créée" : issue.resultat === "existante" ? "Déjà en place" : (RAISONS[issue.raison ?? ""] ?? "Refusée")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="ajout-actions">
        <span className="meta">
          {completes.length === 0 ? "Aucune ligne complète" : `${completes.length} cours à affecter`}
          {completes.length < lignes.length ? ` · ${lignes.length - completes.length} ligne${lignes.length - completes.length > 1 ? "s" : ""} incomplète${lignes.length - completes.length > 1 ? "s" : ""}, ignorée${lignes.length - completes.length > 1 ? "s" : ""}` : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="bouton bouton-secondaire" onClick={fermer}>
            {etat.etat === "vierge" ? "Annuler" : "Terminer"}
          </button>
          <Envoyer nombre={completes.length} />
        </div>
      </div>
    </form>
  );
}

const RAISONS: Record<string, string> = {
  cible_introuvable: "Refusée : classe ou groupe indisponible",
  matiere_introuvable: "Refusée : matière indisponible",
  doublon_dans_la_demande: "Refusée : ligne en double",
  ligne_invalide: "Refusée : ligne incomplète",
  erreur: "Refusée : erreur, réessayez",
};

function Envoyer({ nombre }: { nombre: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || nombre === 0} className="bouton bouton-primaire">
      {pending ? "Affectation…" : nombre <= 1 ? "Affecter" : `Affecter ${nombre} cours`}
    </button>
  );
}

function BoutonFermer({ fermer }: { fermer: () => void }) {
  return (
    <button type="button" className="ajout-fermer" onClick={fermer} aria-label="Fermer">
      <X size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

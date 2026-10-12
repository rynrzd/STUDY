"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleAlert, CircleCheck, Layers, Search, UserMinus, Users } from "lucide-react";
import {
  affecterUnProfesseurAuGroupe,
  ajouterDesEleves,
  creerUnGroupe,
  retirerUnEleve,
} from "@/app/admin/groupes/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

interface Option {
  readonly id: string;
  readonly label: string;
}
interface EleveChoisissable {
  readonly profile_id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly classe: string | null;
}

/* ------------------------------------------------------------ Créer -------- */

const GENRES = [
  { valeur: "interclasses", titre: "Interclasses", detail: "Des élèves de plusieurs classes (spécialité, langue, option).", Icone: Layers },
  { valeur: "sous_groupe", titre: "Demi-groupe", detail: "Un sous-ensemble d'une même classe (TP, groupe de besoin).", Icone: Users },
] as const;

export function CreerGroupe() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUnGroupe, ETAT_ADMIN_INITIAL);
  const [kind, setKind] = useState<"interclasses" | "sous_groupe">("interclasses");

  return (
    <form action={action} className="panneau">
      <h2 className="titre-bloc m-0 font-bold">Créer un groupe</h2>
      <p className="meta m-0 mt-1 max-w-[62ch]">
        Un groupe réunit des élèves choisis un par un ; il ne change pas leur classe principale. Ensuite, vous ajoutez les élèves et affectez un professeur.
      </p>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="etiquette p-0">Type de groupe</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {GENRES.map(({ valeur, titre, detail, Icone }) => (
            <label key={valeur} className="choix-role" data-actif={kind === valeur ? "" : undefined}>
              <input type="radio" name="kind" value={valeur} checked={kind === valeur} onChange={() => setKind(valeur)} className="sr-only" />
              <span className="choix-role-icone" aria-hidden="true">
                <Icone size={22} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{titre}</span>
                <span className="meta block">{detail}</span>
              </span>
              <span className="choix-role-coche" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="etiquette mt-4" htmlFor="groupe-label">
        Nom du groupe
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="groupe-label" name="label" type="text" className="champ min-w-0 flex-1" placeholder="Spé Maths A" required minLength={2} maxLength={80} />
        <BoutonSoumettre libelle="Créer le groupe" enCours="Création…" />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/* ----------------------------------------------- Ajouter des élèves -------- */

export function AjouterEleves({ groupe, eligibles }: { groupe: string; eligibles: readonly EleveChoisissable[] }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(ajouterDesEleves, ETAT_ADMIN_INITIAL);
  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState("");
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set());

  const classes = useMemo(() => [...new Set(eligibles.map((e) => e.classe ?? "Sans classe"))].sort(), [eligibles]);
  const visibles = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return eligibles.filter((e) => {
      if (classe !== "" && (e.classe ?? "Sans classe") !== classe) return false;
      if (r === "") return true;
      return `${e.prenom} ${e.nom}`.toLowerCase().includes(r);
    });
  }, [eligibles, recherche, classe]);

  function basculer(id: string) {
    setChoisis((prec) => {
      const suite = new Set(prec);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
  }

  if (eligibles.length === 0) {
    return (
      <p className="meta m-0">
        Tous les élèves de l&apos;établissement sont déjà dans ce groupe, ou aucun élève n&apos;existe encore.
      </p>
    );
  }

  return (
    <form action={action} onSubmit={() => setChoisis(new Set())}>
      <input type="hidden" name="groupe" value={groupe} />
      <div className="flex flex-wrap items-end gap-2">
        <span className="relative min-w-0 flex-1">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-encre-faible)]" />
          <label htmlFor="picker-recherche" className="sr-only">
            Rechercher un élève
          </label>
          <input id="picker-recherche" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un élève" className="champ pl-10" />
        </span>
        {classes.length > 1 ? (
          <span className="min-w-0">
            <label htmlFor="picker-classe" className="sr-only">
              Filtrer par classe
            </label>
            <select id="picker-classe" value={classe} onChange={(e) => setClasse(e.target.value)} className="champ">
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
        ) : null}
      </div>

      <div className="picker-liste mt-3" role="group" aria-label="Élèves à ajouter">
        {visibles.length === 0 ? (
          <p className="meta m-0 px-1 py-6 text-center">Aucun élève ne correspond.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {visibles.map((e) => {
              const coche = choisis.has(e.profile_id);
              return (
                <li key={e.profile_id}>
                  <label className="picker-ligne" data-actif={coche ? "" : undefined}>
                    <input type="checkbox" name="eleve" value={e.profile_id} checked={coche} onChange={() => basculer(e.profile_id)} className="sr-only" />
                    <span className="picker-coche" aria-hidden="true">
                      {coche ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{e.nom.toUpperCase()}</span> {e.prenom}
                    </span>
                    <span className="meta shrink-0">{e.classe ?? "Sans classe"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="meta" aria-live="polite">
          {choisis.size === 0 ? "Aucun élève sélectionné" : `${choisis.size} élève${choisis.size > 1 ? "s" : ""} sélectionné${choisis.size > 1 ? "s" : ""}`}
        </span>
        <BoutonSoumettre libelle="Ajouter au groupe" enCours="Ajout…" desactive={choisis.size === 0} />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------- Affecter un professeur ------- */

export function AffecterProfesseurGroupe({ groupe, professeurs, matieres }: { groupe: string; professeurs: readonly Option[]; matieres: readonly Option[] }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(affecterUnProfesseurAuGroupe, ETAT_ADMIN_INITIAL);

  if (professeurs.length === 0 || matieres.length === 0) {
    return (
      <p className="ajout-identifiant m-0">
        Il faut au moins un professeur et une matière dans l&apos;établissement pour affecter un cours à ce groupe.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="groupe" value={groupe} />
      <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Choix nom="professeur" libelle="Professeur" options={professeurs} />
        <Choix nom="matiere" libelle="Matière" options={matieres} />
        <BoutonSoumettre libelle="Affecter" enCours="…" />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/* ---------------------------------------------------- Retirer un élève ----- */

export function RetirerEleve({ groupe, eleve, nom }: { groupe: string; eleve: string; nom: string }) {
  return (
    <form action={retirerUnEleve}>
      <input type="hidden" name="groupe" value={groupe} />
      <input type="hidden" name="eleve" value={eleve} />
      <button type="submit" className="bouton bouton-discret bouton-compact" aria-label={`Retirer ${nom} du groupe`}>
        <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" /> Retirer
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Choix({ nom, libelle, options }: { nom: string; libelle: string; options: readonly Option[] }) {
  return (
    <div className="min-w-0">
      <label className="etiquette" htmlFor={`groupe-${nom}`}>
        {libelle}
      </label>
      <select id={`groupe-${nom}`} name={nom} className="champ" required defaultValue="">
        <option value="" disabled>
          Choisir…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BoutonSoumettre({ libelle, enCours, desactive = false }: { libelle: string; enCours: string; desactive?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || desactive} className="bouton bouton-primaire">
      {pending ? enCours : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.etat === "vierge" || etat.message === undefined) return null;
  const ok = etat.etat === "ok";
  const Icone = ok ? CircleCheck : CircleAlert;
  return (
    <p
      role="status"
      className={`m-0 mt-3 flex items-center gap-2 rounded-[var(--rayon-m)] px-3.5 py-2.5 text-[0.9375rem] font-semibold ${
        ok ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]" : "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]"
      }`}
    >
      <Icone size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> {etat.message}
    </p>
  );
}

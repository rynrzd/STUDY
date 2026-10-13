"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleAlert, CircleCheck, Layers, Search, UserMinus, Users } from "lucide-react";
import {
  affecterUnProfesseurAuGroupe,
  ajouterDesEleves,
  chercherElevesPourGroupe,
  creerUnGroupe,
  decrireUnGroupe,
  retirerPlusieursEleves,
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

export function AjouterEleves({
  groupe,
  eligibles,
  plus = false,
  classes = [],
}: {
  groupe: string;
  /** Première page de résultats, rendue par le serveur. */
  eligibles: readonly EleveChoisissable[];
  /** La recherche a d'autres résultats que ceux montrés. */
  plus?: boolean;
  /** Les classes de l'établissement, pour filtrer. */
  classes?: readonly string[];
}) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (precedent, donnees) => {
    try {
      return await ajouterDesEleves(precedent, donnees);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_ADMIN_INITIAL);
  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState("");
  const [resultats, setResultats] = useState<{ eleves: readonly EleveChoisissable[]; plus: boolean; enCours: boolean; erreur: boolean }>({ eleves: eligibles, plus, enCours: false, erreur: false });
  // Les élèves cochés restent cochés d'une recherche à l'autre.
  const [choisis, setChoisis] = useState<ReadonlyMap<string, EleveChoisissable>>(new Map());
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);

  function relancer(texte: string, filtreClasse: string) {
    if (minuterie.current) clearTimeout(minuterie.current);
    setResultats((r) => ({ ...r, enCours: true }));
    minuterie.current = setTimeout(async () => {
      const numero = ++derniere.current;
      const r = await chercherElevesPourGroupe(groupe, texte, filtreClasse).catch(() => null);
      if (numero !== derniere.current) return; // une recherche plus récente a pris le relais
      setResultats(r === null ? { eleves: [], plus: false, enCours: false, erreur: true } : { eleves: r.eleves, plus: r.plus, enCours: false, erreur: false });
    }, 250);
  }

  function basculer(e: EleveChoisissable) {
    setChoisis((prec) => {
      const suite = new Map(prec);
      if (suite.has(e.profile_id)) suite.delete(e.profile_id);
      else suite.set(e.profile_id, e);
      return suite;
    });
  }

  return (
    <form action={action} onSubmit={() => setTimeout(() => setChoisis(new Map()), 0)}>
      <input type="hidden" name="groupe" value={groupe} />
      {[...choisis.keys()].map((id) => (
        <input key={id} type="hidden" name="eleve" value={id} />
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <span className="relative min-w-0 flex-1">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-encre-faible)]" />
          <label htmlFor="picker-recherche" className="sr-only">
            Rechercher un élève
          </label>
          <input
            id="picker-recherche"
            type="search"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              relancer(e.target.value, classe);
            }}
            placeholder="Nom, prénom ou identifiant"
            className="champ pl-10"
          />
        </span>
        {classes.length > 0 ? (
          <span className="min-w-0">
            <label htmlFor="picker-classe" className="sr-only">
              Filtrer par classe
            </label>
            <select
              id="picker-classe"
              value={classe}
              onChange={(e) => {
                setClasse(e.target.value);
                relancer(recherche, e.target.value);
              }}
              className="champ"
            >
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

      {choisis.size > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0" aria-label="Élèves choisis">
          {[...choisis.values()].map((e) => (
            <li key={e.profile_id}>
              <button type="button" className="puce-cours" onClick={() => basculer(e)} aria-label={`Retirer ${e.prenom} ${e.nom} de la sélection`}>
                {e.prenom} {e.nom} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="picker-liste mt-3" role="group" aria-label="Élèves à ajouter" aria-busy={resultats.enCours}>
        {resultats.erreur ? (
          <p className="meta m-0 px-1 py-6 text-center">La recherche n&apos;a pas abouti. Réessayez.</p>
        ) : resultats.eleves.length === 0 ? (
          <p className="meta m-0 px-1 py-6 text-center">{resultats.enCours ? "Recherche…" : "Aucun élève ne correspond."}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {resultats.eleves.map((e) => {
              const coche = choisis.has(e.profile_id);
              return (
                <li key={e.profile_id}>
                  <label className="picker-ligne" data-actif={coche ? "" : undefined}>
                    <input type="checkbox" checked={coche} onChange={() => basculer(e)} className="sr-only" />
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
      {resultats.plus ? <p className="meta m-0 mt-2">Seuls les premiers résultats s&apos;affichent : affinez avec un nom ou une classe.</p> : null}

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

/* ------------------------------------------ Membres, retrait multiple ----- */

/**
 * Les élèves du groupe, cochables (GR-05) : retirer un élève ou plusieurs
 * d'un coup. Le retrait multiple passe par une confirmation qui nomme le
 * nombre et la conséquence ; rien n'est effacé, l'appartenance est close.
 */
export function MembresGroupe({ groupe, membres }: { groupe: string; membres: readonly { profile_id: string; prenom: string; nom: string; classe: string | null }[] }) {
  const [coches, setCoches] = useState<string[]>([]);
  const [confirmer, setConfirmer] = useState(false);
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (p, d) => {
    try {
      const r = await retirerPlusieursEleves(p, d);
      setCoches([]);
      setConfirmer(false);
      return r;
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_ADMIN_INITIAL);
  const basculer = (id: string) => setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div>
      <ul className="m-0 mt-3 list-none p-0">
        {membres.map((m) => (
          <li key={m.profile_id} className="flex items-center justify-between gap-3 border-b border-[color:var(--bordure-douce,var(--color-bordure))] py-2.5 last:border-0">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={coches.includes(m.profile_id)} onChange={() => basculer(m.profile_id)} className="size-4 shrink-0 accent-[color:var(--color-accent)]" />
              <span className="min-w-0">
                <span className="font-semibold">{m.nom.toUpperCase()}</span> {m.prenom}
                <span className="meta block">{m.classe ?? "Sans classe"}</span>
              </span>
            </label>
            <RetirerEleve groupe={groupe} eleve={m.profile_id} nom={`${m.prenom} ${m.nom}`} />
          </li>
        ))}
      </ul>
      {coches.length > 0 ? (
        <form action={action} className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--rayon-m)] bg-[color:var(--color-fond)] p-3">
          <input type="hidden" name="groupe" value={groupe} />
          {coches.map((c) => (
            <input key={c} type="hidden" name="eleve" value={c} />
          ))}
          {confirmer ? (
            <>
              <span className="text-[0.875rem]">
                Retirer {coches.length} élève{coches.length > 1 ? "s" : ""} du groupe ? Leurs droits sur ses cours s&apos;arrêtent aujourd&apos;hui ; rien n&apos;est effacé.
              </span>
              <button type="submit" className="bouton bouton-compact bouton-primaire">
                Confirmer le retrait
              </button>
              <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setConfirmer(false)}>
                Annuler
              </button>
            </>
          ) : (
            <>
              <span className="text-[0.875rem] font-semibold">{coches.length} sélectionné{coches.length > 1 ? "s" : ""}</span>
              <button type="button" className="bouton bouton-compact bouton-secondaire" onClick={() => setConfirmer(true)}>
                <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" /> Retirer la sélection
              </button>
              <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setCoches([])}>
                Tout décocher
              </button>
            </>
          )}
        </form>
      ) : null}
      {etat.message ? (
        <p role="status" className={`m-0 mt-2 text-[0.875rem] ${etat.etat === "ok" ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------- Description ------------ */

/** Description facultative d'un groupe (GR-02) : jours, salle, consignes. */
export function DescriptionGroupe({ groupe, description }: { groupe: string; description: string | null }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (p, d) => {
    try {
      return await decrireUnGroupe(p, d);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée." };
    }
  }, ETAT_ADMIN_INITIAL);
  return (
    <form action={action} className="panneau mb-8">
      <input type="hidden" name="groupe" value={groupe} />
      <label className="etiquette" htmlFor={`description-${groupe}`}>
        Description (facultative)
      </label>
      <textarea id={`description-${groupe}`} name="description" defaultValue={description ?? ""} maxLength={500} rows={2} className="champ min-h-[4.5rem] py-2.5" placeholder="Jours, salle, ce qui réunit ces élèves…" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="bouton bouton-compact bouton-secondaire">
          Enregistrer
        </button>
        {etat.message ? (
          <span role="status" className={`text-[0.875rem] ${etat.etat === "ok" ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, CircleAlert, GraduationCap, Presentation, Printer, School, Upload, UserPlus, X } from "lucide-react";
import { creerUnCompte } from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";
import { proposerLogin } from "@/lib/import-rentree";
import { FicheImprimable } from "./FicheImprimable";

type Role = "eleve" | "professeur";
interface Option {
  readonly id: string;
  readonly label: string;
}

const ROLES: readonly { valeur: Role; titre: string; detail: string; Icone: typeof GraduationCap }[] = [
  { valeur: "eleve", titre: "Un élève", detail: "Inscrit dans une classe, il retrouve les séances publiées.", Icone: GraduationCap },
  { valeur: "professeur", titre: "Un professeur", detail: "Il prépare et publie ses cours pour ses classes.", Icone: Presentation },
];

/**
 * « Ajouter une personne » — un compte à la fois, pour l'arrivant de janvier
 * ou le remplaçant nommé un mardi matin. L'import de rentrée reste le chemin
 * d'une classe entière ; celui-ci est le geste unitaire, rendu visible.
 *
 * Même action serveur qu'avant (`creerUnCompte`) : le rôle et l'établissement
 * sont revérifiés côté serveur, l'identifiant y est recalculé contre la base.
 * L'aperçu montré ici n'est qu'une indication.
 *
 * Le mot de passe temporaire n'existe que sur l'écran de confirmation et sur
 * la fiche imprimable : fermer la fenêtre l'efface.
 */
export function AjouterPersonne({
  listeClasses,
  roleInitial = "eleve",
  libelle = "Ajouter une personne",
  variante = "primaire",
  ouvertAuDepart = false,
}: {
  listeClasses: readonly Option[];
  roleInitial?: Role;
  libelle?: string;
  variante?: "primaire" | "secondaire";
  ouvertAuDepart?: boolean;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  // Changer la clé remonte le contenu : formulaire vierge, état d'action remis à zéro.
  const [cle, setCle] = useState(0);
  const idTitre = useId();

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  const fermer = () => setOuvert(false);

  return (
    <>
      <button ref={declencheur} type="button" className={`bouton bouton-${variante}`} onClick={() => setOuvert(true)}>
        <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" /> {libelle}
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
          <Contenu key={cle} idTitre={idTitre} listeClasses={listeClasses} roleInitial={roleInitial} fermer={fermer} recommencer={() => setCle((n) => n + 1)} />
        ) : null}
      </dialog>
    </>
  );
}

function Contenu({
  idTitre,
  listeClasses,
  roleInitial,
  fermer,
  recommencer,
}: {
  idTitre: string;
  listeClasses: readonly Option[];
  roleInitial: Role;
  fermer: () => void;
  recommencer: () => void;
}) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUnCompte, ETAT_ADMIN_INITIAL);
  const [role, setRole] = useState<Role>(roleInitial);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");

  if (etat.etat === "ok" && etat.acces !== undefined) {
    const acces = etat.acces;
    const libelleRole = acces.role === "eleve" ? "Élève" : "Professeur";
    return (
      <div className="ajout-personne">
        <FicheImprimable prenom={acces.prenom} nom={acces.nom} role={libelleRole} classe={acces.classe} login={acces.login} motDePasse={acces.motDePasseTemporaire} />
        <div className="flex items-start justify-between gap-3">
          <span className="ajout-succes" aria-hidden="true">
            <Check size={26} strokeWidth={2.5} />
          </span>
          <BoutonFermer fermer={fermer} />
        </div>
        <h2 id={idTitre} className="titre-section mt-4">
          {acces.prenom} {acces.nom} a son compte
        </h2>
        <p className="m-0 mt-1.5 text-[color:var(--color-encre-faible)]">
          Imprimez la fiche et remettez-la en main propre. Le mot de passe temporaire ne sera plus affiché après fermeture ; il sera changé à la première connexion.
        </p>

        <dl className="ajout-fiche">
          <div>
            <dt>Rôle</dt>
            <dd>{acces.classe === null ? libelleRole : `${libelleRole} · ${acces.classe}`}</dd>
          </div>
          <div>
            <dt>Nom</dt>
            <dd>
              {acces.prenom} {acces.nom}
            </dd>
          </div>
          <div>
            <dt>Identifiant</dt>
            <dd className="font-mono">{acces.login}</dd>
          </div>
          <div>
            <dt>Mot de passe temporaire</dt>
            <dd className="font-mono">{acces.motDePasseTemporaire}</dd>
          </div>
        </dl>

        <div className="ajout-actions">
          <button type="button" className="bouton bouton-secondaire" onClick={recommencer}>
            <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" /> Ajouter une autre personne
          </button>
          <div className="flex flex-wrap gap-2">
            {acces.role === "professeur" ? (
              <Link href="/admin/professeurs" className="bouton bouton-secondaire" onClick={fermer}>
                Affecter à une classe <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            ) : null}
            <button type="button" className="bouton bouton-primaire" onClick={() => window.print()}>
              <Printer size={20} strokeWidth={1.75} aria-hidden="true" /> Imprimer la fiche
            </button>
          </div>
        </div>
      </div>
    );
  }

  const apercu = prenom.trim().length > 0 && nom.trim().length > 0 ? proposerLogin(prenom, nom, new Set()) : null;
  const eleveSansClasse = role === "eleve" && listeClasses.length === 0;

  return (
    <form action={action} className="ajout-personne">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={idTitre} className="titre-section">
            Ajouter une personne
          </h2>
          <p className="m-0 mt-1 text-[color:var(--color-encre-faible)]">Un compte à la fois, prêt en quelques secondes.</p>
        </div>
        <BoutonFermer fermer={fermer} />
      </div>

      <fieldset className="mt-5 border-0 p-0">
        <legend className="etiquette p-0">Qui ajoutez-vous ?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map(({ valeur, titre, detail, Icone }) => (
            <label key={valeur} className="choix-role" data-actif={role === valeur ? "" : undefined}>
              <input type="radio" name="role" value={valeur} checked={role === valeur} onChange={() => setRole(valeur)} className="sr-only" />
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="ajout-prenom">
            Prénom
          </label>
          <input id="ajout-prenom" name="prenom" type="text" className="champ" required minLength={2} maxLength={60} autoComplete="off" autoFocus value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </div>
        <div>
          <label className="etiquette" htmlFor="ajout-nom">
            Nom
          </label>
          <input id="ajout-nom" name="nom" type="text" className="champ" required minLength={2} maxLength={60} autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
      </div>
      <p className="ajout-identifiant" aria-live="polite">
        Identifiant de connexion : <span className="font-mono font-semibold text-[color:var(--color-encre)]">{apercu ?? "prenom.nom"}</span>
        <span className="block">Calculé à partir du nom ; un chiffre est ajouté s&apos;il est déjà pris.</span>
      </p>

      {role === "eleve" ? (
        eleveSansClasse ? (
          <div className="encadre mt-5">
            <School size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
            <div className="min-w-0 text-[0.9375rem]">
              <p className="m-0 font-bold">Créez d&apos;abord une classe</p>
              <p className="m-0 mt-1 text-[color:var(--color-encre-faible)]">
                Un élève est toujours inscrit dans une classe.{" "}
                <Link href="/admin/classes" className="font-semibold text-[color:var(--color-accent)]" onClick={fermer}>
                  Créer une classe
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <label className="etiquette" htmlFor="ajout-classe">
              Classe
            </label>
            <select id="ajout-classe" name="classe" className="champ" required defaultValue="">
              <option value="" disabled>
                Choisir la classe…
              </option>
              {listeClasses.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.label}
                </option>
              ))}
            </select>
          </div>
        )
      ) : (
        <div className="mt-5">
          <label className="etiquette" htmlFor="ajout-email">
            Adresse professionnelle <span className="font-normal text-[color:var(--color-encre-faible)]">(facultatif)</span>
          </label>
          <input id="ajout-email" name="email" type="email" className="champ" maxLength={120} autoComplete="off" placeholder="prenom.nom@ac-academie.fr" />
          <p className="aide-champ">Ensuite, affectez-le à une classe et une matière : c&apos;est ce qui lui ouvre ce cours.</p>
        </div>
      )}

      {etat.etat === "erreur" && etat.message !== undefined ? (
        <p role="alert" className="ajout-erreur">
          <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> {etat.message}
        </p>
      ) : null}

      <div className="ajout-actions">
        <Link href="/admin/import" className="inline-flex min-h-[44px] items-center gap-1.5 text-[0.875rem] font-semibold text-[color:var(--color-accent)]" onClick={fermer}>
          <Upload size={16} strokeWidth={1.75} aria-hidden="true" /> Toute une classe ? Import de rentrée
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="bouton bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <Envoyer desactive={eleveSansClasse} libelle={role === "eleve" ? "Créer le compte élève" : "Créer le compte professeur"} />
        </div>
      </div>
    </form>
  );
}

function Envoyer({ libelle, desactive }: { libelle: string; desactive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || desactive} className="bouton bouton-primaire">
      {pending ? "Création…" : libelle}
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

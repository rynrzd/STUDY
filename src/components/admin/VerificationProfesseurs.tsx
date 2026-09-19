"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { creerLesProfesseurs, reparerLigneProfesseur } from "@/app/admin/import/actions";
import {
  ETAT_CORRECTION_INITIAL,
  ETAT_CREATION_PROFS_INITIAL,
  type EtatCorrection,
  type EtatCreationProfesseurs,
} from "@/app/admin/import/etats";
import type { Affectation } from "@/lib/assistant-rentree";
import type { LigneProfesseurDuLot, LotProfesseurs } from "@/lib/lot-professeurs";
import { FicheImprimable } from "./FicheImprimable";

/**
 * Vérification d'un lot de professeurs — cahier V5, §6.
 *
 * L'écran montre ce que le §6 demande de rendre visible : le triplet
 * professeur–matière–classe. Pas « professeur de maths », qui ne dit rien de
 * ce qui sera ouvert, mais la liste exacte des cours qui existeront.
 */
export function VerificationProfesseurs({
  lot,
  codeEtablissement,
}: {
  lot: LotProfesseurs;
  codeEtablissement: string;
}) {
  const [creation, creer] = useActionState<EtatCreationProfesseurs, FormData>(
    creerLesProfesseurs,
    ETAT_CREATION_PROFS_INITIAL,
  );

  if (creation.etat === "termine") {
    return <Rapport creation={creation} codeEtablissement={codeEtablissement} />;
  }

  if (lot.etat === "applique") {
    return <DejaApplique lot={lot} />;
  }

  const aCorriger = lot.lignes.filter((ligne) => !ligne.valide);

  return (
    <div className="space-y-8">
      <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Chiffre terme="Fichiers lus" valeur={lot.compte.fichiersLus} />
        <Chiffre terme="Professeurs" valeur={lot.compte.professeurs} accent />
        <Chiffre terme="Affectations" valeur={lot.compte.affectations} />
        <Chiffre
          terme="À corriger"
          valeur={lot.compte.bloquantes}
          alerte={lot.compte.bloquantes > 0}
        />
      </dl>

      {lot.fichiers.some((fichier) => fichier.erreur !== null) ? (
        <div className="space-y-3">
          {lot.fichiers
            .filter((fichier) => fichier.erreur !== null)
            .map((fichier) => (
              <div
                key={fichier.jobId}
                className="carte border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-5"
              >
                <p className="m-0 font-semibold">{fichier.nom}</p>
                <p className="m-0 mt-1 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]">
                  {fichier.erreur}
                </p>
              </div>
            ))}
        </div>
      ) : null}

      {lot.personnes.length > 0 ? (
        <section aria-labelledby="titre-personnes">
          <h2
            id="titre-personnes"
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
          >
            Ce qui sera créé
          </h2>
          <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Un compte par personne, même si elle apparaît sur plusieurs lignes.
            Chaque affectation ouvre un cours, et un seul : enseigner les
            mathématiques en 2DE1 n&apos;ouvre pas les autres classes de
            mathématiques.
          </p>

          <div className="mt-4 space-y-3">
            {lot.personnes.map((personne) => (
              <div key={personne.cle} className="carte p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="m-0 font-semibold">
                    {personne.prenom} {personne.nom}
                  </p>
                  <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {personne.affectations.length} affectation
                    {personne.affectations.length > 1 ? "s" : ""}
                  </p>
                </div>
                {personne.email !== null ? (
                  <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {personne.email}
                  </p>
                ) : null}
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                  {personne.affectations.map((affectation) => (
                    <li
                      key={`${affectation.matiere}-${affectation.classe}`}
                      className="rounded-full border border-[color:var(--color-bordure)] px-3 py-1 text-[length:var(--text-aide)]"
                    >
                      {affectation.matiere}{" "}
                      <span className="text-[color:var(--color-encre-faible)]">·</span>{" "}
                      <span className="font-semibold">{affectation.classe}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {aCorriger.length > 0 ? (
        <section aria-labelledby="titre-corrections-profs">
          <h2
            id="titre-corrections-profs"
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-erreur)]"
          >
            {aCorriger.length} ligne{aCorriger.length > 1 ? "s" : ""} à corriger
          </h2>
          <div className="mt-4 space-y-3">
            {aCorriger.slice(0, 50).map((ligne) => (
              <LigneCorrigeable key={ligne.id} ligne={ligne} lot={lot.id} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="carte p-5 sm:p-6">
        {lot.blocages.length > 0 ? (
          <div role="alert">
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Création impossible pour l&apos;instant
            </h2>
            <ul className="m-0 mt-3 list-disc space-y-1 pl-5 text-[length:var(--text-tableau)]">
              {lot.blocages.map((blocage) => (
                <li key={blocage}>{blocage}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Créer les comptes professeurs
            </h2>
            <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-tableau)]">
              {lot.compte.professeurs} compte{lot.compte.professeurs > 1 ? "s" : ""} et{" "}
              {lot.compte.affectations} affectation{lot.compte.affectations > 1 ? "s" : ""}. Les
              professeurs déjà présents garderont leur compte et recevront seulement les
              affectations qui leur manquent.
            </p>
          </>
        )}

        {creation.etat === "erreur" ? (
          <p
            role="alert"
            className="m-0 mt-4 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
          >
            {creation.message}
          </p>
        ) : null}

        <form action={creer} className="mt-5">
          <input type="hidden" name="lot" value={lot.id} />
          <BoutonCreer
            bloque={lot.blocages.length > 0}
            nombre={lot.compte.professeurs}
          />
        </form>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Rend les affectations d'une ligne sous la forme éditée à l'écran. */
function enTexte(affectations: readonly Affectation[]): string {
  const par = new Map<string, string[]>();
  for (const affectation of affectations) {
    par.set(affectation.matiere, [...(par.get(affectation.matiere) ?? []), affectation.classe]);
  }
  return [...par.entries()]
    .map(([matiere, classes]) => `${matiere} : ${classes.join(", ")}`)
    .join("\n");
}

function LigneCorrigeable({ ligne, lot }: { ligne: LigneProfesseurDuLot; lot: string }) {
  const [etat, reparer] = useActionState<EtatCorrection, FormData>(
    reparerLigneProfesseur,
    ETAT_CORRECTION_INITIAL,
  );

  return (
    <form
      action={reparer}
      className="rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4"
    >
      <input type="hidden" name="ligne" value={ligne.id} />
      <input type="hidden" name="lot" value={lot} />

      <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {ligne.fichier} · ligne {ligne.numero}
      </p>
      <p className="m-0 mt-1 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]">
        {ligne.probleme ?? "Ligne incomplète."}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor={`prenom-p-${ligne.id}`}>
            Prénom
          </label>
          <input
            id={`prenom-p-${ligne.id}`}
            name="prenom"
            type="text"
            defaultValue={ligne.prenom}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor={`nom-p-${ligne.id}`}>
            Nom
          </label>
          <input
            id={`nom-p-${ligne.id}`}
            name="nom"
            type="text"
            defaultValue={ligne.nom}
            className="champ"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor={`aff-${ligne.id}`}>
          Affectations
        </label>
        <textarea
          id={`aff-${ligne.id}`}
          name="affectations"
          rows={3}
          defaultValue={enTexte(ligne.affectations)}
          placeholder={"Mathématiques : 2DE1, 2DE2\nPhysique : 1ERE S1"}
          className="champ font-mono"
        />
        <span className="aide-champ">
          Une matière par ligne, puis ses classes séparées par des virgules.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <BoutonDiscret libelle="Corriger" />
        {etat.etat !== "vierge" ? (
          <span
            role="status"
            className={`text-[length:var(--text-aide)] ${
              etat.etat === "erreur"
                ? "text-[color:var(--color-erreur)]"
                : "text-[color:var(--color-succes)]"
            }`}
          >
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Rapport({
  creation,
  codeEtablissement,
}: {
  creation: EtatCreationProfesseurs;
  codeEtablissement: string;
}) {
  const acces = creation.acces ?? [];

  return (
    <div className="space-y-6">
      <div className="carte border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-5 sm:p-6 print:hidden">
        <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-succes)]">
          Import terminé
        </h2>
        <dl className="m-0 mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Chiffre terme="Comptes créés" valeur={creation.cree ?? 0} accent />
          <Chiffre terme="Déjà présents" valeur={creation.existant ?? 0} />
          <Chiffre terme="Affectations posées" valeur={creation.affectations ?? 0} />
          <Chiffre
            terme="En erreur"
            valeur={creation.erreurs ?? 0}
            alerte={(creation.erreurs ?? 0) > 0}
          />
        </dl>

        {creation.echecs !== undefined && creation.echecs.length > 0 ? (
          <ul className="m-0 mt-5 list-disc space-y-1 pl-5 text-[length:var(--text-aide)]">
            {creation.echecs.slice(0, 30).map((echec) => (
              <li key={echec.raison}>{echec.raison}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {acces.length > 0 ? (
        <>
          {acces.map((professeur) => (
            <FicheImprimable
              key={`impression-${professeur.login}`}
              prenom={professeur.prenom}
              nom={professeur.nom}
              role="Professeur"
              classe={null}
              login={professeur.login}
              motDePasse={professeur.motDePasseTemporaire}
            />
          ))}

          <div className="carte p-5 sm:p-6 print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                  Fiches d&apos;accès à remettre
                </h2>
                <p className="m-0 mt-2 max-w-[60ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                  Une feuille par professeur. Ces mots de passe sont
                  temporaires et ne seront plus jamais affichés.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="bouton bouton-secondaire w-full sm:w-auto"
              >
                Imprimer les {acces.length} fiches
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {acces.map((professeur) => (
                <div
                  key={professeur.login}
                  className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4"
                >
                  <p className="m-0 font-semibold">
                    {professeur.prenom} {professeur.nom}
                  </p>
                  <dl className="m-0 mt-3 space-y-1 font-mono text-[length:var(--text-aide)]">
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">Code</dt>
                      <dd className="m-0 font-semibold">{codeEtablissement}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">
                        Identifiant
                      </dt>
                      <dd className="m-0 font-semibold">{professeur.login}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">
                        Mot de passe
                      </dt>
                      <dd className="m-0 font-semibold">{professeur.motDePasseTemporaire}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DejaApplique({ lot }: { lot: LotProfesseurs }) {
  return (
    <div className="carte p-5 sm:p-6">
      <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
        Ce lot a déjà été appliqué
      </h2>
      <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        Les mots de passe temporaires ne sont affichés qu&apos;une fois. Pour un
        professeur qui a perdu le sien, utilisez « Réinitialiser l&apos;accès »
        depuis la liste des utilisateurs.
      </p>
      {lot.rapport !== null ? (
        <dl className="m-0 mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Chiffre terme="Comptes créés" valeur={lot.rapport.cree ?? 0} accent />
          <Chiffre terme="Déjà présents" valeur={lot.rapport.existant ?? 0} />
          <Chiffre terme="Affectations posées" valeur={lot.rapport.affectations ?? 0} />
          <Chiffre
            terme="En erreur"
            valeur={lot.rapport.erreur ?? 0}
            alerte={(lot.rapport.erreur ?? 0) > 0}
          />
        </dl>
      ) : null}
    </div>
  );
}

function Chiffre({
  terme,
  valeur,
  accent = false,
  alerte = false,
}: {
  terme: string;
  valeur: number;
  accent?: boolean;
  alerte?: boolean;
}) {
  return (
    <div>
      <dt className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {terme}
      </dt>
      <dd
        className={`m-0 text-[1.5rem] font-bold leading-tight ${
          alerte && valeur > 0
            ? "text-[color:var(--color-erreur)]"
            : accent
              ? "text-[color:var(--color-accent)]"
              : ""
        }`}
      >
        {valeur}
      </dd>
    </div>
  );
}

function BoutonDiscret({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-secondaire">
      {pending ? "…" : libelle}
    </button>
  );
}

function BoutonCreer({ bloque, nombre }: { bloque: boolean; nombre: number }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={bloque || pending || nombre === 0}
        className="bouton bouton-primaire w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Création en cours…" : `Créer les ${nombre} comptes`}
      </button>
      {pending ? (
        <p
          role="status"
          className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
        >
          Ne fermez pas cette page : les mots de passe temporaires
          s&apos;afficheront à la fin, une seule fois.
        </p>
      ) : null}
    </>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { creerLesComptes, fixerClasse, reparerLigne } from "@/app/admin/import/actions";
import {
  ETAT_CORRECTION_INITIAL,
  ETAT_CREATION_INITIAL,
  type EtatCorrection,
  type EtatCreation,
} from "@/app/admin/import/etats";
import type { FichierDuLot, LigneDuLot, LotComplet } from "@/lib/lot-rentree";
import { FicheImprimable } from "./FicheImprimable";

/**
 * Vérification d'un lot de rentrée — cahier V5, §5.2 à §5.7.
 *
 * L'écran répond à une question et une seule : est-ce que ce que la machine a
 * compris correspond à ce que vous avez déposé ? Tant que la réponse peut être
 * « non », le bouton qui crée les comptes reste fermé.
 */
export function VerificationRentree({
  lot,
  codeEtablissement,
}: {
  lot: LotComplet;
  codeEtablissement: string;
}) {
  const [creation, creer] = useActionState<EtatCreation, FormData>(
    creerLesComptes,
    ETAT_CREATION_INITIAL,
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
      <Compteurs lot={lot} />

      <section aria-labelledby="titre-fichiers">
        <h2 id="titre-fichiers" className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
          Ce qui a été lu
        </h2>
        <div className="mt-4 space-y-4">
          {lot.fichiers.map((fichier) => (
            <CarteFichier key={fichier.jobId} fichier={fichier} lot={lot.id} />
          ))}
        </div>
      </section>

      {lot.classes.length > 0 ? (
        <section aria-labelledby="titre-classes" className="carte p-5 sm:p-6">
          <h2 id="titre-classes" className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
            Classes qui seront créées ou complétées
          </h2>
          <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            « 2nde 4 », « 2DE4 » et « Seconde 4 » sont rapprochés : c&apos;est
            une seule classe. Une classe qui existe déjà n&apos;est pas
            recréée, ses élèves y sont ajoutés.
          </p>
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
            {lot.classes.map((classe) => (
              <li
                key={classe.nom}
                className="rounded-full border border-[color:var(--color-bordure)] px-3 py-1.5 text-[length:var(--text-aide)]"
              >
                <span className="font-semibold">{classe.nom}</span>{" "}
                <span className="text-[color:var(--color-encre-faible)]">
                  · {classe.effectif} élève{classe.effectif > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {aCorriger.length > 0 ? (
        <section aria-labelledby="titre-corrections">
          <h2
            id="titre-corrections"
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-erreur)]"
          >
            {aCorriger.length} ligne{aCorriger.length > 1 ? "s" : ""} à corriger
          </h2>
          <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Corrigez-les ici, sans retoucher vos fichiers. Chaque correction est
            enregistrée aussitôt et le compte se met à jour.
          </p>
          <div className="mt-4 space-y-3">
            {aCorriger.slice(0, 50).map((ligne) => (
              <LigneCorrigeable key={ligne.id} ligne={ligne} lot={lot.id} />
            ))}
          </div>
          {aCorriger.length > 50 ? (
            <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              Les 50 premières sont affichées. Corrigez-les, les suivantes
              apparaîtront.
            </p>
          ) : null}
        </section>
      ) : null}

      <ListeComplete lignes={lot.lignes} />

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
              Créer les comptes
            </h2>
            <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-tableau)]">
              {lot.compte.valides} compte{lot.compte.valides > 1 ? "s" : ""} élève
              {lot.compte.valides > 1 ? "s" : ""} dans {lot.classes.length} classe
              {lot.classes.length > 1 ? "s" : ""}. Les élèves déjà présents ne
              seront pas recréés. Aucun élève absent de vos fichiers ne sera
              supprimé.
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
          <BoutonCreer bloque={lot.blocages.length > 0} nombre={lot.compte.valides} />
        </form>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Compteurs({ lot }: { lot: LotComplet }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Chiffre terme="Fichiers lus" valeur={lot.compte.fichiersLus} />
      <Chiffre
        terme="Fichiers rejetés"
        valeur={lot.compte.fichiersRejetes}
        alerte={lot.compte.fichiersRejetes > 0}
      />
      <Chiffre terme="Élèves à créer" valeur={lot.compte.valides} accent />
      <Chiffre terme="À corriger" valeur={lot.compte.bloquantes} alerte={lot.compte.bloquantes > 0} />
    </dl>
  );
}

const SOURCE: Record<string, string> = {
  fichier: "d'après le nom du fichier",
  colonne: "d'après une colonne du fichier",
  saisie: "saisie par vous",
};

function CarteFichier({ fichier, lot }: { fichier: FichierDuLot; lot: string }) {
  const [etat, fixer] = useActionState<EtatCorrection, FormData>(
    fixerClasse,
    ETAT_CORRECTION_INITIAL,
  );

  if (fichier.erreur !== null) {
    return (
      <div className="carte border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-5">
        <p className="m-0 font-semibold">{fichier.nom}</p>
        <p className="m-0 mt-1 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]">
          {fichier.erreur}
        </p>
        <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Les autres fichiers du dépôt ont été traités normalement.
        </p>
      </div>
    );
  }

  // Un fichier qui contient plusieurs classes n'a pas de classe unique à
  // corriger : chaque ligne porte la sienne, lue dans une colonne.
  const parColonne = fichier.classeSource === "colonne";

  return (
    <div className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 font-semibold">{fichier.nom}</p>
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          {fichier.lignes} ligne{fichier.lignes > 1 ? "s" : ""}
        </p>
      </div>

      <p className="m-0 mt-2 text-[length:var(--text-tableau)]">
        {fichier.classeDetectee === null ? (
          <span className="text-[color:var(--color-erreur)]">
            Classe non détectée — indiquez-la ci-dessous.
          </span>
        ) : (
          <>
            Classe : <strong>{fichier.classeDetectee}</strong>{" "}
            <span className="text-[color:var(--color-encre-faible)]">
              ({SOURCE[fichier.classeSource ?? ""] ?? "détectée"})
            </span>
          </>
        )}
      </p>

      {fichier.colonnes.length > 0 ? (
        <ul className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
          {fichier.colonnes.map((colonne) => (
            <li
              key={colonne.index}
              className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-3"
            >
              <p className="m-0 flex items-center gap-2 text-[length:var(--text-aide)]">
                <span className="truncate font-semibold">{colonne.entete || "(sans titre)"}</span>
                <Pastille confiance={colonne.confiance} />
              </p>
              <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                {colonne.champ === null ? "non utilisée" : `utilisée comme ${colonne.champ}`}
                {colonne.exemple === "" ? "" : ` · ex. ${colonne.exemple}`}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {parColonne ? (
        <p className="m-0 mt-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Ce fichier contient plusieurs classes : chaque élève garde celle de sa
          ligne. Corrigez au besoin les lignes concernées plus bas.
        </p>
      ) : (
        <form action={fixer} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="job" value={fichier.jobId} />
          <input type="hidden" name="lot" value={lot} />
          <div className="min-w-0 flex-1">
            <label className="etiquette" htmlFor={`classe-${fichier.jobId}`}>
              {fichier.classeDetectee === null ? "Classe de ce fichier" : "Corriger la classe"}
            </label>
            <input
              id={`classe-${fichier.jobId}`}
              name="classe"
              type="text"
              defaultValue={fichier.classeDetectee ?? ""}
              placeholder="2nde 4"
              className="champ"
            />
          </div>
          <BoutonDiscret libelle="Appliquer" />
        </form>
      )}

      {etat.etat !== "vierge" ? (
        <p
          role="status"
          className={`m-0 mt-2 text-[length:var(--text-aide)] ${
            etat.etat === "erreur" ? "text-[color:var(--color-erreur)]" : "text-[color:var(--color-succes)]"
          }`}
        >
          {etat.message}
        </p>
      ) : null}
    </div>
  );
}

function Pastille({ confiance }: { confiance: string }) {
  if (confiance === "sur") {
    return (
      <span className="shrink-0 rounded-full bg-[color:var(--color-succes-fond)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-succes)]">
        sûr
      </span>
    );
  }
  if (confiance === "a_confirmer") {
    return (
      <span className="shrink-0 rounded-full bg-[color:var(--color-surface-douce)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-encre-faible)]">
        à confirmer
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-[color:var(--color-bordure)] px-2 py-0.5 text-[0.7rem] text-[color:var(--color-encre-faible)]">
      non reconnue
    </span>
  );
}

function LigneCorrigeable({ ligne, lot }: { ligne: LigneDuLot; lot: string }) {
  const [etat, reparer] = useActionState<EtatCorrection, FormData>(
    reparerLigne,
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

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiquette" htmlFor={`prenom-${ligne.id}`}>
            Prénom
          </label>
          <input
            id={`prenom-${ligne.id}`}
            name="prenom"
            type="text"
            defaultValue={ligne.prenom}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor={`nom-${ligne.id}`}>
            Nom
          </label>
          <input
            id={`nom-${ligne.id}`}
            name="nom"
            type="text"
            defaultValue={ligne.nom}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor={`classe-ligne-${ligne.id}`}>
            Classe
          </label>
          <input
            id={`classe-ligne-${ligne.id}`}
            name="classe"
            type="text"
            defaultValue={ligne.classe}
            className="champ"
          />
        </div>
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

function ListeComplete({ lignes }: { lignes: readonly LigneDuLot[] }) {
  if (lignes.length === 0) return null;

  return (
    <details className="carte p-5">
      <summary className="cursor-pointer text-[length:var(--text-tableau)] font-semibold">
        Voir les {lignes.length} lignes lues
      </summary>
      <div className="mt-4 max-h-[26rem] overflow-auto rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)]">
        <table className="w-full min-w-[34rem] border-collapse text-[length:var(--text-tableau)]">
          <caption className="sr-only">Toutes les lignes lues dans les fichiers déposés</caption>
          <thead className="sticky top-0 bg-[color:var(--color-surface-douce)]">
            <tr className="text-left">
              <th scope="col" className="p-2.5 font-semibold">Élève</th>
              <th scope="col" className="p-2.5 font-semibold">Classe</th>
              <th scope="col" className="p-2.5 font-semibold">Fichier</th>
              <th scope="col" className="p-2.5 font-semibold">État</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.id} className="border-t border-[color:var(--color-bordure)]">
                <td className="p-2.5">
                  {ligne.prenom} {ligne.nom}
                </td>
                <td className="p-2.5 text-[color:var(--color-encre-faible)]">{ligne.classe}</td>
                <td className="max-w-[12rem] truncate p-2.5 text-[color:var(--color-encre-faible)]">
                  {ligne.fichier}
                </td>
                <td className="p-2.5">
                  {ligne.valide ? (
                    <span className="text-[color:var(--color-encre-faible)]">prêt</span>
                  ) : (
                    <span className="text-[color:var(--color-erreur)]">
                      {ligne.probleme ?? "à corriger"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* -------------------------------------------------------------------------- */

function Rapport({
  creation,
  codeEtablissement,
}: {
  creation: EtatCreation;
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
          <Chiffre terme="Changements de classe" valeur={creation.reinscrit ?? 0} />
          <Chiffre terme="En erreur" valeur={creation.erreurs ?? 0} alerte={(creation.erreurs ?? 0) > 0} />
        </dl>

        {creation.echecs !== undefined && creation.echecs.length > 0 ? (
          <div className="mt-5">
            <p className="m-0 font-semibold">Lignes non créées</p>
            <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-[length:var(--text-aide)]">
              {creation.echecs.slice(0, 30).map((echec) => (
                <li key={`${echec.ligne}-${echec.raison}`}>
                  Ligne {echec.ligne} — {echec.raison}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              Corrigez-les et relancez un import : les élèves déjà créés ne
              seront pas dupliqués.
            </p>
          </div>
        ) : null}
      </div>

      {acces.length > 0 ? (
        <>
          {acces.map((eleve) => (
            <FicheImprimable
              key={`impression-${eleve.login}`}
              prenom={eleve.prenom}
              nom={eleve.nom}
              role="Élève"
              classe={eleve.classe}
              login={eleve.login}
              motDePasse={eleve.motDePasseTemporaire}
            />
          ))}

          <div className="carte p-5 sm:p-6 print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                  Fiches d&apos;accès à distribuer
                </h2>
                <p className="m-0 mt-2 max-w-[60ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                  Imprimez-les maintenant : une feuille par élève. Ces mots de
                  passe sont temporaires, ils ne seront plus jamais affichés, et
                  personne ne pourra les retrouver — pas même nous.
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
              {acces.map((eleve) => (
                <div
                  key={eleve.login}
                  className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4"
                >
                  <p className="m-0 font-semibold">
                    {eleve.prenom} {eleve.nom}
                  </p>
                  <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {eleve.classe}
                  </p>
                  <dl className="m-0 mt-3 space-y-1 font-mono text-[length:var(--text-aide)]">
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">Code</dt>
                      <dd className="m-0 font-semibold">{codeEtablissement}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">Identifiant</dt>
                      <dd className="m-0 font-semibold">{eleve.login}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-sans text-[color:var(--color-encre-faible)]">Mot de passe</dt>
                      <dd className="m-0 font-semibold">{eleve.motDePasseTemporaire}</dd>
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

function DejaApplique({ lot }: { lot: LotComplet }) {
  return (
    <div className="carte p-5 sm:p-6">
      <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
        Ce lot a déjà été appliqué
      </h2>
      <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        Les mots de passe temporaires ne sont affichés qu&apos;une fois, au
        moment de la création. Pour un élève qui a perdu le sien, utilisez
        « Réinitialiser l&apos;accès » depuis la liste des utilisateurs.
      </p>
      {lot.rapport !== null ? (
        <dl className="m-0 mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Chiffre terme="Comptes créés" valeur={lot.rapport.cree ?? 0} accent />
          <Chiffre terme="Déjà présents" valeur={lot.rapport.existant ?? 0} />
          <Chiffre terme="Changements de classe" valeur={lot.rapport.reinscrit ?? 0} />
          <Chiffre terme="En erreur" valeur={lot.rapport.erreur ?? 0} alerte={(lot.rapport.erreur ?? 0) > 0} />
        </dl>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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

/**
 * Le bouton qui crée réellement les comptes.
 *
 * Deux verrous, et ils ne font pas le même travail. `bloque` vient de
 * l'analyse : il empêche de créer sur des données que personne n'a corrigées.
 * `pending` empêche le double envoi le temps que le serveur travaille — mais
 * le vrai garde-fou du double clic est en base, où un lot appliqué refuse de
 * l'être une seconde fois.
 */
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
        <p role="status" className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Ne fermez pas cette page : les mots de passe temporaires s&apos;afficheront
          à la fin, une seule fois.
        </p>
      ) : null}
    </>
  );
}

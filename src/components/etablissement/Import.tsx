"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { analyserFichier, confirmerImport } from "@/app/etablissement/actions";
import { ETAT_IMPORT_INITIAL, type EtatImport } from "@/app/etablissement/etats";

/**
 * Import de rentrée : déposer, vérifier, corriger, confirmer.
 *
 * Le fichier reste dans le navigateur entre les deux étapes ; il est renvoyé
 * tel quel à la confirmation. Rien n'est stocké côté serveur entre les deux,
 * et l'empreinte de l'aperçu garantit qu'on confirme bien ce qu'on a lu.
 */
export function Import({ codeEtablissement }: { codeEtablissement: string }) {
  const [etatApercu, analyser] = useActionState<EtatImport, FormData>(
    analyserFichier,
    ETAT_IMPORT_INITIAL,
  );
  const [etatFinal, confirmer] = useActionState<EtatImport, FormData>(
    confirmerImport,
    ETAT_IMPORT_INITIAL,
  );

  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const etat = etatFinal.etape === "depot" ? etatApercu : etatFinal;

  if (etatFinal.etape === "termine") {
    return <Resultat etat={etatFinal} codeEtablissement={codeEtablissement} />;
  }

  return (
    <div className="space-y-8">
      <form action={analyser} className="carte p-6">
        <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
          1. Déposer le fichier
        </h2>
        <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          Un fichier .xlsx ou .csv, avec une ligne par élève. La première ligne
          nomme les colonnes : <strong>Nom</strong>, <strong>Prénom</strong>,{" "}
          <strong>Classe</strong>, et si vous l&apos;avez, l&apos;identifiant
          national.
        </p>

        <div className="mt-5">
          <label className="etiquette" htmlFor="fichier">
            Fichier
          </label>
          <input
            ref={champFichier}
            id="fichier"
            name="fichier"
            type="file"
            accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(evenement) => setNomFichier(evenement.target.files?.[0]?.name ?? null)}
            className="champ py-2.5 file:mr-4 file:rounded-[6px] file:border-0 file:bg-[color:var(--color-surface-douce)] file:px-3 file:py-1.5 file:text-[length:var(--text-tableau)] file:font-medium"
          />
          <span className="aide-champ">
            Rien n&apos;est enregistré tant que vous n&apos;avez pas confirmé
            l&apos;aperçu.
          </span>
        </div>

        <BoutonEtape libelle="Analyser le fichier" variante="secondaire" />
      </form>

      {etat.etape === "erreur" ? (
        <div
          role="alert"
          className="rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-5"
        >
          <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{etat.message}</p>
          {etat.lignes && etat.lignes.length > 0 ? (
            <ul className="m-0 mt-3 list-none space-y-1 p-0 text-[length:var(--text-aide)]">
              {etat.lignes.slice(0, 10).map((ligne) => (
                <li key={ligne.numero}>
                  Ligne {ligne.numero} — {ligne.probleme}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {etatApercu.etape === "apercu" && etatApercu.resume ? (
        <form action={confirmer} className="carte p-6">
          <input type="hidden" name="empreinte" value={etatApercu.empreinte ?? ""} />

          <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
            2. Vérifier l&apos;aperçu
          </h2>

          <dl className="m-0 mt-4 grid gap-4 sm:grid-cols-4">
            <Chiffre terme="Lignes lues" valeur={etatApercu.resume.lues} />
            <Chiffre terme="Élèves à créer" valeur={etatApercu.resume.valides} accent />
            <Chiffre terme="Classes" valeur={etatApercu.resume.classes} />
            <Chiffre
              terme="Lignes rejetées"
              valeur={etatApercu.resume.rejetees}
              alerte={etatApercu.resume.rejetees > 0}
            />
          </dl>

          {etatApercu.classes && etatApercu.classes.length > 0 ? (
            <div className="mt-6">
              <h3 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
                Classes du fichier
              </h3>
              <p className="m-0 mt-2 text-[length:var(--text-tableau)]">
                {etatApercu.classes.join(" · ")}
              </p>
              <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
                Deux libellés différents donnent deux classes différentes. Si
                « 2nde 1 » et « Seconde 1 » désignent la même classe, corrigez le
                fichier : rien n&apos;est fusionné automatiquement.
              </p>
            </div>
          ) : null}

          {etatApercu.lignes && etatApercu.lignes.length > 0 ? (
            <div className="mt-6 max-h-[24rem] overflow-auto rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)]">
              <table className="w-full min-w-[40rem] border-collapse text-[length:var(--text-tableau)]">
                <caption className="sr-only">Aperçu des lignes du fichier</caption>
                <thead className="sticky top-0 bg-[color:var(--color-surface-douce)]">
                  <tr className="text-left">
                    <th scope="col" className="p-2.5 font-semibold">Ligne</th>
                    <th scope="col" className="p-2.5 font-semibold">Élève</th>
                    <th scope="col" className="p-2.5 font-semibold">Classe</th>
                    <th scope="col" className="p-2.5 font-semibold">Identifiant proposé</th>
                  </tr>
                </thead>
                <tbody>
                  {etatApercu.lignes.map((ligne) => (
                    <tr
                      key={ligne.numero}
                      className={`border-t border-[color:var(--color-bordure)] ${
                        ligne.probleme === null ? "" : "bg-[color:var(--color-erreur-fond)]"
                      }`}
                    >
                      <td className="p-2.5 text-[color:var(--color-encre-faible)]">{ligne.numero}</td>
                      <td className="p-2.5">
                        {ligne.probleme === null
                          ? `${ligne.prenom} ${ligne.nom}`
                          : ligne.probleme}
                      </td>
                      <td className="p-2.5 text-[color:var(--color-encre-faible)]">{ligne.classe}</td>
                      <td className="p-2.5 font-mono">{ligne.login}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-6 border-t border-[color:var(--color-bordure)] pt-5">
            <p className="m-0 text-[length:var(--text-tableau)]">
              Confirmer crée {etatApercu.resume.valides} compte
              {etatApercu.resume.valides > 1 ? "s" : ""} élève et les classes
              manquantes. Les lignes rejetées sont ignorées : corrigez-les et
              relancez un import, rien ne sera dupliqué.
            </p>

            <div className="mt-4">
              <label className="etiquette" htmlFor="fichier-confirmation">
                Redéposez le même fichier pour confirmer
              </label>
              <input
                id="fichier-confirmation"
                name="fichier"
                type="file"
                accept=".csv,.xlsx,.txt"
                required
                className="champ py-2.5 file:mr-4 file:rounded-[6px] file:border-0 file:bg-[color:var(--color-surface-douce)] file:px-3 file:py-1.5 file:text-[length:var(--text-tableau)] file:font-medium"
              />
              <span className="aide-champ">
                {nomFichier === null
                  ? "Le fichier n'est pas conservé sur le serveur entre l'aperçu et la confirmation."
                  : `Le même que tout à l'heure : ${nomFichier}. Il n'est pas conservé sur le serveur entre les deux étapes.`}
              </span>
            </div>

            <BoutonEtape libelle="Confirmer et créer les comptes" variante="primaire" />
          </div>
        </form>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Resultat({
  etat,
  codeEtablissement,
}: {
  etat: EtatImport;
  codeEtablissement: string;
}) {
  return (
    <div className="space-y-6">
      <div className="carte border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-6">
        <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-succes)]">
          Import terminé
        </h2>
        <p className="m-0 mt-2">
          {etat.resume?.valides ?? 0} élève(s) créés dans {etat.resume?.classes ?? 0} classe(s).
          {etat.message ? ` ${etat.message}` : ""}
        </p>
        {etat.echecs && etat.echecs.length > 0 ? (
          <ul className="m-0 mt-3 list-none space-y-1 p-0 text-[length:var(--text-aide)]">
            {etat.echecs.slice(0, 20).map((echec) => (
              <li key={echec.ligne}>
                Ligne {echec.ligne} — {echec.raison}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {etat.acces && etat.acces.length > 0 ? (
        <div className="carte p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
                Fiches d&apos;accès à distribuer
              </h2>
              <p className="m-0 mt-2 max-w-[60ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                Imprimez cette page maintenant. Ces mots de passe sont
                temporaires, ils ne seront plus jamais affichés, et personne ne
                pourra les retrouver — pas même nous.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="bouton bouton-secondaire print:hidden"
            >
              Imprimer
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {etat.acces.map((eleve) => (
              <div
                key={eleve.login}
                className="break-inside-avoid rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4"
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

function BoutonEtape({
  libelle,
  variante,
}: {
  libelle: string;
  variante: "primaire" | "secondaire";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`bouton bouton-${variante} mt-6`}>
      {pending ? "Traitement en cours…" : libelle}
    </button>
  );
}

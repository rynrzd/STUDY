"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deposerFichiers, deposerProfesseurs, lireColonnes } from "@/app/admin/import/actions";
import { ETAT_COLONNES_INITIAL, ETAT_DEPOT_INITIAL, type EtatColonnes, type EtatDepot, type FichierColonnes } from "@/app/admin/import/etats";

/** Ce que chaque colonne peut devenir, dans les mots de l'écran. */
const CHAMPS = {
  eleves: [
    ["nom", "Nom"],
    ["prenom", "Prénom"],
    ["classe", "Classe"],
    ["email", "E-mail"],
    ["identifiantExterne", "Identifiant (INE, matricule)"],
  ],
  professeurs: [
    ["nom", "Nom"],
    ["prenom", "Prénom"],
    ["email", "E-mail"],
    ["matieres", "Matière(s)"],
    ["classes", "Classe(s)"],
  ],
} as const;
const REQUIS = ["nom", "prenom"] as const;

export type Choix = Record<string, Record<string, number>>;

/** La proposition automatique, comme point de départ : champ → index de colonne. */
function choixInitial(fichiers: readonly FichierColonnes[]): Choix {
  const sortie: Choix = {};
  for (const f of fichiers) {
    const c: Record<string, number> = {};
    for (const col of f.colonnes) if (col.champ !== null && c[col.champ] === undefined) c[col.champ] = col.index;
    sortie[f.nom] = c;
  }
  return sortie;
}

/**
 * Dépôt multi-fichiers (§5.1).
 *
 * Un lycée n'a presque jamais un seul fichier : il a un export par classe, ou
 * un export global, ou les deux. L'écran accepte les deux sans poser la
 * question — c'est l'analyse qui reconnaît ce qu'elle a reçu.
 *
 * La liste des fichiers choisis reste visible avant l'envoi, avec un moyen
 * d'en retirer un. Sans cela, se tromper d'un fichier oblige à tout
 * resélectionner.
 */
export function DepotRentree({ cible }: { cible: "eleves" | "professeurs" }) {
  const eleves = cible === "eleves";

  const [etat, deposer] = useActionState<EtatDepot, FormData>(
    eleves ? deposerFichiers : deposerProfesseurs,
    ETAT_DEPOT_INITIAL,
  );

  const [choix, setChoix] = useState<Choix>({});
  const [lus, setLus] = useState<string | null>(null);
  const [colonnes, verifier] = useActionState<EtatColonnes, FormData>(async (precedent, donnees) => {
    try {
      const reponse = await lireColonnes(cible, precedent, donnees);
      if (reponse.fichiers) setChoix(choixInitial(reponse.fichiers));
      return reponse;
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_COLONNES_INITIAL);

  const champ = useRef<HTMLInputElement>(null);
  const [choisis, setChoisis] = useState<File[]>([]);
  // Les colonnes lues valent pour la sélection d'alors : changer de fichiers
  // les rend caduques, et l'écran revient au bouton « Vérifier les colonnes »
  // au lieu d'appliquer un choix périmé.
  const signature = choisis.map((f) => `${f.name}:${f.size}`).join("|");
  const apercu = colonnes.etat === "ok" && lus === signature ? (colonnes.fichiers ?? []) : null;
  const manquants = (apercu ?? [])
    .filter((f) => f.erreur === null)
    .flatMap((f) => REQUIS.filter((c) => choix[f.nom]?.[c] === undefined).map((c) => `${f.nom} : ${c === "nom" ? "nom" : "prénom"}`));
  const [survol, setSurvol] = useState(false);

  /**
   * Le champ `<input type="file">` est la source de vérité de l'envoi : le
   * navigateur n'accepte pas qu'on lui pose une liste de fichiers à la main,
   * sauf en passant par un `DataTransfer`. C'est ce que fait cette fonction,
   * et c'est aussi ce qui permet le glisser-déposer.
   */
  function poser(fichiers: File[]) {
    const transfert = new DataTransfer();
    for (const fichier of fichiers) transfert.items.add(fichier);
    if (champ.current !== null) champ.current.files = transfert.files;
    setChoisis(fichiers);
  }

  function ajouter(nouveaux: FileList | null) {
    if (nouveaux === null) return;
    const liste = [...choisis];
    for (const fichier of Array.from(nouveaux)) {
      // Redéposer le même fichier deux fois est une erreur silencieuse
      // coûteuse : elle doublerait chaque élève dans l'aperçu.
      if (liste.some((deja) => deja.name === fichier.name && deja.size === fichier.size)) continue;
      liste.push(fichier);
    }
    poser(liste);
  }

  return (
    <form action={deposer} data-testid="depot-rentree" className="space-y-5">
      <input type="hidden" name="correspondances" value={apercu ? JSON.stringify(choix) : ""} />
      <div
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setSurvol(false);
          ajouter(evenement.dataTransfer.files);
        }}
        className={`rounded-[var(--radius-carte)] border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          survol
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)]"
            : "border-[color:var(--color-bordure)]"
        }`}
      >
        <p className="m-0 text-[length:var(--text-tableau)] font-semibold">
          {eleves ? "Déposez vos fichiers de classes" : "Déposez votre fichier de professeurs"}
        </p>
        <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          {eleves
            ? "Un fichier par classe, ou un seul fichier pour tout le lycée. Format .xlsx ou .csv."
            : "Nom, prénom, matière(s) et classe(s) par ligne. Format .xlsx ou .csv."}{" "}
          Rien n&apos;est créé maintenant : vous verrez d&apos;abord ce qui a été
          compris.
        </p>
        <p className="m-0 mt-2 text-[length:var(--text-aide)]">
          <a href={`/admin/import/modele?type=${cible}`} className="lien-fleche" download>
            Télécharger un modèle de fichier (.csv)
          </a>
        </p>

        <input
          ref={champ}
          id={`fichiers-${cible}`}
          data-testid="depot-fichiers"
          name="fichiers"
          type="file"
          multiple
          /* Le champ est masque et pilote par le bouton voisin : sans intitule
             explicite, un lecteur d ecran qui l atteint ne sait pas ce que
             c est. Aucune etiquette visible ne lui correspond, donc on le dit
             ici. */
          aria-label={
            eleves
              ? "Fichiers d eleves a deposer (.xlsx ou .csv)"
              : "Fichiers de professeurs a deposer (.xlsx ou .csv)"
          }
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(evenement) => ajouter(evenement.target.files)}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => champ.current?.click()}
          className="bouton bouton-secondaire mt-5 w-full sm:w-auto"
        >
          Choisir des fichiers
        </button>
      </div>

      {choisis.length > 0 ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {choisis.map((fichier) => (
            <li
              key={`${fichier.name}-${fichier.size}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-tableau)]">
                  {fichier.name}
                </span>
                <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                  {Math.max(1, Math.round(fichier.size / 1024))} Ko
                </span>
              </span>
              <button
                type="button"
                onClick={() => poser(choisis.filter((autre) => autre !== fichier))}
                className="shrink-0 rounded-[var(--rayon-s)] px-2 py-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)] underline underline-offset-2 hover:text-[color:var(--color-encre)]"
              >
                Retirer<span className="sr-only"> {fichier.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {apercu ? <VerifierColonnes cible={cible} apercu={apercu} choix={choix} setChoix={setChoix} manquants={manquants} /> : null}

      {colonnes.etat === "erreur" ? (
        <p role="alert" className="m-0 text-[0.875rem] text-[color:var(--color-erreur)]">
          {colonnes.message}
        </p>
      ) : null}

      {etat.etat === "erreur" ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonDepot
        nombre={choisis.length}
        verifie={apercu !== null}
        verifier={(donnees) => {
          setLus(signature);
          verifier(donnees);
        }}
      />
    </form>
  );
}

/** Étape 2 du parcours d'import (ch. 17) : une ligne par colonne du fichier, avec un exemple et un choix. */
export function VerifierColonnes({
  cible,
  apercu,
  choix,
  setChoix,
  manquants,
}: {
  cible: "eleves" | "professeurs";
  apercu: readonly FichierColonnes[];
  choix: Choix;
  setChoix: React.Dispatch<React.SetStateAction<Choix>>;
  manquants: readonly string[];
}) {
  return (
    <section aria-labelledby={`colonnes-${cible}`} className="colonnes-import">
      <h3 id={`colonnes-${cible}`} className="m-0 text-[1rem] font-bold">
        Vérifier les colonnes
      </h3>
      <p className="meta m-0 mt-1">
        Pour chaque colonne de vos fichiers, ce qu&apos;elle contient. Corrigez si besoin : rien n&apos;est enregistré tant que vous n&apos;avez pas lancé l&apos;analyse.
      </p>
      {apercu.map((f) => (
        <div key={f.nom} className="mt-4">
          <p className="m-0 font-semibold">
            {f.nom}{" "}
            {f.erreur === null ? (
              <span className="meta">
                · {f.lignes} ligne{f.lignes > 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
          {f.erreur !== null ? (
            <p role="alert" className="m-0 mt-1 text-[0.875rem] text-[color:var(--color-erreur)]">
              {f.erreur}
            </p>
          ) : (
            <div className="colonnes-import-defilement">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Colonne du fichier</th>
                    <th scope="col">Exemple</th>
                    <th scope="col">Ce qu&apos;elle contient</th>
                  </tr>
                </thead>
                <tbody>
                  {f.colonnes.map((col) => {
                    const actuel = Object.entries(choix[f.nom] ?? {}).find(([, i]) => i === col.index)?.[0] ?? "";
                    return (
                      <tr key={col.index}>
                        <td>
                          <span className="font-semibold">{col.entete || `Colonne ${col.index + 1}`}</span>
                          {col.confiance === "a_confirmer" && actuel === col.champ ? (
                            <span className="etiquette-etat ml-2" data-ton="attention">
                              À confirmer
                            </span>
                          ) : null}
                        </td>
                        <td className="meta">{col.exemple || "—"}</td>
                        <td>
                          <select
                            aria-label={`Contenu de la colonne « ${col.entete || col.index + 1} » de ${f.nom}`}
                            className="champ h-10 py-0 text-[0.875rem]"
                            value={actuel}
                            onChange={(e) => {
                              const valeur = e.target.value;
                              setChoix((avant) => {
                                const c = { ...(avant[f.nom] ?? {}) };
                                for (const [k, i] of Object.entries(c)) if (i === col.index || k === valeur) delete c[k];
                                if (valeur !== "") c[valeur] = col.index;
                                return { ...avant, [f.nom]: c };
                              });
                            }}
                          >
                            <option value="">Ne pas utiliser</option>
                            {CHAMPS[cible].map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {manquants.length > 0 ? (
        <p role="alert" className="m-0 mt-3 text-[0.875rem] font-semibold text-[color:var(--color-attention)]">
          Il manque une colonne obligatoire — {manquants.join(", ")}. L&apos;analyse signalera ces lignes comme à corriger.
        </p>
      ) : null}
    </section>
  );
}

function BoutonDepot({ nombre, verifie, verifier }: { nombre: number; verifie: boolean; verifier: (donnees: FormData) => void }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* Étape 2 du parcours (ch. 17) : lire les colonnes, sans rien
            enregistrer, avant d'analyser. */}
        {!verifie ? (
          <button
            type="submit"
            formAction={verifier}
            data-testid="depot-colonnes"
            disabled={pending || nombre === 0}
            className="bouton bouton-primaire w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Lecture…" : "Vérifier les colonnes"}
          </button>
        ) : null}
        <button
          type="submit"
          data-testid="depot-valider"
          disabled={pending || nombre === 0}
          className={`bouton ${verifie ? "bouton-primaire" : "bouton-secondaire"} w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}
        >
          {pending
            ? "Lecture des fichiers…"
            : verifie
              ? nombre <= 1
                ? "Analyser avec ces colonnes"
                : `Analyser les ${nombre} fichiers avec ces colonnes`
              : "Analyser directement"}
        </button>
      </div>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        L&apos;analyse ne crée aucun compte.
      </p>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { importerGroupes } from "@/app/admin/import/actions";
import { ETAT_IMPORT_GROUPES_INITIAL, type EtatImportGroupes } from "@/app/admin/import/etats";

const SORTS: Record<string, string> = { nouveau: "à ajouter", deja: "déjà en place", inconnu: "introuvable", ambigu: "ambigu", rejete: "rejeté" };

/**
 * Import de groupes — cahier des charges ch. 17 (IMP-05, IMP-06). Deux temps
 * sur le même fichier : « Analyser » montre ce qui sera créé, sans rien
 * écrire ; « Appliquer » écrit ce qui est coché.
 */
export function ImportGroupes() {
  const [etat, action] = useActionState<EtatImportGroupes, FormData>(async (precedent, donnees) => {
    try {
      return await importerGroupes(precedent, donnees);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_IMPORT_GROUPES_INITIAL);
  const [fichier, setFichier] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<string | null>(null);

  const r = etat.etat === "ok" ? etat.resultat : undefined;
  // L'aperçu vaut pour le fichier d'alors ; en changer oblige à réanalyser.
  const apercu = r !== undefined && !r.applique && analyse === fichier ? r : null;
  const fait = r !== undefined && r.applique ? r : null;
  const problemes = (apercu ?? fait)?.lignes.filter((l) => ["inconnu", "ambigu", "rejete"].includes(l.eleve ?? "") || l.enseignement === "rejete") ?? [];

  return (
    <form action={action} className="space-y-4" onSubmit={(e) => {
      const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (mode === "apercu") setAnalyse(fichier);
    }}>
      <div>
        <label className="etiquette" htmlFor="fichier-groupes">
          Fichier de groupes (.xlsx ou .csv)
        </label>
        <input
          id="fichier-groupes"
          name="fichier"
          type="file"
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="champ"
          onChange={(e) => setFichier(e.target.files?.[0] ? `${e.target.files[0].name}:${e.target.files[0].size}` : null)}
        />
        <p className="aide-champ">
          Une ligne par élève et par groupe (colonnes « groupe » et « eleve » : identifiant de connexion ou INE), ou une colonne « groupes » avec
          « Spé Maths A|Anglais B ». « matiere » et « professeur » sont facultatives.{" "}
          <a href="/admin/import/modele?type=groupes" download className="lien-fleche">
            Modèle (.csv)
          </a>
        </p>
      </div>

      {apercu ? (
        <div className="panneau p-4 md:p-5" role="status">
          <p className="m-0 font-bold">Ce que l&apos;import ferait — rien n&apos;est encore créé</p>
          <ul className="m-0 mt-2 grid gap-1 pl-5 text-[0.9375rem]">
            <li>
              {apercu.resume.groupes_nouveaux} groupe(s) à créer, {apercu.resume.groupes_existants} déjà existant(s)
            </li>
            <li>
              {apercu.resume.appartenances_nouvelles} élève(s) à ajouter, {apercu.resume.deja_membres} déjà membre(s)
            </li>
            <li>
              {apercu.resume.enseignements_nouveaux} enseignement(s) à ouvrir, {apercu.resume.enseignements_existants} déjà en place
            </li>
            {apercu.resume.eleves_inconnus + apercu.resume.eleves_ambigus + apercu.resume.enseignements_rejetes > 0 ? (
              <li className="font-semibold text-[color:var(--color-attention)]">
                {apercu.resume.eleves_inconnus} élève(s) introuvable(s), {apercu.resume.eleves_ambigus} ambigu(s), {apercu.resume.enseignements_rejetes}{" "}
                enseignement(s) rejeté(s) : ces lignes seront ignorées, les autres appliquées.
              </li>
            ) : null}
          </ul>
          <fieldset className="m-0 mt-4 border-0 p-0">
            <legend className="etiquette">À créer</legend>
            <label className="flex items-start gap-3 text-[0.9375rem]">
              <input type="checkbox" name="appartenances" value="oui" defaultChecked className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]" />
              Ajouter les élèves dans leurs groupes ({apercu.resume.appartenances_nouvelles})
            </label>
            <label className="mt-2 flex items-start gap-3 text-[0.9375rem]">
              <input type="checkbox" name="enseignements" value="oui" defaultChecked={apercu.resume.enseignements_nouveaux > 0} className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]" />
              Ouvrir les enseignements avec leurs professeurs ({apercu.resume.enseignements_nouveaux})
            </label>
          </fieldset>
        </div>
      ) : null}

      {fait ? (
        <p role="status" className="m-0 flex items-start gap-2 font-semibold text-[color:var(--color-succes)]">
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
          Import appliqué : {fait.resume.groupes_nouveaux} groupe(s) créé(s), {fait.resume.appartenances_nouvelles} élève(s) ajouté(s),{" "}
          {fait.resume.enseignements_nouveaux} enseignement(s). Le rejouer ne crée pas de doublon.
        </p>
      ) : null}

      {problemes.length > 0 ? (
        <div>
          <p className="m-0 font-semibold">Lignes ignorées ({problemes.length})</p>
          <ul className="m-0 mt-1 grid max-h-[260px] gap-1 overflow-y-auto pl-5 text-[0.875rem]">
            {problemes.slice(0, 100).map((l) => (
              <li key={l.rang}>
                Entrée n° {l.rang} · {l.groupe || "sans groupe"} · {l.raison ?? SORTS[l.eleve ?? ""] ?? "rejetée"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {etat.etat === "erreur" ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-[color:var(--color-erreur)]">
          <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" /> {etat.message}
        </p>
      ) : null}

      <Boutons pret={fichier !== null} apercu={apercu !== null} />
    </form>
  );
}

function Boutons({ pret, apercu }: { pret: boolean; apercu: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" name="mode" value="apercu" disabled={!pret || pending} className={`bouton ${apercu ? "bouton-secondaire" : "bouton-primaire"} disabled:opacity-50`}>
        {pending ? "Lecture…" : apercu ? "Réanalyser" : "Analyser"}
      </button>
      {apercu ? (
        <button type="submit" name="mode" value="appliquer" disabled={pending} className="bouton bouton-primaire">
          {pending ? "Application…" : "Appliquer"}
        </button>
      ) : null}
    </div>
  );
}

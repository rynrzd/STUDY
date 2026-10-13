"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { transfererDesCours } from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

type Cours = { id: string; matiere: string; cible: string; cible_id: string; genre: "classe" | "groupe"; role: string };

/**
 * Transférer des cours à un autre professeur — cahier des charges ch. 08
 * (PROF-13) : cocher, choisir qui reprend et à quelle date, relire l'aperçu,
 * confirmer. Rien ne part avant la confirmation.
 */
export function TransfertCours({ nom, cours, professeurs }: { nom: string; cours: readonly Cours[]; professeurs: readonly { id: string; label: string }[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [coches, setCoches] = useState<string[]>([]);
  const [cible, setCible] = useState("");
  const [date, setDate] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (p, d) => {
    try {
      const r = await transfererDesCours(p, d);
      setConfirmer(false);
      if (r.etat === "ok") setCoches([]);
      return r;
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez : rien n'a été fait à moitié pour un cours." };
    }
  }, ETAT_ADMIN_INITIAL);
  const transferables = cours.filter((c) => c.role !== "remplacant");
  if (transferables.length === 0) return null;
  const choisis = transferables.filter((c) => coches.includes(c.id));
  const qui = professeurs.find((p) => p.id === cible)?.label ?? "";

  if (!ouvert) {
    return (
      <button type="button" className="bouton bouton-compact bouton-secondaire" onClick={() => setOuvert(true)}>
        <ArrowRightLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Transférer des cours
      </button>
    );
  }
  return (
    <form action={action} className="panneau mt-3 w-full">
      <p className="m-0 font-bold">Transférer des cours de {nom}</p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0">
        {transferables.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-2 text-[0.9375rem]">
              <input type="checkbox" checked={coches.includes(c.id)} onChange={() => setCoches((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} className="size-4 accent-[color:var(--color-accent)]" />
              {c.matiere} · {c.cible}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="transfert-cible">
            Repris par
          </label>
          <select id="transfert-cible" name="cible" className="champ" value={cible} onChange={(e) => setCible(e.target.value)}>
            <option value="">Choisir…</option>
            {professeurs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="transfert-date">
            À partir du (vide : aujourd&apos;hui)
          </label>
          <input id="transfert-date" name="date" type="date" className="champ" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <input type="hidden" name="cours" value={JSON.stringify(choisis.map((c) => ({ id: c.id, genre: c.genre, cible: c.cible_id, matiere: c.matiere, role: c.role })))} />
      {choisis.length > 0 && cible !== "" ? (
        <p className="m-0 mt-3 rounded-[var(--rayon-m)] bg-[color:var(--color-fond)] p-3 text-[0.875rem]" role="status">
          Aperçu : {choisis.length} cours ({choisis.map((c) => `${c.matiere} · ${c.cible}`).join(", ")}) passent à {qui}
          {date ? ` le ${new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : " aujourd'hui"}. L&apos;affectation de {nom} se
          termine la veille ; ses séances publiées restent dans les cours.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {confirmer ? (
          <>
            <button type="submit" className="bouton bouton-compact bouton-primaire">
              Confirmer le transfert
            </button>
            <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setConfirmer(false)}>
              Revenir
            </button>
          </>
        ) : (
          <>
            <button type="button" className="bouton bouton-compact bouton-primaire" disabled={choisis.length === 0 || cible === ""} onClick={() => setConfirmer(true)}>
              Transférer {choisis.length > 0 ? choisis.length : ""} cours
            </button>
            <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setOuvert(false)}>
              Fermer
            </button>
          </>
        )}
      </div>
      {etat.message ? (
        <p role="status" className={`m-0 mt-2 text-[0.875rem] ${etat.etat === "ok" ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}

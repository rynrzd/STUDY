import Link from "next/link";
import { Compass, FolderKanban, Lock, Plus, Users } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, ICONE, Ligne, ListeLignes, Panneau, TuileIcone, dateLisible } from "@/components/study/ui";
import { repondreInvitation } from "./actions";
import { FormulaireProjet } from "./formulaires";

export interface ProjetLigne {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly visibilite: string;
  readonly updated_at: string;
}

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueProjets({ invitations, actifs, classes, participants, etapeDe }: {
  invitations: readonly ProjetLigne[];
  actifs: readonly ProjetLigne[];
  classes: readonly { id: string; libelle: string }[];
  participants: (id: string) => number;
  etapeDe: (id: string) => string;
}) {
  const visibilite = (v: string) => (
    <Etiquette ton={v === "prive" ? "neutre" : "rose"}>
      {v === "prive" ? <Lock size={12} strokeWidth={1.75} aria-hidden="true" /> : <Users size={12} strokeWidth={1.75} aria-hidden="true" />}
      {v === "prive" ? "Privé" : "Groupe"}
    </Etiquette>
  );
  const etape = etapeDe;

  return (
    <>
      <EnTetePage
        sourcil="Projets"
        titre="Mes projets"
        sousTitre="Projets personnels et projets de groupe, avec leurs tâches et documents."
        actions={
          <>
            <Link href="/app/orientation" className="bouton bouton-secondaire">
              <Compass {...ICONE} /> Orientation et stages
            </Link>
            <a href="#nouveau-projet" className="bouton bouton-primaire">
              <Plus {...ICONE} /> Nouveau projet
            </a>
          </>
        }
      />
      {invitations.length > 0 ? (
        <Panneau titre="Invitations reçues" compte={invitations.length} className="mb-6 border-0 bg-[color:var(--color-rose-clair)]">
          <ul className="m-0 list-none p-0">
            {invitations.map((p) => (
              <li key={p.id} className="ligne">
                <span className="min-w-0 flex-1 font-semibold">{p.titre}</span>
                <form action={repondreInvitation} className="flex gap-2">
                  <input type="hidden" name="projet" value={p.id} />
                  <button type="submit" name="accepter" value="oui" className="bouton bouton-primaire bouton-compact">
                    Accepter
                  </button>
                  <button type="submit" name="accepter" value="non" className="bouton bouton-discret bouton-compact">
                    Refuser
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Panneau>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {actifs.length === 0 ? (
            <EtatVide icone={FolderKanban} titre="Pas encore de projet" texte="Un exposé, un dossier, un club, une idée à creuser : crée un projet pour organiser les tâches et les documents." />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] md:block">
                <table className="tableau-r2">
                  <caption className="sr-only">Mes projets</caption>
                  <thead>
                    <tr>
                      <th scope="col">Projet</th>
                      <th scope="col">Visibilité</th>
                      <th scope="col">Prochaine étape</th>
                      <th scope="col">Dernière activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actifs.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="flex items-center gap-3">
                            <TuileIcone icone={FolderKanban} />
                            <span className="min-w-0">
                              <Link href={`/app/projets/${p.id}`} className="font-semibold text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
                                {p.titre}
                              </Link>
                              <span className="meta block">
                                {participants(p.id)} participant{participants(p.id) > 1 ? "s" : ""}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>{visibilite(p.visibilite)}</td>
                        <td className="text-[color:var(--color-encre-faible)]">{etape(p.id)}</td>
                        <td className="meta whitespace-nowrap">{dateLisible(p.updated_at, { day: "numeric", month: "short" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                <ListeLignes>
                  {actifs.map((p) => (
                    <Ligne key={p.id} href={`/app/projets/${p.id}`} icone={FolderKanban} titre={p.titre} detail={etape(p.id)} fin={visibilite(p.visibilite)} />
                  ))}
                </ListeLignes>
              </div>
            </>
          )}
        </div>
        <Panneau titre="Nouveau projet" as="aside" id="nouveau-projet">
          <FormulaireProjet classes={classes} />
        </Panneau>
      </div>
    </>
  );
}

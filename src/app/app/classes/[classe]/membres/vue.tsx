import { Check, KeyRound, Lock, UserMinus, X } from "lucide-react";
import { Confirmer } from "@/components/study/Dialogue";
import { FormulaireCode, FormulaireDelegue, FormulaireInvitationEleve, FormulaireRetrait } from "@/components/study/classe-formulaires";
import { Encadre, Etiquette, Panneau, dateHeure, dateLisible } from "@/components/study/ui";
import type { Membre, codesDeClasse, delegues, demandesATraiter, invitationsDeClasse } from "@/lib/v6/classe";
import { deciderDemande, revoquerCodes, revoquerInvitation, revoquerMandat } from "../../actions";

const ROLES: Record<string, string> = {
  eleve: "Élève",
  delegue: "Délégation",
  professeur: "Professeur",
  professeur_principal: "Professeur principal",
};

const ETATS_COMPTE: Record<string, { libelle: string; ton: "succes" | "attention" | "erreur" | "neutre" }> = {
  actif: { libelle: "Actif", ton: "succes" },
  a_activer: { libelle: "Invité, pas encore connecté", ton: "attention" },
  suspendu: { libelle: "Suspendu", ton: "erreur" },
};

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueMembres({ classe, responsable, admin, demandes, codeValide, eleves, equipe, mandats, liste, invitationPar, finAnnee }: {
  classe: string;
  responsable: boolean;
  admin: boolean;
  demandes: Awaited<ReturnType<typeof demandesATraiter>>;
  codeValide: Awaited<ReturnType<typeof codesDeClasse>>[number] | undefined;
  eleves: readonly Membre[];
  equipe: readonly Membre[];
  mandats: Awaited<ReturnType<typeof delegues>>;
  liste: readonly Membre[];
  invitationPar: Map<string, NonNullable<Awaited<ReturnType<typeof invitationsDeClasse>>>[number]>;
  finAnnee: string;
}) {
  return (
    <div className="grid gap-6">
      {responsable ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panneau id="demandes" titre="Demandes en attente" compte={demandes.length}>
            {demandes.length === 0 ? (
              <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune demande à examiner.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {demandes.map((d) => (
                  <li key={d.id} className="ligne">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {d.prenom} {d.nom}
                      </span>
                      <span className="meta">Demandée le {dateHeure(d.demandee_le)}</span>
                    </span>
                    <form action={deciderDemande} className="flex gap-1.5">
                      <input type="hidden" name="demande" value={d.id} />
                      <input type="hidden" name="classe" value={classe} />
                      <button type="submit" name="accepter" value="oui" className="bouton bouton-primaire bouton-compact">
                        <Check size={16} strokeWidth={1.75} aria-hidden="true" /> Accepter
                      </button>
                      <button type="submit" name="accepter" value="non" className="bouton bouton-discret bouton-compact">
                        <X size={16} strokeWidth={1.75} aria-hidden="true" /> Refuser
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="meta m-0 mt-3">Accepter inscrit l&apos;élève dans la classe ; cela ne lui donne aucun autre rôle. Chaque décision est journalisée.</p>
          </Panneau>

          <Panneau id="code" titre="Code de classe" className="border-0 bg-[color:var(--color-rose-clair)]">
            <p className="m-0 mb-3 text-[color:var(--color-encre-faible)]">
              {codeValide
                ? `Un code est valable jusqu'au ${dateHeure(codeValide.expires_at)}. Il n'est plus affichable : créez-en un nouveau pour le communiquer à nouveau (l'ancien sera révoqué).`
                : "Aucun code valable. Un code permet à un élève déjà doté d'un compte de demander à rejoindre la classe."}
            </p>
            <FormulaireCode classe={classe} />
            {codeValide ? (
              <form action={revoquerCodes} className="mt-2">
                <input type="hidden" name="classe" value={classe} />
                <button type="submit" className="bouton bouton-discret bouton-compact">
                  <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Révoquer le code en cours
                </button>
              </form>
            ) : null}
          </Panneau>
        </div>
      ) : null}

      <Panneau id="eleves" titre="Élèves" compte={eleves.length}>
        {eleves.length === 0 ? (
          <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun élève inscrit pour l&apos;instant.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {eleves.map((m) => {
              const inv = invitationPar.get(m.profileId);
              const etat = m.etatCompte ? ETATS_COMPTE[m.etatCompte] : null;
              return (
                <li key={m.profileId} className="ligne flex-wrap">
                  <span className="avatar" aria-hidden="true">
                    {m.initiales}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.affichage}</span>
                    <span className="meta">{ROLES[m.role]}</span>
                  </span>
                  {etat ? <Etiquette ton={etat.ton}>{etat.libelle}</Etiquette> : null}
                  {responsable ? (
                    <span className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                      {admin ? (
                        inv?.invitation === "valide" ? (
                          <form action={revoquerInvitation} className="flex items-center gap-2">
                            <span className="meta">Invitation valable jusqu&apos;au {dateLisible(inv.expire_le, { day: "numeric", month: "short" })}</span>
                            <input type="hidden" name="profil" value={m.profileId} />
                            <input type="hidden" name="classe" value={classe} />
                            <button type="submit" className="bouton bouton-discret bouton-compact">
                              Révoquer
                            </button>
                          </form>
                        ) : (
                          <FormulaireInvitationEleve classe={classe} profil={m.profileId} nom={m.affichage} />
                        )
                      ) : null}
                      <Confirmer
                        variante="discret"
                        declencheur={
                          <>
                            <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" /> Retirer
                          </>
                        }
                        titre={`Retirer ${m.affichage} de la classe ?`}
                        impact={null}
                      >
                        <FormulaireRetrait classe={classe} profil={m.profileId} nom={m.affichage} />
                      </Confirmer>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      <Panneau id="equipe" titre="Équipe pédagogique" compte={equipe.length}>
        <ul className="m-0 list-none p-0">
          {equipe.map((m) => (
            <li key={m.profileId} className="ligne">
              <span className="avatar" aria-hidden="true">
                {m.initiales}
              </span>
              <span className="min-w-0 flex-1 font-semibold">{m.affichage}</span>
              <span className="meta">{ROLES[m.role]}</span>
            </li>
          ))}
        </ul>
        <p className="meta m-0 mt-3">Aucune adresse, aucun numéro et aucune heure de connexion ne sont affichés aux membres de la classe.</p>
      </Panneau>

      {responsable ? (
        <Panneau id="mandats" titre="Délégués et mandats" compte={mandats.length}>
          {mandats.length === 0 ? (
            <p className="m-0 mb-4 text-[color:var(--color-encre-faible)]">Aucun mandat en cours.</p>
          ) : (
            <ul className="m-0 mb-4 list-none p-0">
              {mandats.map((d) => (
                <li key={d.id} className="ligne">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{liste.find((m) => m.profileId === d.profile_id)?.affichage ?? "Élève"}</span>
                    <span className="meta">
                      {d.titre === "suppleant" ? "Suppléant" : "Titulaire"} · jusqu&apos;au {dateLisible(d.ends_on)}
                    </span>
                  </span>
                  <form action={revoquerMandat}>
                    <input type="hidden" name="mandat" value={d.id} />
                    <input type="hidden" name="classe" value={classe} />
                    <button type="submit" className="bouton bouton-discret bouton-compact">
                      Mettre fin
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <FormulaireDelegue classe={classe} eleves={eleves.map((e) => ({ id: e.profileId, nom: e.affichage }))} finAnnee={finAnnee} />
        </Panneau>
      ) : null}
      {!responsable ? (
        <Encadre icone={Lock} ton="neutre">
          Tu vois les noms et rôles de ta classe, rien d&apos;autre. Pour une question sur ton inscription, adresse-toi à la vie scolaire.
        </Encadre>
      ) : null}
    </div>
  );
}

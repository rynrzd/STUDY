import { Check, KeyRound, UserMinus, X } from "lucide-react";
import { Confirmer } from "@/components/study/Dialogue";
import { FormulaireCode, FormulaireDelegue, FormulaireInvitationEleve, FormulaireRetrait } from "@/components/study/classe-formulaires";
import { EtatErreur, Etiquette, Panneau, dateHeure, dateLisible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { codesDeClasse, delegues, demandesATraiter, droits as lireDroits, invitationsDeClasse, membres } from "@/lib/v6/classe";
import { deciderDemande, revoquerCodes, revoquerInvitation, revoquerMandat } from "../../actions";

export const metadata = { title: "Membres" };
export const dynamic = "force-dynamic";

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

/**
 * E18 — Membres. Un élève voit les noms et rôles publics de sa classe, rien
 * d'autre. Les responsables (administration, professeur principal) voient
 * aussi les états de compte, les demandes en attente, le code de classe, les
 * invitations et peuvent retirer un accès. Aucun bouton d'administration
 * n'est rendu à un élève, et chaque action est revérifiée côté base.
 */
export default async function PageMembres({ params }: { params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const [liste, droits] = await Promise.all([membres(ctx.jeton, classe), lireDroits(ctx.jeton, classe)]);
  const responsable = droits.responsable;
  const admin = ctx.roles.admin;
  const [demandes, codes, invitations, mandats] = responsable
    ? await Promise.all([
        demandesATraiter(ctx.jeton, classe),
        codesDeClasse(ctx.jeton, classe),
        admin ? invitationsDeClasse(ctx.jeton, classe) : Promise.resolve(null),
        delegues(ctx.jeton, classe),
      ])
    : [[], [], null, []];

  if (liste === null) return <EtatErreur requestId={idRequete()} />;
  const eleves = liste.filter((m) => m.role === "eleve" || m.role === "delegue");
  const equipe = liste.filter((m) => m.role === "professeur" || m.role === "professeur_principal");
  const codeValide = codes.find((c) => c.revoked_at === null && new Date(c.expires_at) > new Date());
  const finAnnee = `${new Date().getMonth() >= 7 ? new Date().getFullYear() + 1 : new Date().getFullYear()}-07-04`;
  const invitationPar = new Map((invitations ?? []).map((i) => [i.profile_id, i]));

  return (
    <div className="grid gap-6">
      {responsable ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panneau id="demandes" titre={`Demandes en attente (${demandes.length})`}>
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
                      <button type="submit" name="accepter" value="oui" className="bouton bouton-secondaire bouton-compact">
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

          <Panneau id="code" titre="Code de classe">
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

      <Panneau id="eleves" titre={`Élèves (${eleves.length})`}>
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

      <Panneau id="equipe" titre="Équipe pédagogique">
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
        <Panneau id="mandats" titre="Délégués et mandats">
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
      {!responsable ? <p className="meta m-0">Pour une question sur ton inscription, adresse-toi à la vie scolaire.</p> : null}
    </div>
  );
}

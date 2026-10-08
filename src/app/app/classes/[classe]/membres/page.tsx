import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { codesDeClasse, delegues, demandesATraiter, droits as lireDroits, invitationsDeClasse, membres } from "@/lib/v6/classe";
import { EtatErreur } from "@/components/study/ui";
import { VueMembres } from "./vue";

export const metadata = { title: "Membres" };
export const dynamic = "force-dynamic";

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

  return <VueMembres classe={classe} responsable={responsable} admin={admin} demandes={demandes} codeValide={codeValide} eleves={eleves} equipe={equipe} mandats={mandats} liste={liste} invitationPar={invitationPar} finAnnee={finAnnee} />;
}

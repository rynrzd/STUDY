import Link from "next/link";
import { FormulaireReponseConsultation } from "@/components/study/classe-formulaires";
import { AccesIndisponible, AvisVisibilite, Etiquette, Panneau, dateHeure, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { droits as lireDroits, membres } from "@/lib/v6/classe";

export const metadata = { title: "Consultation" };
export const dynamic = "force-dynamic";

const ETATS: Record<string, string> = {
  brouillon: "En préparation",
  ouverte: "Ouverte",
  close: "Close",
  synthetisee: "Synthèse en préparation",
  publiee: "Compte rendu publié",
  archivee: "Archivée",
};

/**
 * E11 — Consultation mensuelle. La visibilité est dite avant les champs ;
 * l'aperçu montre le nom et les destinataires ; la réponse se modifie
 * jusqu'à la clôture, puis elle est verrouillée par la base (CLASS-01).
 */
export default async function PageConsultation({ params }: { params: Promise<{ classe: string; consultation: string }> }) {
  const ctx = await contexteApp();
  const { classe, consultation: id } = await params;
  const client = clientUtilisateur(ctx.jeton);
  const [lue, droits, lesMembres] = await Promise.all([
    client.from("consultations").select("id, class_id, titre, etat, ouvre_le, ferme_le").eq("id", id).eq("class_id", classe).maybeSingle(),
    lireDroits(ctx.jeton, classe),
    membres(ctx.jeton, classe),
  ]);
  const c = lue.data as { id: string; titre: string; etat: string; ouvre_le: string | null; ferme_le: string | null } | null;
  if (c === null) return <AccesIndisponible retour={`/app/classes/${classe}`} />;

  const [maReponse, synthese] = await Promise.all([
    client
      .from("consultation_reponses")
      .select("ce_qui_fonctionne, difficulte, proposition, categorie, version, updated_at")
      .eq("consultation_id", id)
      .eq("author_id", ctx.personne.profileId)
      .maybeSingle(),
    client.from("consultation_syntheses").select("texte, etat, published_at").eq("consultation_id", id).eq("etat", "publiee").maybeSingle(),
  ]);
  const r = maReponse.data as {
    ce_qui_fonctionne: string | null;
    difficulte: string | null;
    proposition: string | null;
    categorie: string;
    version: number;
    updated_at: string;
  } | null;
  const ouverte = c.etat === "ouverte" && c.ferme_le !== null && new Date(c.ferme_le) > new Date();
  const lecteurs = (lesMembres ?? [])
    .filter((m) => m.role === "delegue" || m.role === "professeur_principal")
    .map((m) => m.affichage);
  const destinataires = lecteurs.length > 0 ? `${lecteurs.join(", ")} (délégués en mandat et professeur principal)` : "les délégués en mandat et le professeur principal";
  const s = synthese.data as { texte: string; published_at: string } | null;

  return (
    <div className="mx-auto grid max-w-[800px] gap-6">
      <header>
        <p className="meta m-0">
          <Link href={`/app/classes/${classe}`}>Vie de classe</Link>
        </p>
        <h2 className="titre-section mt-2 text-[1.5rem]">{c.titre}</h2>
        <p className="m-0 mt-2 flex flex-wrap items-center gap-2">
          <Etiquette ton={ouverte ? "succes" : "neutre"}>{ETATS[c.etat] ?? c.etat}</Etiquette>
          {c.ferme_le ? <span className="meta">{ouverte ? `Ouverte jusqu'au ${dateHeure(c.ferme_le)}` : `Close le ${dateLisible(c.ferme_le)}`}</span> : null}
        </p>
      </header>

      {s ? (
        <Panneau titre="Compte rendu des délégués">
          <p className="m-0 whitespace-pre-line">{s.texte}</p>
          <p className="meta m-0 mt-3">Publié le {dateLisible(s.published_at)}. Il ne contient aucun nom.</p>
        </Panneau>
      ) : null}

      {droits.eleve ? (
        <Panneau titre={r ? "Ma réponse" : "Répondre"}>
          <div className="mb-5">
            <AvisVisibilite>
              <strong>Qui lira ta réponse ?</strong> Elle est nominative et sera lue par {destinataires}. Elle n&apos;est ni publiée à la
              classe, ni lue par l&apos;administration. Une synthèse sans nom pourra être publiée après relecture. Il n&apos;y a pas de faux
              anonymat.
            </AvisVisibilite>
          </div>
          {ouverte ? (
            <FormulaireReponseConsultation
              classe={classe}
              consultation={id}
              destinataires={destinataires}
              moi={`${ctx.personne.prenom} ${ctx.personne.nom}`}
              initiale={{
                fonctionne: r?.ce_qui_fonctionne ?? "",
                difficulte: r?.difficulte ?? "",
                proposition: r?.proposition ?? "",
                categorie: r?.categorie ?? "",
                version: r?.version ?? 0,
              }}
            />
          ) : r ? (
            <dl className="m-0 grid gap-3">
              <div>
                <dt className="meta">Ce qui fonctionne</dt>
                <dd className="m-0">{r.ce_qui_fonctionne || "—"}</dd>
              </div>
              <div>
                <dt className="meta">Difficulté</dt>
                <dd className="m-0">{r.difficulte || "—"}</dd>
              </div>
              <div>
                <dt className="meta">Proposition</dt>
                <dd className="m-0">{r.proposition || "—"}</dd>
              </div>
              <p className="meta m-0">La consultation est close : ta réponse ne peut plus être modifiée.</p>
            </dl>
          ) : (
            <p className="m-0 text-[color:var(--color-encre-faible)]">
              {c.etat === "brouillon" ? "La consultation n'est pas encore ouverte." : "La consultation est close."}
            </p>
          )}
        </Panneau>
      ) : null}

      {droits.delegue || droits.principal ? (
        <Link href={`/app/classes/${classe}/delegues#consultation-${id}`} className="bouton bouton-secondaire justify-self-start">
          Ouvrir le bureau des délégués
        </Link>
      ) : null}
    </div>
  );
}

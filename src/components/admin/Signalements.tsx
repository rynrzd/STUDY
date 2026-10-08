"use client";

import { ChevronRight, Flag, MessageCircle, MessageSquareReply } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { deciderDUnSignalement } from "@/app/admin/moderation/actions";
import { ETAT_MODERATION_INITIAL, type EtatModeration } from "@/app/admin/moderation/etats";
import { instantLisible } from "@/lib/horodatage";
import type { Signalement } from "@/lib/moderation";

/**
 * La file de modération — cahier V5, §7.
 *
 * **Le contenu signalé est montré en entier.** Un modérateur qui tranche sur un
 * extrait tranche mal. Il voit le texte, qui l'a écrit, dans quel cours, et
 * combien de personnes distinctes l'ont signalé.
 *
 * **Le nombre de signalements ne décide de rien.** Il est affiché parce qu'il
 * dit quelque chose — une personne isolée, ou une classe qui réagit — mais
 * aucune règle ne masque automatiquement au-delà d'un seuil. Un produit où le
 * nombre de clics décide est un produit où la majorité fait taire la minorité.
 *
 * **Le motif écrit est obligatoire.** Pas pour la forme : c'est ce qui permet
 * de répondre à un parent trois semaines plus tard. La base le refuse en
 * dessous de dix caractères, cet écran aussi.
 */

const RAISONS: Record<string, string> = {
  harcelement: "S'en prend à quelqu'un",
  contenu_inapproprie: "Contenu déplacé",
  hors_sujet: "Hors sujet",
  autre: "Autre",
};

const ETATS: Record<string, string> = {
  ouvert: "À regarder",
  en_examen: "En cours d'examen",
  traite: "Traité",
  rejete: "Classé sans suite",
};

const ONGLETS = [
  { cle: "a_traiter", libelle: "À traiter", etats: ["ouvert"] },
  { cle: "en_cours", libelle: "En cours", etats: ["en_examen"] },
  { cle: "traites", libelle: "Traités", etats: ["traite", "rejete"] },
] as const;

/**
 * D04 — deux panneaux : la file (onglets À traiter / En cours / Traités) et
 * le détail du signalement choisi, avec la décision motivée. La décision
 * reste celle du serveur (`moderer_signalement`, périmètre et audit).
 */
export function Signalements({ signalements }: { signalements: readonly Signalement[] }) {
  const ouverts = signalements.filter((ligne) => ligne.etat === "ouvert" || ligne.etat === "en_examen");
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]["cle"]>("a_traiter");
  const actif = ONGLETS.find((o) => o.cle === onglet) ?? ONGLETS[0];
  const visibles = signalements.filter((l) => (actif.etats as readonly string[]).includes(l.etat));
  const [selection, setSelection] = useState<string | null>(null);
  const choisi = visibles.find((l) => l.id === selection) ?? visibles[0] ?? null;

  return (
    <section className="mt-8">
      <p data-testid="signalements-compte" data-ouverts={ouverts.length} className="m-0 text-[color:var(--color-encre-faible)]">
        {ouverts.length === 0 ? "Aucun signalement à regarder." : ouverts.length === 1 ? "1 signalement à regarder." : `${ouverts.length} signalements à regarder.`}
      </p>

      <div role="tablist" aria-label="File des signalements" className="onglets-liens mt-4">
        {ONGLETS.map((o) => {
          const n = signalements.filter((l) => (o.etats as readonly string[]).includes(l.etat)).length;
          return (
            <button
              key={o.cle}
              type="button"
              role="tab"
              aria-selected={onglet === o.cle}
              onClick={() => {
                setOnglet(o.cle);
                setSelection(null);
              }}
              className="onglet-bouton"
            >
              {o.libelle} <span className="nombre">{n}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="m-0 mt-6 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
          {onglet === "a_traiter" ? "Rien à traiter. Le bouton de signalement est discret, et il sert rarement." : "Aucun signalement dans cette file."}
        </p>
      ) : (
        <div className="liste-detail mt-5">
          <ul className="liste-r2" aria-label={actif.libelle}>
            {visibles.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  aria-pressed={choisi?.id === l.id}
                  onClick={() => setSelection(l.id)}
                  className={`ligne-r2 w-full cursor-pointer border-0 text-left ${choisi?.id === l.id ? "bg-[color:var(--color-rose-clair)]" : "bg-transparent hover:bg-[color:var(--color-surface-douce)]"}`}
                >
                  <span className="tuile" aria-hidden="true">
                    {l.cible === "fil" ? <Flag size={20} strokeWidth={1.75} /> : l.cible === "message" ? <MessageCircle size={20} strokeWidth={1.75} /> : <MessageSquareReply size={20} strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{l.cible === "fil" ? "Question signalée" : l.cible === "message" ? "Message de salon signalé" : "Réponse signalée"}</span>
                    <span className="meta block truncate">{l.cours}</span>
                    <span className="meta block">{instantLisible(l.signaleLe)}</span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="chevron" />
                </button>
              </li>
            ))}
          </ul>
          <div>{choisi ? <Fiche key={choisi.id} signalement={choisi} /> : null}</div>
        </div>
      )}
    </section>
  );
}

function Fiche({ signalement }: { signalement: Signalement }) {
  const [etat, decider] = useActionState<EtatModeration, FormData>(
    deciderDUnSignalement,
    ETAT_MODERATION_INITIAL,
  );
  const champMotif = useId();
  const clos = signalement.etat === "traite" || signalement.etat === "rejete";

  return (
    <article
      data-testid="signalement"
      data-etat={signalement.etat}
      data-masque={signalement.masque ? "oui" : "non"}
      className="panneau"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          {signalement.cible === "fil" ? "Une question" : signalement.cible === "message" ? "Un message de salon" : "Une réponse"} · {signalement.cours} ·
          signalé le {instantLisible(signalement.signaleLe)}
        </p>
        <span className="etiquette-etat" data-ton={signalement.etat === "ouvert" ? "rose" : signalement.etat === "en_examen" ? "attention" : undefined}>
          {ETATS[signalement.etat] ?? signalement.etat}
        </span>
      </div>

      <blockquote
        data-testid="signalement-contenu"
        className="m-0 mt-3 rounded-[12px] border-l-[3px] border-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)] py-3 pl-4 pr-3 whitespace-pre-line"
      >
        {signalement.contenu === "" ? (
          <span className="text-[color:var(--color-encre-faible)] italic">
            Le contenu a été supprimé depuis le signalement.
          </span>
        ) : (
          signalement.contenu
        )}
      </blockquote>

      <dl className="m-0 mt-4 grid gap-x-6 gap-y-1 text-[length:var(--text-aide)] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="font-semibold">Écrit par</dt>
        <dd className="m-0">{signalement.auteurContenu}</dd>

        <dt className="font-semibold">Motif invoqué</dt>
        <dd className="m-0">
          {RAISONS[signalement.raison] ?? signalement.raison}
          {signalement.detail !== null && signalement.detail !== "" ? (
            <> — « {signalement.detail} »</>
          ) : null}
        </dd>

        <dt className="font-semibold">Signalé par</dt>
        <dd className="m-0">
          {signalement.signalePar}
          {signalement.signalements > 1 ? (
            <>
              {" "}
              et {signalement.signalements - 1} autre
              {signalement.signalements > 2 ? "s" : ""}
            </>
          ) : null}
        </dd>

        <dt className="font-semibold">État du message</dt>
        <dd className="m-0">
          {signalement.masque ? "Masqué — la classe ne le voit plus" : "Visible par la classe"}
        </dd>
      </dl>

      {clos && etat.etat === "vierge" ? (
        <p className="m-0 mt-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Ce signalement est clos. Une décision passée se relit dans le journal
          d&apos;audit, avec son motif.
        </p>
      ) : null}

      <form action={decider} className="mt-5">
        <input type="hidden" name="signalement" value={signalement.id} />

        <label htmlFor={champMotif} className="etiquette">
          Ce qui motive votre décision
        </label>
        <textarea
          id={champMotif}
          name="justification"
          rows={2}
          minLength={10}
          maxLength={2000}
          required
          data-testid="signalement-motif"
          className="champ mt-1"
          placeholder="Propos visant nommément un autre élève ; la vie scolaire est prévenue."
        />
        <span className="aide-champ">
          Conservée avec la décision. C&apos;est ce qui permet d&apos;y répondre
          trois semaines plus tard.
        </span>

        <div className="mt-4 flex flex-wrap gap-3">
          {signalement.masque ? (
            <Bouton
              decision="restaurer"
              libelle="Rétablir le message"
              marque="signalement-restaurer"
            />
          ) : (
            <Bouton decision="masquer" libelle="Masquer le message" marque="signalement-masquer" />
          )}
          <Bouton
            decision="classer_sans_suite"
            libelle="Classer sans suite"
            marque="signalement-classer"
            secondaire
          />
        </div>

        {etat.etat !== "vierge" ? (
          <p
            role="status"
            aria-live="polite"
            data-testid="signalement-message"
            className={`m-0 mt-3 text-[length:var(--text-aide)] ${
              etat.etat === "erreur"
                ? "text-[color:var(--color-erreur)]"
                : "text-[color:var(--color-encre-faible)]"
            }`}
          >
            {etat.message}
          </p>
        ) : null}
      </form>
    </article>
  );
}

function Bouton({
  decision,
  libelle,
  marque,
  secondaire = false,
}: {
  decision: string;
  libelle: string;
  marque: string;
  secondaire?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      data-testid={marque}
      disabled={pending}
      className={`bouton bouton-compact ${secondaire ? "bouton-secondaire" : "bouton-primaire"}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}

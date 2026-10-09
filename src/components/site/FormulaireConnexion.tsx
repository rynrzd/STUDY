"use client";

import Link from "next/link";
import m from "@/components/study/connexion/connexion-mobile.module.css";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { seConnecter } from "@/app/connexion/actions";
import { ETAT_INITIAL, type EtatConnexion } from "@/app/connexion/etats";

/**
 * Formulaire de connexion — étape 2, l'établissement est connu.
 *
 * Deux sortes de messages, à ne jamais confondre :
 * - **ce qui manque** se dit précisément, sous le champ, sans envoi ;
 * - **ce qui est faux** se dit toujours de la même façon, que le compte
 *   existe ou non (non-divulgation).
 *
 * Les autres refus ont chacun leur message : réseau (la requête n'est pas
 * partie), service indisponible, limitation des tentatives (avec le délai).
 *
 * L'identifiant est conservé après un refus. Le mot de passe n'est jamais
 * renvoyé par le serveur ; il est gardé dans le champ après une erreur de
 * réseau ou de service (on réessaie le même), et effacé — en le disant —
 * après « identifiant ou mot de passe incorrect ». Il n'est jamais modifié :
 * ni rognage, ni changement de casse. Collage et gestionnaires de mots de
 * passe fonctionnent (attributs `autocomplete`, aucun blocage du collage).
 */

type Champ = "identifiant" | "motDePasse";
const MANQUE: Record<Champ, string> = { identifiant: "Indique ton identifiant.", motDePasse: "Indique ton mot de passe." };

export function FormulaireConnexion({ suite = null, code = null, mobileDesign = false }: { suite?: string | null; code?: string | null; mobileDesign?: boolean }) {
  const [etat, action] = useActionState<EtatConnexion, FormData>(async (precedent, donnees) => {
    const identifiant = String(donnees.get("identifiant") ?? "").slice(0, 40);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { etat: "refus", type: "reseau", message: "Pas de connexion internet. Ta saisie est gardée : réessaie quand le réseau revient.", saisie: { identifiant } };
    }
    try {
      return await seConnecter(precedent, donnees);
    } catch (e) {
      // Une redirection réussie n'arrive pas ici ; une requête qui n'a pas pu partir, si.
      if (e instanceof TypeError) {
        return { etat: "refus", type: "reseau", message: "La requête n'a pas abouti : connexion internet interrompue. Réessaie.", saisie: { identifiant } };
      }
      throw e;
    }
  }, ETAT_INITIAL);
  const [motDePasse, setMotDePasse] = useState("");
  const [visible, setVisible] = useState(false);
  const [manquants, setManquants] = useState<Partial<Record<Champ, string>>>({});
  const [efface, setEfface] = useState(false);
  const alerte = useRef<HTMLDivElement>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [vu, setVu] = useState(etat);

  // Réaction à un nouveau résultat du serveur (pendant le rendu, pas dans un effet).
  if (vu !== etat) {
    setVu(etat);
    if (etat.etat === "refus" && etat.type === "identifiants") {
      setMotDePasse("");
      setEfface(true);
    } else {
      setEfface(false);
    }
    setManquants(etat.champs ?? {});
  }

  /**
   * Focus sur un champ en erreur, centré dans la zone visible : avec le
   * clavier ouvert, le champ, son message et le bouton restent ensemble.
   */
  function focaliser(id: Champ) {
    const champ = formulaire.current?.querySelector<HTMLInputElement>(`#${id}`);
    if (!champ) return;
    champ.focus({ preventScroll: true });
    champ.scrollIntoView({ block: "center" });
  }

  useEffect(() => {
    if (etat.etat !== "refus") return;
    if (etat.type === "saisie") {
      const premier = (["identifiant", "motDePasse"] as const).find((c) => etat.champs?.[c]);
      if (premier) focaliser(premier);
    } else if (etat.type === "identifiants") {
      focaliser("motDePasse");
    } else {
      alerte.current?.focus();
    }
  }, [etat]);

  function verifier(e: React.FormEvent<HTMLFormElement>) {
    const d = new FormData(e.currentTarget);
    const vides: Partial<Record<Champ, string>> = {};
    if (String(d.get("identifiant") ?? "").trim() === "") vides.identifiant = MANQUE.identifiant;
    if (String(d.get("motDePasse") ?? "") === "") vides.motDePasse = MANQUE.motDePasse;
    setManquants(vides);
    setEfface(false);
    const premier = (["identifiant", "motDePasse"] as const).find((c) => vides[c]);
    if (premier) {
      // Aucune requête ne part : la limitation des tentatives n'est pas consommée.
      e.preventDefault();
      focaliser(premier);
    }
  }

  const general = etat.etat === "refus" && etat.type !== "saisie" && etat.type !== "identifiants" ? etat : null;
  const refusIdentifiants = etat.etat === "refus" && etat.type === "identifiants" ? etat.message : null;
  const decrit = (champ: Champ, aide?: string) => {
    const ids = [aide, manquants[champ] ? `erreur-${champ}` : null, champ === "motDePasse" && refusIdentifiants ? "erreur-connexion" : null].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  };

  return (
    <form ref={formulaire} action={action} onSubmit={verifier} noValidate>
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}
      {code ? <input type="hidden" name="code" value={code} /> : null}

      {general ? (
        <div
          ref={alerte}
          tabIndex={-1}
          role="alert"
          data-type={general.type}
          className="mb-5 rounded-[12px] border border-[color:var(--color-attention)] bg-[color:var(--color-attention-fond)] p-4 text-[color:var(--color-attention)]"
        >
          <p className="m-0 font-semibold">{general.message}</p>
          {general.reprendreDansSecondes ? (
            <p className="m-0 mt-1 text-[0.875rem]">Nouvelle tentative possible dans {Math.ceil(general.reprendreDansSecondes / 60) > 1 ? `${Math.ceil(general.reprendreDansSecondes / 60)} minutes` : `${general.reprendreDansSecondes} secondes`}.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5">
        <div>
          <label className="etiquette" htmlFor="identifiant">
            Identifiant
          </label>
          <input
            className="champ champ-acces"
            id="identifiant"
            name="identifiant"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            defaultValue={etat.saisie?.identifiant ?? ""}
            required
            aria-invalid={manquants.identifiant || refusIdentifiants ? true : undefined}
            aria-describedby={decrit("identifiant", "aide-identifiant")}
          />
          {manquants.identifiant ? (
            <p id="erreur-identifiant" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
              {manquants.identifiant}
            </p>
          ) : null}
          <p id="aide-identifiant" className="aide-champ m-0">
            Celui de ta fiche de connexion, par exemple <span className="font-mono">camille.martin</span>.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label className="etiquette" htmlFor="motDePasse">
              Mot de passe
            </label>
            <Link href="/acces-oublie" className={`text-[0.875rem] font-semibold text-[color:var(--color-accent)] ${mobileDesign ? m.desktop : ""}`}>
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <input
              className="champ champ-acces pr-[6rem]"
              id="motDePasse"
              name="motDePasse"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={200}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              aria-invalid={manquants.motDePasse || refusIdentifiants ? true : undefined}
              aria-describedby={decrit("motDePasse")}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              aria-controls="motDePasse"
              className="absolute inset-y-0 right-0 flex min-w-[5.5rem] items-center justify-center px-3 text-[0.875rem] font-semibold text-[color:var(--color-accent)]"
            >
              {visible ? "Masquer" : "Afficher"}
            </button>
          </div>
          {manquants.motDePasse ? (
            <p id="erreur-motDePasse" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
              {manquants.motDePasse}
            </p>
          ) : null}
          {refusIdentifiants ? (
            <p id="erreur-connexion" role="alert" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]" data-type="identifiants">
              {refusIdentifiants}
              {efface ? " Le mot de passe a été effacé." : ""}
            </p>
          ) : null}
        </div>

        <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-[12px] border border-[color:var(--color-bordure)] px-4 py-3">
          <input type="checkbox" name="postePartage" value="oui" className="mt-1 size-5 shrink-0 accent-[color:var(--color-accent)]" aria-describedby="aide-poste-partage" />
          <span>
            <span className="block font-semibold"><span className={mobileDesign ? m.desktop : undefined}>Appareil partagé</span>{mobileDesign ? <span className={m.mobile}>J’utilise un appareil partagé</span> : null}</span>
            <span id="aide-poste-partage" className="aide-champ m-0 mt-0.5">
              <span className={mobileDesign ? m.desktop : undefined}>Pour un ordinateur du lycée ou utilisé par plusieurs personnes. La session se ferme à la fermeture du navigateur
              ou après 30 minutes sans activité, et ton établissement n&apos;est pas mémorisé.</span>
              {mobileDesign ? <span className={m.mobile}>Sur un ordinateur du lycée, par exemple. L’établissement ne sera pas mémorisé.</span> : null}
            </span>
          </span>
        </label>
      </div>

      <BoutonConnexion />
    </form>
  );
}

function BoutonConnexion() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-testid="connexion-valider" disabled={pending} aria-disabled={pending} className="bouton bouton-primaire bouton-acces mt-6 w-full">
      {pending ? (
        <>
          {/* Indicateur simple, sans fausse progression. Le bouton reste désactivé : pas de double envoi. */}
          <Loader2 size={18} strokeWidth={2} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          Connexion…
        </>
      ) : (
        "Se connecter"
      )}
    </button>
  );
}

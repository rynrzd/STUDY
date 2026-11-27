"use client";

import { useActionState, useEffect } from "react";
import { Check, MailCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { confirmerAdresse, confirmerCodeProfesseur, envoyerLienProfesseur, reinitialiserProfesseur } from "./actions";
import { ETAT_INSCRIPTION_PROFESSEUR } from "./etats";
import { CodeConfirmation } from "@/components/study/connexion/CodeConfirmation";
import styles from "./verification-courriel.module.css";

const DESTINATION_PROFESSEUR = "/professeur?bienvenue=1";

function AdresseConfirmee() {
  const routeur = useRouter();
  useEffect(() => {
    // On laisse le temps de voir le vrai succès renvoyé par Supabase. Le lien
    // reste utilisable si la navigation automatique est interrompue.
    const prefereReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.querySelector('[data-effets="reduits"], [data-effets="desactives"]') !== null;
    const minuterie = window.setTimeout(() => routeur.replace(DESTINATION_PROFESSEUR), prefereReduit ? 100 : 1150);
    return () => window.clearTimeout(minuterie);
  }, [routeur]);

  return (
    <section className={`${styles.carte} ${styles.carteReussie}`} aria-labelledby="confirmation-reussie-titre">
      <div className={styles.succesVisuel} aria-hidden="true">
        <span className={styles.halo} />
        <span className={styles.paillette} /><span className={styles.paillette} />
        <span className={styles.paillette} /><span className={styles.paillette} />
        <span className={styles.paillette} /><span className={styles.paillette} />
        <span className={styles.medaille}><Check size={40} strokeWidth={2.5} /></span>
      </div>
      <p className={styles.surtitre}><Sparkles size={15} aria-hidden="true" /> C&apos;est validé !</p>
      <h2 id="confirmation-reussie-titre" className={styles.titreReussi}>Ton adresse est confirmée !</h2>
      <p className={styles.texteReussi} role="status">Bienvenue chez AvecStudy. Ton espace professeur s&apos;ouvre…</p>
      <a className={`bouton bouton-primaire ${styles.accesDirect}`} href={DESTINATION_PROFESSEUR}>Entrer dans mon espace</a>
    </section>
  );
}

export function DemandeLien({ mode, adresse }: { mode: "confirmation" | "recuperation"; adresse?: string }) {
  const [etat, action, attente] = useActionState(envoyerLienProfesseur.bind(null, mode), ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <form action={action} className="mt-4 grid gap-3">
      <label className="etiquette">Adresse e-mail du compte
        <input className="champ champ-acces mt-1" name="email" type="email" autoComplete="email" defaultValue={adresse} required maxLength={180} />
      </label>
      <button className="bouton bouton-secondaire" disabled={attente}>
        {attente ? "Envoi demandé…" : mode === "confirmation" ? "Renvoyer un code" : "Demander un lien de récupération"}
      </button>
      {etat.message ? <p role={etat.etat === "refus" ? "alert" : "status"} className="m-0">{etat.message}</p> : null}
    </form>
  );
}

export function UtiliserCode({ adresse }: { adresse?: string }) {
  const [etat, action, attente] = useActionState(confirmerCodeProfesseur, ETAT_INSCRIPTION_PROFESSEUR);
  if (etat.etat === "confirmee") return <AdresseConfirmee />;

  return (
    <section aria-labelledby="confirmation-code-titre" className={styles.carte} data-attente={attente || undefined}>
      <span className={styles.iconeCourriel} aria-hidden="true"><MailCheck size={22} strokeWidth={1.8} /></span>
      <p className={styles.surtitre}>Plus qu&apos;une petite étape</p>
      <h2 id="confirmation-code-titre" className={styles.titre}>Vérifie ton adresse.</h2>
      <p className={styles.introduction}>Recopie les 6 chiffres du mail AvecStudy. Après ça, ton espace est à toi !</p>
      <form action={action} className="mt-4 grid gap-4">
        <label className="etiquette" htmlFor="confirmation-code-email">Adresse e-mail du compte</label>
        <input id="confirmation-code-email" className="champ champ-acces -mt-3" name="email" type="email" autoComplete="email" defaultValue={adresse} maxLength={180} required />
        <label className="etiquette" htmlFor="confirmation-code-valeur">Code à 6 chiffres</label>
        <div className={styles.cadreCode}>
          <CodeConfirmation id="confirmation-code-valeur" invalide={etat.etat === "refus"} attente={attente} />
          {attente ? (
            <div className={styles.cinematique} aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <span key={index} className={styles.fragment} />)}
              <span className={styles.noyau}><MailCheck size={22} strokeWidth={1.8} /></span>
            </div>
          ) : null}
        </div>
        {attente ? <p className={styles.messageAttente} role="status">On vérifie ton code en toute sécurité<span className={styles.pointsAttente} aria-hidden="true">…</span></p> : null}
        {etat.message ? <p role="alert" className="m-0 text-sm text-[color:var(--color-erreur)]">{etat.message}</p> : null}
        <button className={`bouton bouton-primaire w-full ${styles.boutonValidation}`} disabled={attente}>
          {attente ? "Un instant, ça arrive…" : "Confirmer mon adresse"}
        </button>
      </form>
    </section>
  );
}

export function UtiliserLien({ mode, jeton }: { mode: "confirmation" | "recuperation"; jeton: string }) {
  const serveur = mode === "confirmation" ? confirmerAdresse.bind(null, jeton) : reinitialiserProfesseur.bind(null, jeton);
  const [etat, action, attente] = useActionState(serveur, ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <form action={action} className="grid gap-4">
      {mode === "recuperation" ? (
        <>
          <label className="etiquette">Nouveau mot de passe
            <input className="champ champ-acces mt-1" name="motDePasse" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
          </label>
          <label className="etiquette">Confirmer le nouveau mot de passe
            <input className="champ champ-acces mt-1" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
          </label>
        </>
      ) : null}
      {etat.message ? <p role="alert" className="m-0">{etat.message}</p> : null}
      <button className="bouton bouton-primaire" disabled={attente}>
        {attente ? "Vérification…" : mode === "confirmation" ? "Confirmer mon adresse" : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}

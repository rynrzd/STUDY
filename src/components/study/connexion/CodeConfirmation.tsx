"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { normaliserSaisieCode } from "@/lib/saisie-code";
import styles from "./code-confirmation.module.css";

/** Un vrai champ de formulaire (compatible avec l'autoremplissage iOS) et six repères visuels. */
export function CodeConfirmation({ id, invalide, attente, autoFocus = false }: { id: string; invalide: boolean; attente: boolean; autoFocus?: boolean }) {
  const [code, setCode] = useState("");
  const champ = useRef<HTMLInputElement>(null);
  const complet = code.length === 6;

  function coller(evenement: ClipboardEvent<HTMLInputElement>) {
    const texte = evenement.clipboardData.getData("text");
    if (!texte) return;
    evenement.preventDefault();
    setCode(normaliserSaisieCode(texte));
  }

  return (
    <div className={styles.groupe}>
      <div className={styles.controle}>
        <input
          ref={champ}
          id={id}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          value={code}
          onChange={(evenement) => setCode(normaliserSaisieCode(evenement.target.value))}
          onPaste={coller}
          className={styles.champ}
          required
          disabled={attente}
          aria-invalid={invalide || undefined}
          aria-describedby={`${id}-aide`}
        />
        <div className={styles.cases} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => {
            const chiffre = code[index];
            return (
              <span
                key={index}
                className={styles.case}
                data-remplie={chiffre ? "oui" : undefined}
                data-active={index === code.length && !complet ? "oui" : undefined}
                data-erreur={invalide ? "oui" : undefined}
              >
                {chiffre ? <span key={chiffre} className={styles.chiffre}>{chiffre}</span> : <span className={styles.point}>·</span>}
              </span>
            );
          })}
        </div>
      </div>
      <p id={`${id}-aide`} className={styles.aide} role="status">
        {complet ? "Les 6 chiffres sont saisis. Tu peux vérifier ton code." : "Tu peux saisir ou coller les 6 chiffres."}
      </p>
    </div>
  );
}

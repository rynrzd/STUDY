"use client";

import { useState } from "react";

/**
 * Avant / après du Studio — L05.
 *
 * Le même extrait de cours, à gauche tel qu'il sort d'un PDF, à droite mis en
 * page. C'est exactement ce que fait le Studio, et c'est une démonstration
 * honnête : le texte est identique des deux côtés, mot pour mot. Rien n'est
 * résumé, rien n'est ajouté — si la colonne de droite disait autre chose que
 * celle de gauche, la vitrine mentirait sur le produit.
 *
 * L'extrait est fixe et fourni ici : aucun fichier visiteur n'est téléversé,
 * aucun traitement n'est déclenché au chargement ni au défilement.
 */
export function AvantApres() {
  const [apres, setApres] = useState(true);

  return (
    <div>
      {/* Le même motif que les onglets de la section précédente : un trait sous
          le choix actif. Un sélecteur noir à pastille n'existe nulle part
          ailleurs sur cette page, et c'est ce qui donne l'impression d'un bloc
          rapporté d'ailleurs. */}
      <div
        role="group"
        aria-label="Comparer avant et après la mise en page"
        className="flex gap-1 border-b border-[color:var(--color-bordure)]"
      >
        {[
          { cle: false, libelle: "Le document importé" },
          { cle: true, libelle: "Après mise en page" },
        ].map((choix) => (
          <button
            key={String(choix.cle)}
            type="button"
            aria-pressed={apres === choix.cle}
            onClick={() => setApres(choix.cle)}
            className={`-mb-px min-h-[var(--spacing-cible)] shrink-0 whitespace-nowrap border-b-2 px-4 text-[length:var(--text-tableau)] transition-colors duration-[160ms] ${
              apres === choix.cle
                ? "border-[color:var(--color-encre)] font-semibold text-[color:var(--color-encre)]"
                : "border-transparent text-[color:var(--color-encre-faible)]"
            }`}
          >
            {choix.libelle}
          </button>
        ))}
      </div>

      <div className="mt-5 grid">
        <div
          hidden={apres}
          className="col-start-1 row-start-1 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-6"
        >
          <pre className="m-0 overflow-x-auto whitespace-pre-wrap font-mono text-[0.75rem] leading-relaxed text-[color:var(--color-encre-faible)]">
{`Les fonctions affines
Définition
Une fonction affine s'écrit f(x) = ax + b.
Exemple
f(x) = 2x + 3
Pour x = 4 : f(4) = 11.
À vous de jouer
Calculer f(2), puis f(5).`}
          </pre>
        </div>

        <article
          hidden={!apres}
          className="col-start-1 row-start-1 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-flottant)]"
        >
          <h3 className="m-0 font-[family-name:var(--font-marque)] text-[1.5rem] font-bold">
            Les fonctions affines
          </h3>
          <div className="mt-4 h-px bg-[color:var(--color-rose-decor)]" />

          <div className="mt-4 rounded-[var(--radius-champ)] bg-[color:var(--color-rose-clair)] p-4">
            <p className="m-0 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-accent)]">
              Définition
            </p>
            <p className="m-0 mt-1.5 font-[family-name:var(--font-marque)] text-[length:var(--text-corps)]">
              Une fonction affine s&apos;écrit <em>f</em>(x) = ax + b.
            </p>
          </div>

          <p className="m-0 mt-5 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
            Exemple
          </p>
          <p className="m-0 mt-1.5 font-[family-name:var(--font-marque)] text-[length:var(--text-corps)]">
            <em>f</em>(x) = 2x + 3
            <br />
            Pour x = 4 : <em>f</em>(4) = 11.
          </p>

          <p className="m-0 mt-5 font-[family-name:var(--font-marque)] text-[1.0625rem] font-bold">
            À vous de jouer
          </p>
          <div className="mt-1 h-px w-24 bg-[color:var(--color-rose-decor)]" />
          <p className="m-0 mt-2 font-[family-name:var(--font-marque)] text-[length:var(--text-corps)]">
            Calculer <em>f</em>(2), puis <em>f</em>(5).
          </p>
        </article>
      </div>

      <p className="m-0 mt-4 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
        Le texte est identique des deux côtés. Seule la présentation change :
        rien n&apos;est résumé, rien n&apos;est ajouté.
      </p>
    </div>
  );
}

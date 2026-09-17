"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MARQUE } from "@/lib/identite-legale";

/**
 * La fiche d'accès telle qu'elle sort de l'imprimante.
 *
 * Un document à part, invisible à l'écran, et le seul visible à l'impression —
 * voir les règles `@media print` de la feuille de style. Ce n'est pas une
 * version « allégée » de la carte affichée : c'est une feuille A4 conçue pour
 * être pliée et remise en main propre à un élève.
 *
 * Ce qu'elle porte, et rien d'autre : la marque, le nom, la classe,
 * l'identifiant, le mot de passe temporaire, et les deux phrases qui disent
 * quoi faire. Pas de menu, pas de tableau des comptes, pas de bouton. Une
 * fiche d'accès qui emporterait la liste des comptes du lycée serait une fuite
 * distribuée à la main.
 *
 * Le mot de passe est écrit en gros, en chasse fixe : il sera recopié sur un
 * clavier par quelqu'un qui ne l'a jamais vu, et « l » contre « 1 » se joue à
 * la forme de la lettre.
 *
 * La feuille est rendue **dans `<body>` par un portail**. C'est ce qui permet
 * à la règle d'impression de masquer tout le reste d'un seul trait — « tous
 * les enfants de body sauf les fiches » — et, quand il y en a plusieurs, de
 * les enchaîner une par page. Posées au milieu de la page d'administration,
 * elles auraient hérité de sa mise en page et se seraient superposées.
 */
export function FicheImprimable({
  prenom,
  nom,
  role,
  classe,
  login,
  motDePasse,
}: {
  prenom: string;
  nom: string;
  role: string;
  classe: string | null;
  login: string;
  motDePasse: string;
}) {
  // Le portail suppose un document : il n'existe qu'une fois l'hydratation
  // faite. `useSyncExternalStore` distingue serveur et navigateur sans passer
  // par un état recopié depuis un effet, qui provoquerait un rendu en cascade.
  // Rien n'est rendu côté serveur — imprimer suppose de toute façon un
  // navigateur.
  const dansLeNavigateur = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!dansLeNavigateur) return null;

  return createPortal(
    <section className="fiche-impression" aria-hidden="true">
      <div style={{ fontFamily: "var(--font-texte)", color: "#000" }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-marque)",
            fontWeight: 700,
            fontSize: "20pt",
            letterSpacing: "-0.015em",
          }}
        >
          {MARQUE}.
        </p>

        <p style={{ margin: "2mm 0 0", fontSize: "10pt", color: "#444" }}>
          Fiche d&apos;accès personnelle — à conserver
        </p>

        <div style={{ height: "1px", background: "#000", margin: "6mm 0 0" }} />

        {/* L'identité, en tête : c'est ce qui permet de distribuer les fiches
            sans les ouvrir une par une. */}
        <p style={{ margin: "8mm 0 0", fontSize: "22pt", fontWeight: 700, lineHeight: 1.15 }}>
          {prenom} {nom.toUpperCase()}
        </p>
        <p style={{ margin: "2mm 0 0", fontSize: "12pt", color: "#444" }}>
          {role}
          {classe === null ? "" : ` · ${classe}`}
        </p>

        {/* Les deux valeurs à recopier. Grandes, en chasse fixe, espacées. */}
        <dl style={{ margin: "12mm 0 0" }}>
          <dt style={{ margin: 0, fontSize: "9pt", letterSpacing: "0.08em", color: "#444" }}>
            IDENTIFIANT
          </dt>
          <dd
            style={{
              margin: "1.5mm 0 0",
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
              fontSize: "17pt",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {login}
          </dd>

          <dt
            style={{
              margin: "9mm 0 0",
              fontSize: "9pt",
              letterSpacing: "0.08em",
              color: "#444",
            }}
          >
            MOT DE PASSE TEMPORAIRE
          </dt>
          <dd
            style={{
              margin: "1.5mm 0 0",
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
              fontSize: "17pt",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {motDePasse}
          </dd>
        </dl>

        <div
          style={{
            margin: "14mm 0 0",
            padding: "6mm",
            border: "1px solid #000",
            borderRadius: "2mm",
          }}
        >
          <p style={{ margin: 0, fontSize: "12pt", lineHeight: 1.5 }}>
            Rendez-vous sur <strong>avecstudy.fr</strong> pour vous connecter.
          </p>
          <p style={{ margin: "3mm 0 0", fontSize: "12pt", lineHeight: 1.5 }}>
            Changez votre mot de passe lors de votre première connexion.
          </p>
        </div>

        <p style={{ margin: "10mm 0 0", fontSize: "9pt", color: "#666", lineHeight: 1.5 }}>
          Ce mot de passe est provisoire et ne vous sera pas redemandé.
          Ne communiquez vos identifiants à personne.
        </p>
      </div>
    </section>,
    document.body,
  );
}

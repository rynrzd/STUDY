import { createElement, type ReactNode } from "react";
import { decouperFormules } from "@/lib/formules";
import { formuleEnArbre, type Noeud } from "@/lib/mathml";

/**
 * Formules dans le texte d'une séance — cahier des charges ch. 11 (EDIT-04).
 *
 * Le texte est conservé tel que le professeur l'a écrit, en LaTeX : rien n'est
 * converti en base. À l'affichage, `$x^2$` devient une formule dans la ligne
 * et `$$\frac{a}{b}$$` une formule centrée, en MathML natif : le navigateur la
 * dessine, un lecteur d'écran la lit. Aucun HTML brut n'est injecté : l'arbre
 * vient de `lireMathml`, qui n'accepte qu'une liste fermée de balises.
 *
 * Une formule fausse reste affichée telle qu'écrite, en police à chasse fixe —
 * jamais une approximation qui changerait son sens.
 */
export function TexteAvecFormules({ texte }: { texte: string }) {
  return (
    <>
      {decouperFormules(texte).map((m, i) => {
        if (m.type === "texte") return <span key={i}>{m.valeur}</span>;
        const arbre = formuleEnArbre(m.tex, m.bloc);
        if (arbre === null) {
          return (
            <code key={i} className="formule-brute" title="Formule non reconnue : affichée telle qu'écrite">
              {m.source}
            </code>
          );
        }
        return (
          <span key={i} className={m.bloc ? "formule formule-bloc" : "formule"}>
            {versReact(arbre, "f")}
          </span>
        );
      })}
    </>
  );
}

function versReact(noeud: Noeud, cle: string): ReactNode {
  return createElement(
    noeud.balise,
    { key: cle, ...noeud.attributs },
    ...noeud.enfants.map((e, i) => (typeof e === "string" ? e : versReact(e, `${cle}-${i}`))),
  );
}

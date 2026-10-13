import { analyserTexteRiche } from "@/lib/texte-riche";
import { TexteAvecFormules } from "./TexteAvecFormules";

/**
 * Bloc texte mis en forme — cahier des charges ch. 11 (EDIT-01) : titres,
 * listes, encadrés et tableaux écrits en texte simple, formules comprises.
 * Le texte enregistré ne change pas ; seule sa présentation se construit ici.
 */
export function TexteRiche({ texte }: { texte: string }) {
  const blocs = analyserTexteRiche(texte);
  return (
    <div className="texte-riche max-w-[var(--spacing-lecture)] space-y-3">
      {blocs.map((b, i) => {
        if (b.type === "titre") {
          const Balise = b.niveau === 2 ? "h2" : "h3";
          return (
            <Balise key={i} className={b.niveau === 2 ? "m-0 text-[1.25rem] font-bold" : "m-0 text-[1.0625rem] font-bold"}>
              <TexteAvecFormules texte={b.texte} />
            </Balise>
          );
        }
        if (b.type === "liste") {
          const Liste = b.numerotee ? "ol" : "ul";
          return (
            <Liste key={i} className={`m-0 space-y-1 pl-6 ${b.numerotee ? "list-decimal" : "list-disc"}`}>
              {b.elements.map((e, j) => (
                <li key={j}>
                  <TexteAvecFormules texte={e} />
                </li>
              ))}
            </Liste>
          );
        }
        if (b.type === "encadre") {
          return (
            <aside key={i} className="encadre-seance whitespace-pre-line">
              <TexteAvecFormules texte={b.texte} />
            </aside>
          );
        }
        if (b.type === "tableau") {
          return (
            <div key={i} className="tableau-seance">
              <table>
                {b.entete.length > 0 ? (
                  <thead>
                    <tr>
                      {b.entete.map((c, j) => (
                        <th key={j} scope="col">
                          <TexteAvecFormules texte={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {b.lignes.map((l, j) => (
                    <tr key={j}>
                      {l.map((c, k) => (
                        <td key={k}>
                          <TexteAvecFormules texte={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="m-0 whitespace-pre-line">
            <TexteAvecFormules texte={b.texte} />
          </p>
        );
      })}
    </div>
  );
}

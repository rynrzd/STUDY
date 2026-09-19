/**
 * Recherche et filtre par classe — cahier V5, §9.
 *
 * Un formulaire en `GET`, sans une ligne de JavaScript. Trois raisons, et
 * aucune n'est théorique : la recherche survit au rechargement, l'adresse
 * obtenue s'envoie à un collègue, et l'écran fonctionne le jour où le script
 * ne charge pas — ce qui, dans un lycée, arrive.
 *
 * Le filtre par rôle reste en liens à côté : il se combine à la recherche,
 * et les deux s'écrivent dans la même adresse.
 */
export function RechercheComptes({
  valeur,
  etat,
  classe,
  classes,
}: {
  valeur: string;
  etat: string;
  classe: string;
  classes: readonly string[];
}) {
  return (
    <form
      action="/admin/utilisateurs"
      method="get"
      className="flex flex-wrap items-end gap-3"
    >
      {etat === "" ? null : <input type="hidden" name="etat" value={etat} />}

      <div className="min-w-[12rem] flex-1">
        <label className="etiquette" htmlFor="recherche-comptes">
          Rechercher
        </label>
        <input
          id="recherche-comptes"
          name="q"
          type="search"
          defaultValue={valeur}
          placeholder="Nom, prénom ou identifiant"
          className="champ"
        />
      </div>

      <div className="min-w-[9rem]">
        <label className="etiquette" htmlFor="filtre-classe">
          Classe
        </label>
        <select id="filtre-classe" name="classe" defaultValue={classe} className="champ">
          <option value="">Toutes</option>
          {classes.map((libelle) => (
            <option key={libelle} value={libelle}>
              {libelle}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="bouton bouton-secondaire">
        Filtrer
      </button>

      {valeur === "" && classe === "" ? null : (
        <a
          href={etat === "" ? "/admin/utilisateurs" : `/admin/utilisateurs?etat=${etat}`}
          className="pb-2.5 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)] underline underline-offset-2"
        >
          Tout afficher
        </a>
      )}
    </form>
  );
}

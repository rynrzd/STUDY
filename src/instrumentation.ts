/**
 * Vérification au démarrage — chapitre 40.
 *
 * « L'application doit échouer proprement au démarrage si une clé requise
 * manque. » Ce point d'entrée est appelé une fois, avant de servir la première
 * requête.
 *
 * Deux comportements distincts, volontairement :
 *  - en production et en recette, une configuration incomplète **arrête** le
 *    démarrage. Un service à moitié configuré qui accepte des élèves est pire
 *    qu'un service absent ;
 *  - en développement, on signale sans bloquer, pour pouvoir travailler sur le
 *    site public sans avoir encore de projet de base de données.
 *
 * Aucune valeur de configuration n'est jamais journalisée.
 */
export async function register() {
  // Ce module n'a de sens que côté serveur Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { diagnostiquer, verifierAuDemarrage, ConfigurationInvalide } = await import("./lib/config");

  try {
    verifierAuDemarrage(process.env);
  } catch (erreur) {
    if (erreur instanceof ConfigurationInvalide && process.env.APP_ENV === "developpement") {
      console.warn(`[AvecStudy] ${erreur.message}`);
      return;
    }
    throw erreur;
  }

  // Journal de démarrage : des états, jamais des valeurs.
  const etat = diagnostiquer(process.env);
  const incomplets = etat.groupes.filter((groupe) => !groupe.complet);

  console.log(
    `[AvecStudy] demarrage — environnement ${etat.environnement}, ` +
      `${etat.groupes.length - incomplets.length}/${etat.groupes.length} groupes configures`,
  );

  if (incomplets.length > 0) {
    console.log(
      `[AvecStudy] fonctions indisponibles faute de configuration : ` +
        incomplets.map((groupe) => groupe.libelle).join(", "),
    );
  }
}

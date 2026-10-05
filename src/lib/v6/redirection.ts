/**
 * Reprise du parcours après connexion — dossier Study V6, §6.1 et AUTH-03.
 *
 * Le paramètre `suite` ne peut désigner qu'une route **interne** de
 * l'application connectée. Tout le reste est ignoré au profit de l'accueil :
 * une adresse absolue, un protocole, un double slash (« //site.example »
 * est une URL absolue pour un navigateur), une barre oblique inverse que
 * certains navigateurs normalisent en slash, un caractère de contrôle.
 *
 * Module pur : il se teste sans serveur.
 */

const PREFIXES_AUTORISES = ["/app", "/professeur", "/studio", "/admin", "/parametres", "/eleve", "/rejoindre"] as const;

export function suiteSure(brute: string | null | undefined): string | null {
  if (typeof brute !== "string") return null;
  const valeur = brute.trim();
  if (valeur.length === 0 || valeur.length > 512) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/u.test(valeur)) return null;
  if (/^\/[^/]*:/u.test(valeur)) return null;

  let chemin: URL;
  try {
    // Une base fictive : si l'URL résolue change d'origine, c'était externe.
    chemin = new URL(valeur, "https://interne.invalid");
  } catch {
    return null;
  }
  if (chemin.origin !== "https://interne.invalid") return null;

  const autorise = PREFIXES_AUTORISES.some(
    (prefixe) => chemin.pathname === prefixe || chemin.pathname.startsWith(`${prefixe}/`),
  );
  if (!autorise) return null;
  return `${chemin.pathname}${chemin.search}${chemin.hash}`;
}

/** L'adresse de connexion qui ramènera ici après authentification. */
export function versConnexion(chemin: string | null | undefined, motif?: "expiree"): string {
  const suite = suiteSure(chemin);
  const params = new URLSearchParams();
  if (suite !== null) params.set("suite", suite);
  if (motif !== undefined) params.set("motif", motif);
  const requete = params.toString();
  return requete === "" ? "/connexion" : `/connexion?${requete}`;
}

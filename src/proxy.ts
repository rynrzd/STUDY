import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { originesAutorisees } from "./lib/csrf.ts";

/**
 * Proxy (ex-middleware) — WEB-02 et WEB-03.
 *
 * Deux rôles, et deux seulement :
 *
 *  1. Poser une CSP à nonce, regénéré à chaque réponse.
 *  2. Refuser au plus tôt une mutation qui vient manifestement d'un autre site.
 *
 * Ce quil ne fait PAS, volontairement : autoriser. Ce filtre ne lit aucune
 * session et n'accorde aucun droit. Toute autorisation est décidée côté serveur,
 * au plus près de la donnée, par les politiques RLS et les contrôles d'objet
 * (ch. 02 : cacher un menu ne protège pas une ressource).
 */

const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

function nonce(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return btoa(String.fromCharCode(...octets));
}

/**
 * Les pages de vitrine rendues à l'avance.
 *
 * Une page prérendue est écrite une fois, au build : elle ne peut pas porter un
 * nonce régénéré à chaque requête, et Next l'a documenté — les nonces ne
 * s'appliquent qu'aux pages rendues à la demande. Pour ces pages-là, la
 * politique à nonce ne protège rien : elle empêche seulement le site de
 * fonctionner.
 *
 * D'où cette liste, et le raisonnement qui la justifie. Ce que la CSP arrête,
 * c'est l'exécution d'un script injecté. Pour qu'un script soit injecté, il
 * faut une entrée par laquelle l'injecter. Ces pages n'en ont aucune : elles
 * n'affichent que du texte écrit dans le dépôt, jamais une donnée venue d'un
 * élève, d'un professeur ou d'un fichier déposé. Tout ce qui rend du contenu
 * saisi par quelqu'un — le Studio, les séances, les questions d'entraide, les
 * noms importés, les noms de fichiers — vit dans l'application connectée, qui
 * est rendue à la demande et garde la politique stricte.
 *
 * La liste est **exacte**, jamais par préfixe : une future page privée sous un
 * chemin voisin ne doit pas hériter de la politique relâchée. Et une nouvelle
 * page de vitrine oubliée ici reçoit la politique stricte, donc casse
 * visiblement à la recette — c'est le bon sens de l'échec.
 */
const VITRINES_PRERENDUES = new Set([
  "/",
  "/accessibilite",
  "/aide",
  "/conditions",
  "/confidentialite",
  "/contact",
  "/maintenance",
  "/mentions-legales",
  "/mot-de-passe-oublie",
  "/offre",
  "/produit",
  "/securite",
]);

function politiqueCsp(valeurNonce: string | null, developpement: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    // Deux politiques, selon que la page peut porter un nonce ou non.
    //
    // Avec nonce : 'strict-dynamic' laisse les scripts chargés par un script à
    // nonce fonctionner, sans ouvrir une liste d'hôtes. C'est la politique
    // forte, et c'est celle de toute l'application connectée.
    //
    // Sans nonce : 'self' autorise les fichiers de l'application, et
    // 'unsafe-inline' l'amorce que Next écrit dans le HTML prérendu. Attention
    // au piège : dès qu'un nonce est présent, le navigateur **ignore**
    // 'unsafe-inline'. Les deux ne se combinent donc pas, il faut choisir.
    valeurNonce === null
      ? "script-src 'self' 'unsafe-inline'"
      : `script-src 'self' 'nonce-${valeurNonce}' 'strict-dynamic'`,
    // Next injecte des styles en ligne ; 'unsafe-inline' reste nécessaire ici.
    // C'est une limite connue, à réévaluer, pas un choix de confort : elle est
    // notée dans docs/02-modele-de-menace.md.
    "style-src 'self' 'unsafe-inline'",
    // Polices auto-hébergées uniquement (ch. 03).
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];

  if (!developpement) {
    directives.push("upgrade-insecure-requests");
  } else {
    // Le rechargement à chaud a besoin d'eval et d'un websocket local.
    directives[1] =
      valeurNonce === null
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : `script-src 'self' 'nonce-${valeurNonce}' 'strict-dynamic' 'unsafe-eval'`;
    directives[directives.indexOf("connect-src 'self'")] = "connect-src 'self' ws: wss:";
  }

  return directives.join("; ");
}

function origineAcceptable(requete: NextRequest): boolean {
  const site = requete.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;

  const origine = requete.headers.get("origin");
  if (origine === null) return true; // Le contrôle fin a lieu côté route.

  const acceptees = originesAutorisees(requete.nextUrl.origin);

  // Aucune origine déclarée : développement local, où APP_ORIGIN peut manquer.
  // En production elle est exigée au démarrage, ce cas n'y survient pas.
  if (acceptees.length === 0) return origine === requete.nextUrl.origin;

  return acceptees.includes(origine);
}

export default function proxy(requete: NextRequest) {
  const developpement = process.env.NODE_ENV !== "production";

  // Les webhooks sont authentifiés par signature : la logique CSRF navigateur
  // ne s'y applique pas (ch. 25).
  const estWebhook = requete.nextUrl.pathname.startsWith("/api/v1/webhooks/");

  // La file de travaux s'authentifie par CRON_SECRET, pas par cookie : elle
  // n'est jamais appelee depuis une page, et la verification d'origine n'a rien
  // a y verifier. Le controle du secret, lui, reste dans la route.
  const estFileDeTravaux = requete.nextUrl.pathname === "/api/v1/travaux";

  if (
    !estWebhook &&
    !estFileDeTravaux &&
    !METHODES_SANS_EFFET.has(requete.method) &&
    !origineAcceptable(requete)
  ) {
    // Réponse volontairement muette : pas de détail sur ce qui a échoué.
    return new NextResponse(
      JSON.stringify({ erreur: "requete_refusee" }),
      { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  // Une page prérendue ne peut pas porter de nonce : lui en promettre un dans
  // l'en-tête revient à bloquer tous ses scripts.
  const prerendue = VITRINES_PRERENDUES.has(requete.nextUrl.pathname);
  const valeurNonce = prerendue ? null : nonce();
  const politique = politiqueCsp(valeurNonce, developpement);

  const entetes = new Headers(requete.headers);
  if (valeurNonce !== null) entetes.set("x-study-nonce", valeurNonce);

  // C'est **cette ligne** qui fait que le site fonctionne.
  //
  // Next ne lit pas d'en-tête maison pour connaître le nonce : il relit la
  // directive `script-src` de l'en-tête `Content-Security-Policy` **de la
  // requête**, et y cherche `'nonce-…'`. C'est ce nonce qu'il recopie ensuite
  // sur chacune de ses balises `<script>`.
  //
  // Sans elle, aucun script ne portait de nonce. Avec `'strict-dynamic'`, le
  // mot-clé `'self'` est ignoré par le navigateur : plus un seul script de
  // l'application ne se chargeait en production. React ne s'hydratait jamais,
  // et tout ce qui demande du JavaScript — les onglets, le menu du téléphone,
  // la validation du formulaire de connexion, les boutons d'impression —
  // restait inerte, sans la moindre erreur visible côté serveur.
  entetes.set("Content-Security-Policy", politique);

  const reponse = NextResponse.next({ request: { headers: entetes } });
  reponse.headers.set("Content-Security-Policy", politique);
  if (valeurNonce !== null) reponse.headers.set("x-study-nonce", valeurNonce);
  return reponse;
}

export const config = {
  // Les fichiers statiques ne passent pas par ce filtre.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};

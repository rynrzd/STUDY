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

function politiqueCsp(valeurNonce: string, developpement: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic' laisse les scripts chargés par un script à nonce
    // fonctionner, sans ouvrir une liste d'hôtes.
    `script-src 'self' 'nonce-${valeurNonce}' 'strict-dynamic'`,
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
    directives[1] = `script-src 'self' 'nonce-${valeurNonce}' 'strict-dynamic' 'unsafe-eval'`;
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

  const valeurNonce = nonce();
  const entetes = new Headers(requete.headers);
  entetes.set("x-study-nonce", valeurNonce);

  const reponse = NextResponse.next({ request: { headers: entetes } });
  reponse.headers.set("Content-Security-Policy", politiqueCsp(valeurNonce, developpement));
  reponse.headers.set("x-study-nonce", valeurNonce);
  return reponse;
}

export const config = {
  // Les fichiers statiques ne passent pas par ce filtre.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};

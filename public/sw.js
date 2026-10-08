/* Cache public uniquement. Aucun HTML connecté, payload RSC ou réponse API.
 * Les copies choisies restent lisibles dans une page déjà ouverte. Une nouvelle
 * navigation hors réseau présente un message neutre, jamais une ancienne session.
 */
const CACHE = "study-statique-v2";
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith("study-") && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const copie = await cache.match(requete);
      if (copie) return copie;
      const reponse = await fetch(requete);
      if (reponse.ok && !reponse.redirected && reponse.type !== "opaque") {
        event.waitUntil(cache.put(requete, reponse.clone()));
      }
      return reponse;
    })());
    return;
  }
  // Ne pas remplacer connexion, activation et autres pages publiques par une
  // page de l'application. La réponse de secours ne comporte aucune identité.
  if (requete.mode === "navigate" && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) {
    event.respondWith(fetch(requete).catch(() => new Response(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Study — Hors ligne</title><main><h1>Connexion indisponible</h1><p>Pour protéger tes données, cette page ne conserve pas de copie de ta session.</p><p>Les copies de cours restent consultables dans un onglet Study déjà ouvert. Sinon, reconnecte-toi au réseau puis recharge cette page.</p><a href="/app/hors-ligne">Réessayer</a></main></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } },
    )));
  }
});

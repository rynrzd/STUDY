/*
 * Study — service worker « hors ligne borné » (dossier V6, §10).
 *
 * Il n'est enregistré que si la personne a autorisé les copies locales et
 * que l'appareil n'est pas déclaré partagé. Il ne met en cache que :
 *   - la page /app/hors-ligne (qui lit les copies choisies dans le stockage
 *     local) ;
 *   - les fichiers statiques versionnés de l'application (_next/static).
 * Aucune réponse d'API, aucun salon, aucune consultation, aucune donnée
 * d'un autre utilisateur n'est conservée ici. « Effacer cet appareil » le
 * désinscrit et vide son cache.
 */
const CACHE = "study-hors-ligne-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((c) => c.startsWith("study-") && c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const enCache = await cache.match(requete);
        if (enCache) return enCache;
        const reponse = await fetch(requete);
        if (reponse.ok) cache.put(requete, reponse.clone());
        return reponse;
      }),
    );
    return;
  }

  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          if (url.pathname === "/app/hors-ligne" && reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put("/app/hors-ligne", copie));
          }
          return reponse;
        })
        .catch(() => caches.match("/app/hors-ligne").then((r) => r || Response.error())),
    );
  }
});

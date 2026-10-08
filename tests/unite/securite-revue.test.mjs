import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exécute les vrais modules TS, seules les frontières I/O sont remplacées.
function charger(path, dependances) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (nom) => {
    if (!(nom in dependances)) throw new Error(`Dépendance inattendue : ${nom}`);
    return dependances[nom];
  }, Buffer, URL, console: { error() {} }, process });
  return exports;
}
function depotPour(error) {
  return charger('src/lib/depot-authentification.ts', {
    'server-only': {}, './chiffrement.ts': {}, './authentification.ts': {},
    './supabase-serveur.ts': { clientExploitation: () => ({ rpc: async () => ({ error }) }) },
  }).DepotSupabase;
}
test('une révocation refusée par la base remonte à l’appelant', async () => {
  const Depot = depotPour({ code: 'DB_UNAVAILABLE' });
  await assert.rejects(new Depot().revoquerSessions('test', 'test'), /révocation/);
  await assert.rejects(new Depot().revoquerSession(Buffer.alloc(32), 'test'), /révocation/);
});
for (const scenario of [
  { label: 'succès global', partout: true, error: null, personne: { profileId: 'test' }, fin: 'partout' },
  { label: 'panne globale', partout: true, error: { code: 'DB_UNAVAILABLE' }, personne: { profileId: 'test' }, fin: 'locale' },
  { label: 'session introuvable', partout: true, error: null, personne: null, fin: 'locale' },
  { label: 'panne révocation simple', partout: false, error: { code: 'DB_UNAVAILABLE' }, personne: null, fin: 'locale' },
  { label: 'succès simple', partout: false, error: null, personne: null, fin: '1' },
]) {
  test(`déconnexion : ${scenario.label}, suppression locale toujours effectuée`, async () => {
    const cookies = [];
    const { POST } = charger('src/app/deconnexion/route.ts', {
      'next/server': { NextResponse: { redirect: (url, status) => ({ url: String(url), status, cookies: { set: (...args) => cookies.push(args) }, headers: new Headers() }) } },
      '@/lib/depot-authentification': { DepotSupabase: depotPour(scenario.error) },
      '@/lib/session': { cookieSessionSupprime: () => ({ name: 'session', secure: true }), empreinteJeton: () => Buffer.alloc(32), NOM_COOKIE_SESSION: 'session' },
      '@/lib/session-serveur': { sessionCourante: async () => scenario.personne },
    });
    const response = await POST({ url: 'https://example.test/deconnexion', headers: new Headers({ cookie: 'session=opaque' }), formData: async () => new Map([['partout', scenario.partout ? 'oui' : 'non']]) });
    assert.equal(response.url, `https://example.test/connexion?fin=${scenario.fin}`);
    assert.equal(cookies[0][2].maxAge, 0);
    assert.equal(response.headers.get('Clear-Site-Data'), '"cache", "storage"');
  });
}
function worker() {
  const handlers = {}, stored = new Map([['study-hors-ligne-v1', new Map([['/app/hors-ligne', new Response('COMPTE A')]])], ['autre-app', new Map()]]);
  let offline = false, response, claimed = false;
  const waits = [];
  const caches = {
    keys: async () => [...stored.keys()], delete: async (k) => stored.delete(k),
    open: async (k) => {
      if (!stored.has(k)) stored.set(k, new Map());
      return { match: async (r) => stored.get(k).get(r.url ?? r), put: async (r, v) => stored.get(k).set(r.url ?? r, v) };
    },
  };
  vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin: 'https://example.test' }, addEventListener: (k, f) => handlers[k] = f, skipWaiting: async () => {}, clients: { claim: async () => { claimed = true; } } },
    caches, URL, Response, fetch: async () => { if (offline) throw Error('offline'); return new Response('COMPTE B'); },
  });
  return { handlers, stored, get claimed() { return claimed; }, offline: () => { offline = true; },
    async fetch(path, mode = 'navigate') {
      response = undefined;
      handlers.fetch({ request: { method: 'GET', url: `https://example.test${path}`, mode }, respondWith: (p) => response = p, waitUntil: (p) => waits.push(p) });
      const r = await response; await Promise.all(waits); return r;
    },
  };
}
test('activation du worker : anciens caches Study purgés, autres applications conservées', async () => {
  const w = worker(); let done;
  w.handlers.activate({ waitUntil: p => done = p }); await done;
  assert.equal(w.stored.has('study-hors-ligne-v1'), false);
  assert.equal(w.stored.has('autre-app'), true);
  assert.equal(w.claimed, true);
});
test('HTML connecté jamais stocké ; secours neutre ; connexion et API non interceptées', async () => {
  const w = worker();
  assert.equal(await (await w.fetch('/app/hors-ligne')).text(), 'COMPTE B');
  assert.equal(w.stored.size, 2, 'aucun nouveau cache HTML');
  w.offline();
  const response = await w.fetch('/app/hors-ligne');
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /COMPTE [AB]/);
  assert.equal(await w.fetch('/connexion'), undefined);
  assert.equal(await w.fetch('/api/v6/recherche', 'cors'), undefined);
});
test('fichiers publics versionnés seuls mis en cache', async () => {
  const w = worker();
  await w.fetch('/_next/static/chunk.js', 'cors'); w.offline();
  assert.equal(await (await w.fetch('/_next/static/chunk.js', 'cors')).text(), 'COMPTE B');
});
test('la limite pièce laisse une marge de transport multipart sous 4,5 MB', async () => {
  const { TAILLE_MAX_PIECE, CORPS_MAX_PIECE } = await import('../../src/lib/v6/limites-pieces.ts');
  const body = new FormData(); body.set('fichier', new File([new Uint8Array(TAILLE_MAX_PIECE)], 'cours.pdf'));
  const bytes = await new Request('https://example.test', { method: 'POST', body }).arrayBuffer();
  assert.ok(bytes.byteLength < CORPS_MAX_PIECE);
  assert.ok(CORPS_MAX_PIECE < 4_500_000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

for (const attendu of ['compte-A', undefined, 'compte-B']) {
  test(`note privée : compte actuel B, ancien formulaire ${attendu ?? 'sans identité'}`, async () => {
    const appels = [];
    const dependencies = {
      'next/cache': {}, 'next/navigation': {}, zod: { z },
      '@/lib/supabase-serveur': { clientUtilisateur: (token) => ({ rpc: async (nom, parametres) => { appels.push({ token, nom, parametres }); return { data: 2, error: null }; } }) },
      '@/lib/v6/contexte': { contexteApp: async () => ({ jeton: 'session-B', personne: { profileId: 'compte-B' } }), idRequete: () => 'test' },
      '@/lib/v6/erreurs': {},
    };
    const exports = {};
    const { outputText } = ts.transpileModule(readFileSync(new URL('../../src/app/app/seances/actions.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    vm.runInNewContext(outputText, { exports, require: (key) => {
      if (!(key in dependencies)) throw Error(key);
      return dependencies[key];
    }});
    const result = await exports.enregistrerNote('00000000-0000-4000-8000-0000000000a1', 'note A', 1, attendu);
    assert.equal(result.etat, attendu === 'compte-B' ? 'enregistre' : 'erreur');
    assert.equal(appels.length, attendu === 'compte-B' ? 1 : 0);
    if (appels.length) assert.equal(appels[0].token, 'session-B');
  });
}

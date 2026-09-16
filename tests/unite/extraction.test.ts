import assert from "node:assert/strict";
import test from "node:test";
import { extraire, formatDuFichier, ImportRefuse } from "../../src/lib/extraction.ts";
import { docx, pdf, pdfSansTexte, zip } from "./fabriquer-documents.ts";

/**
 * Import de documents — cahier « Refonte fidèle », S03, S06, T02.
 *
 * Le corpus est fabriqué dans le test : aucun document scolaire réel, et des
 * cas que l'on peut lire dans le code. Ce qui est vérifié ici est ce qui coûte
 * cher quand il lâche : un format mal reconnu, du HTML non assaini qui passe, et
 * un scan présenté comme converti alors qu'il est vide.
 */

/* ------------------------------------------------------------- Format ---- */

test("le format se décide sur les octets, jamais sur le nom", async () => {
  assert.equal(formatDuFichier(pdf(["Bonjour"])), "pdf");
  assert.equal(formatDuFichier(docx([{ texte: "Bonjour" }])), "docx");

  // Un ZIP quelconque n'est pas un DOCX : il lui manque word/document.xml.
  const archive = zip([{ nom: "lisezmoi.txt", contenu: Buffer.from("rien") }]);
  assert.equal(formatDuFichier(archive), null);

  // Du HTML qui se fait passer pour un PDF.
  assert.equal(formatDuFichier(Buffer.from("<!doctype html><p>cours</p>")), null);

  // Un .doc ancien commence par la signature OLE2, et n'est pas accepté.
  const ole = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(64),
  ]);
  assert.equal(formatDuFichier(ole), null);
});

test("un fichier non reconnu est refusé avec un message exploitable", async () => {
  const erreur = await assert.rejects(
    () => extraire(Buffer.from("ceci n'est pas un document".padEnd(64, " "))),
    ImportRefuse,
  );
  void erreur;
});

/* ---------------------------------------------------------------- PDF ---- */

test("un PDF à couche de texte est extrait, structure comprise", async () => {
  const document = await extraire(
    pdf([
      "Les fonctions affines",
      "Definition",
      "Une fonction affine s'ecrit f(x) = ax + b.",
      "1. Calculer f(2).",
      "2. Determiner l'antecedent de 5.",
    ]),
  );

  assert.equal(document.format, "pdf");
  assert.equal(document.rapport.pagesLues, 1);

  const types = document.blocs.map((bloc) => bloc.type);
  assert.ok(types.includes("titre"), `aucun titre dans ${types.join(", ")}`);
  assert.ok(types.includes("liste"), `aucune liste dans ${types.join(", ")}`);

  // Le texte des formules ressort intact : c'est tout l'enjeu.
  const integral = document.blocs
    .map((bloc) => ("texte" in bloc ? bloc.texte : ""))
    .join(" ");
  assert.match(integral, /f\(x\) = ax \+ b/);
});

test("un PDF numérisé est refusé, pas converti en page blanche", async () => {
  await assert.rejects(() => extraire(pdfSansTexte()), (erreur: unknown) => {
    assert.ok(erreur instanceof ImportRefuse);
    // Le message nomme la cause réelle et n'invente pas une panne.
    assert.match(erreur.message, /numéris|caractères/i);
    return true;
  });
});

test("chaque bloc sait de quelle page il vient", async () => {
  const document = await extraire(pdf(["Chapitre 1", "Une phrase de cours."]));
  for (const bloc of document.blocs) {
    assert.equal(bloc.origine?.page, 1, `bloc ${bloc.type} sans page d'origine`);
  }
});

/* --------------------------------------------------------------- DOCX ---- */

test("un DOCX rend ses titres, ses paragraphes et ses listes", async () => {
  const document = await extraire(
    docx([
      { texte: "Les fonctions affines", style: "Title" },
      { texte: "Définition", style: "Heading1" },
      { texte: "Une fonction affine s'écrit f(x) = ax + b." },
      { texte: "Calculer f(2)", style: "ListParagraph" },
    ]),
  );

  assert.equal(document.format, "docx");
  assert.ok(document.blocs.length >= 3);

  const titres = document.blocs.filter((bloc) => bloc.type === "titre");
  assert.ok(titres.length >= 1, "le style Titre doit produire un titre");

  const integral = document.blocs.map((bloc) => ("texte" in bloc ? bloc.texte : "")).join(" ");
  assert.match(integral, /f\(x\) = ax \+ b/);
});

test("le HTML de Mammoth ne devient jamais du balisage", async () => {
  // Le cas que la documentation de Mammoth signale explicitement : sa sortie
  // HTML n'est pas assainie. Ce qui protège ici n'est pas un filtre — c'est que
  // rien ne transporte de balisage. L'analyseur ne produit que des chaînes de
  // texte, et React les échappe au rendu.
  const document = await extraire(
    docx([
      { texte: "Cours", style: "Heading1" },
      { texte: "<script>alert(1)</script>" },
      { texte: "<img src=x onerror=alert(2)>" },
      { texte: '<a href="javascript:alert(3)">cliquer</a>' },
    ]),
  );

  // Tout ce qui ressemble à une balise est arrivé dans un bloc de TEXTE. Aucun
  // bloc ne porte de HTML : le modèle de document n'a pas de champ pour cela.
  for (const bloc of document.blocs) {
    assert.ok(
      ["paragraphe", "titre", "brut", "encadre", "liste"].includes(bloc.type),
      `type inattendu : ${bloc.type}`,
    );
  }

  const suspect = document.blocs.find(
    (bloc) => "texte" in bloc && bloc.texte.includes("script"),
  );
  assert.equal(suspect?.type, "paragraphe", "le fragment doit rester un paragraphe de texte");

  // Et le contenu n'est pas perdu : il reste lisible, tel que le professeur
  // l'a écrit. Effacer silencieusement serait pire.
  const integral = document.blocs.map((bloc) => ("texte" in bloc ? bloc.texte : "")).join(" ");
  assert.match(integral, /alert\(1\)/);
});

test("aucun rendu du produit n'injecte de HTML brut", async () => {
  // Le corollaire du test précédent, vérifié sur le code lui-même : si
  // `dangerouslySetInnerHTML` apparaissait un jour dans le chemin de rendu,
  // toute la garantie ci-dessus tomberait sans qu'aucun test ne bouge.
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, resolve } = await import("node:path");

  const racine = resolve(import.meta.dirname, "..", "..", "src");
  const fautifs: string[] = [];

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(entree) && readFileSync(chemin, "utf8").includes("dangerouslySetInnerHTML")) {
        fautifs.push(chemin);
      }
    }
  };
  parcourir(racine);

  assert.deepEqual(fautifs, [], "du HTML brut est injecté quelque part");
});

test("un DOCX vide est refusé plutôt que rendu comme un cours sans contenu", async () => {
  await assert.rejects(() => extraire(docx([])), ImportRefuse);
});

/* --------------------------------------------------------------- Taille -- */

test("un fichier vide et un fichier démesuré sont refusés tôt", async () => {
  await assert.rejects(() => extraire(Buffer.alloc(0)), ImportRefuse);

  const enorme = Buffer.alloc(31 * 1024 * 1024);
  enorme.write("%PDF-1.4");
  await assert.rejects(() => extraire(enorme), (erreur: unknown) => {
    assert.ok(erreur instanceof ImportRefuse);
    assert.match(erreur.message, /30 Mo/);
    return true;
  });
});

// Bande-son du film AvecStudy, entièrement calculée : aucun échantillon,
// aucune musique tierce, donc aucun droit à négocier. Le même appel rend
// toujours le même son (bruit pseudo-aléatoire à graine fixe).
//
// Elle suit les scènes du film, lues dans la page (`section[data-debut]`) :
// un accord par scène, un arpège façon marimba, une pulsation légère qui
// arrive avec la troisième scène, une montée de souffle avant chaque coupe
// et un impact sur la coupe. La dernière scène résout sur l'accord du début.

const TAU = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Fa majeur. Basse, puis l'accord du nappage (de bas en haut).
const ACCORDS = [
  { basse: 41, nappe: [57, 60, 64, 67] }, // Fa maj9 — le logo
  { basse: 38, nappe: [53, 57, 60, 64] }, // Ré m9 — la promesse
  { basse: 46, nappe: [62, 65, 69, 72] }, // Si♭ maj9 — le trio
  { basse: 36, nappe: [55, 60, 62, 64] }, // Do add9 — la correction
  { basse: 45, nappe: [60, 64, 67, 71] }, // La m9 — la progression
  { basse: 46, nappe: [57, 60, 62, 65] }, // Si♭ maj9 — la semaine
  { basse: 43, nappe: [58, 62, 65, 69] }, // Sol m9 — la remise
  { basse: 36, nappe: [58, 62, 65, 67] }, // Do 11 — le professeur
  { basse: 41, nappe: [57, 60, 64, 67, 72] }, // Fa maj9 — la fin
];
// Énergie de chaque scène, de 0 à 1 : elle règle l'arpège et la pulsation.
const ENERGIE = [0.25, 0.5, 0.7, 0.8, 0.9, 0.8, 0.85, 0.95, 0.55];
const TEMPS = 0.6; // une noire à 100 battements par minute

function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une voix ajoutée dans un tampon, entre deux instants (en secondes). */
function ajouter(tampon, frequence, debut, fin, f) {
  const a = Math.max(0, Math.floor(debut * frequence));
  const b = Math.min(tampon.length, Math.ceil(fin * frequence));
  for (let i = a; i < b; i++) tampon[i] += f(i / frequence - debut);
}

/** Réverbération de Schroeder : quatre peignes en parallèle, deux passe-tout. */
function reverberer(entree, frequence, decalage) {
  const n = entree.length;
  const sortie = new Float32Array(n);
  const k = frequence / 44100;
  for (const [ms, retour] of [[29.7, 0.84], [37.1, 0.83], [41.1, 0.82], [43.7, 0.81]]) {
    const d = Math.round((ms + decalage) * 44.1 * k);
    const ligne = new Float32Array(n);
    let filtre = 0;
    for (let i = 0; i < n; i++) {
      const passe = i >= d ? ligne[i - d] : 0;
      filtre = passe * 0.7 + filtre * 0.3; // aigus amortis à chaque passage
      ligne[i] = entree[i] + filtre * retour;
      sortie[i] += passe * 0.25;
    }
  }
  for (const ms of [5.0, 1.7]) {
    const d = Math.round(ms * 44.1 * k);
    const x = sortie.slice();
    for (let i = 0; i < n; i++) sortie[i] = -0.7 * x[i] + (i >= d ? x[i - d] + 0.7 * sortie[i - d] : 0);
  }
  return sortie;
}

/**
 * @param {{ duree: number, scenes: [number, number][], frequence?: number }} film
 *   durée totale et scènes [début, durée], en millisecondes.
 * @returns {{ frequence: number, canaux: Float32Array[] }}
 */
export function composer({ duree, scenes, frequence = 48000 }) {
  const n = Math.round((duree / 1000) * frequence);
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  const envoiG = new Float32Array(n); // vers la réverbération
  const envoiD = new Float32Array(n);
  const basse = new Float32Array(n);
  const frappes = []; // instants des temps forts, pour faire respirer la basse et la nappe
  const hasard = aleatoire(20261012);
  const fin = duree / 1000;

  scenes.forEach(([debutMs, dureeMs], s) => {
    const accord = ACCORDS[Math.min(s, ACCORDS.length - 1)];
    const energie = ENERGIE[Math.min(s, ENERGIE.length - 1)];
    const debut = debutMs / 1000;
    const finScene = Math.min(fin, (debutMs + dureeMs) / 1000);
    const derniere = s === scenes.length - 1;
    const tenue = derniere ? fin : finScene + 0.9;

    // Nappe : chaque note en trois voix légèrement désaccordées, réparties
    // gauche / centre / droite ; montée lente, extinction croisée avec la suivante.
    const attaque = s === 0 ? 2.2 : 0.35;
    accord.nappe.forEach((note, v) => {
      [-0.0035, 0, 0.0035].forEach((ecart, c) => {
        const f = hz(note) * (1 + ecart);
        const phase = hasard() * TAU;
        const niveau = 0.05 / accord.nappe.length;
        const env = (t) => Math.min(1, t / attaque) * Math.min(1, Math.max(0, (tenue - debut - t) / 0.9));
        const voix = (t) => {
          let x = 0;
          for (let h = 1; h <= 5; h++) x += Math.sin(TAU * f * h * t + phase * h) * (1 / h) * Math.exp(-h * 0.45);
          return x * niveau * env(t) * (1 + 0.15 * Math.sin(TAU * 0.2 * t + v));
        };
        const a = Math.floor(debut * frequence);
        const b = Math.min(n, Math.ceil(tenue * frequence));
        const gauche = c === 0 ? 0.9 : c === 1 ? 0.6 : 0.3;
        for (let i = a; i < b; i++) {
          const x = voix(i / frequence - debut);
          g[i] += x * gauche;
          d[i] += x * (1.2 - gauche);
          envoiG[i] += x * 0.5;
          envoiD[i] += x * 0.5;
        }
      });
    });

    // Basse : sinus tenu, une octave sous l'accord.
    const fb = hz(accord.basse);
    ajouter(basse, frequence, debut, tenue, (t) => {
      const env = Math.min(1, t / 0.08) * Math.min(1, Math.max(0, (tenue - debut - t) / 0.6));
      return (Math.sin(TAU * fb * t) + 0.3 * Math.sin(TAU * fb * 2 * t)) * 0.16 * env * (derniere ? 1 : energie);
    });

    // Arpège façon marimba : fondamentale et quatrième harmonique, attaque nette.
    if (s > 0) {
      const notes = accord.nappe.slice(0, 4).map((x) => x + 12);
      const motif = [0, 1, 2, 3, 2, 1, 3, 2];
      const pas = derniere ? TEMPS : TEMPS / 2;
      const arret = derniere ? finScene - 1.6 : finScene - 0.05;
      for (let k = 0, t0 = debut; t0 < arret; k++, t0 += pas) {
        const note = notes[motif[k % motif.length]];
        const f = hz(note);
        const fort = k % 4 === 0 ? 1 : 0.7;
        const niveau = 0.085 * fort * (0.55 + 0.45 * energie);
        const cote = k % 2 === 0 ? 0.35 : 0.65; // va-et-vient gauche / droite
        const a = Math.floor(t0 * frequence);
        const b = Math.min(n, Math.ceil((t0 + 1.2) * frequence));
        for (let i = a; i < b; i++) {
          const t = i / frequence - t0;
          const x = (Math.sin(TAU * f * t) + 0.22 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 18)) * Math.exp(-t * 4.2) * Math.min(1, t / 0.003) * niveau;
          g[i] += x * (1 - cote);
          d[i] += x * cote;
          envoiG[i] += x * 0.35;
          envoiD[i] += x * 0.35;
        }
      }
    }

    // Pulsation : une grosse caisse douce dès la troisième scène, des
    // balais à contretemps dès la quatrième. Rien pendant la fin.
    if (s >= 2 && !derniere) {
      for (let t0 = debut; t0 < finScene - 0.05; t0 += TEMPS) {
        frappes.push(t0);
        ajouter(g, frequence, t0, t0 + 0.35, (t) => {
          const f = 45 + 75 * Math.exp(-t * 30);
          return Math.sin(TAU * f * t) * Math.exp(-t * 11) * 0.22 * energie;
        });
        if (s >= 3) {
          const t1 = t0 + TEMPS / 2;
          let passe = 0;
          let prec = 0;
          ajouter(g, frequence, t1, t1 + 0.06, (t) => {
            const b = hasard() * 2 - 1;
            passe = 0.6 * (passe + b - prec); // passe-haut d'un pôle
            prec = b;
            return passe * Math.exp(-t * 70) * 0.05 * energie;
          });
        }
      }
    }

    // Coupe : montée de souffle avant, impact grave et scintillement dessus.
    if (s > 0) {
      const riser = Math.min(0.9, debut - scenes[s - 1][0] / 1000);
      let filtreG = 0;
      let filtreD = 0;
      const a = Math.floor((debut - riser) * frequence);
      const b = Math.floor(debut * frequence);
      for (let i = a; i < b; i++) {
        const p = (i - a) / (b - a);
        const coef = 0.02 + 0.3 * p * p;
        filtreG += coef * (hasard() * 2 - 1 - filtreG);
        filtreD += coef * (hasard() * 2 - 1 - filtreD);
        g[i] += filtreG * 0.12 * p * p;
        d[i] += filtreD * 0.12 * p * p;
        envoiG[i] += filtreG * 0.06 * p;
        envoiD[i] += filtreD * 0.06 * p;
      }
      ajouter(g, frequence, debut, debut + 1.2, (t) => Math.sin(TAU * (34 + 40 * Math.exp(-t * 9)) * t) * Math.exp(-t * 4.5) * 0.2);
      ajouter(d, frequence, debut, debut + 1.2, (t) => Math.sin(TAU * (34 + 40 * Math.exp(-t * 9)) * t) * Math.exp(-t * 4.5) * 0.2);
    }
    const scintille = (instant, niveau) =>
      accord.nappe.forEach((note, v) => {
        const f = hz(note + 24);
        const bout = (t) => Math.sin(TAU * f * t) * Math.exp(-t * 2.4) * Math.min(1, t / 0.002) * niveau;
        ajouter(v % 2 ? envoiG : envoiD, frequence, instant + v * 0.04, instant + 2.5, (t) => bout(t) * 1.6);
        ajouter(v % 2 ? g : d, frequence, instant + v * 0.04, instant + 2.5, bout);
      });
    if (s > 0) scintille(debut, 0.018);
    // Le logo : une cloche quand il apparaît, une autre quand il revient.
    if (s === 0) scintille(debut + 0.9, 0.035);
    if (derniere) scintille(debut + 0.6, 0.035);
  });

  // La basse et la nappe s'effacent un instant sous chaque temps fort.
  frappes.sort((a, b) => a - b);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i / frequence;
    while (j + 1 < frappes.length && frappes[j + 1] <= t) j++;
    const depuis = frappes.length && frappes[j] <= t ? t - frappes[j] : Infinity;
    const respire = 1 - 0.55 * Math.exp(-depuis / 0.12);
    g[i] += basse[i] * respire;
    d[i] += basse[i] * respire;
  }

  const reverbG = reverberer(envoiG, frequence, 0);
  const reverbD = reverberer(envoiD, frequence, 1.1);
  let crete = 0;
  for (let i = 0; i < n; i++) {
    g[i] += reverbG[i] * 0.55;
    d[i] += reverbD[i] * 0.55;
    crete = Math.max(crete, Math.abs(g[i]), Math.abs(d[i]));
  }

  // Mastering : niveau, saturation douce, fondus d'entrée et de sortie.
  const sature = Math.tanh(1.4);
  for (let i = 0; i < n; i++) {
    const t = i / frequence;
    const fondu = Math.min(1, t / 0.05) * Math.min(1, (fin - t) / 1.8);
    g[i] = (Math.tanh((1.4 * g[i]) / crete) / sature) * 0.89 * fondu;
    d[i] = (Math.tanh((1.4 * d[i]) / crete) / sature) * 0.89 * fondu;
  }
  return { frequence, canaux: [g, d] };
}

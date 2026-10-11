import { BookOpen, Check, Clock, Flame, Hash, MessagesSquare, Sparkles, Star, TriangleAlert, Users } from "lucide-react";
import { AccuseDeRemise } from "@/components/eleve/RemiseCopie";
import { BarreProgression, EnteteRetour, MaSemaine, NotionConsolidee, RetourReponse } from "@/components/study/Celebrations";
import { VuePointsBloquants } from "@/components/study/PointsBloquants";
import s from "./film.module.css";

/**
 * Aperçu de développement : le film de présentation d'AvecStudy, rendu image
 * par image par `scripts/film/enregistrer.mjs`. Données fictives ; les
 * écrans du téléphone sont les vrais composants de l'application.
 *
 * `?format=9x16` donne la version verticale.
 */

type Style = React.CSSProperties & Record<`--${string}`, string>;

/** Début et durée de chaque scène, en millisecondes. */
const SCENES = {
  logo: [0, 3600],
  promesse: [3600, 4200],
  trio: [7800, 4400],
  correction: [12200, 6000],
  progression: [18200, 6000],
  semaine: [24200, 4400],
  remise: [28600, 4400],
  professeur: [33000, 4600],
  fin: [37600, 3800],
} as const;
const DUREE_FILM = 41400;

function Scene({ cle, className = "", children }: { cle: keyof typeof SCENES; className?: string; children: React.ReactNode }) {
  const [debut, duree] = SCENES[cle];
  return (
    <section className={`${s.scene} ${className}`} data-debut={debut} style={{ "--debut": `${debut}ms`, "--duree": `${duree}ms` } as Style}>
      {children}
    </section>
  );
}

/** Un bloc qui entre puis sort à l'intérieur d'une scène (temps absolus du film). */
function Bloc({ debut, duree, children }: { debut: number; duree: number; children: React.ReactNode }) {
  return (
    <div className={s.bloc} data-debut={debut} style={{ "--debut": `${debut}ms`, "--duree": `${duree}ms` } as Style}>
      {children}
    </div>
  );
}

interface Satellite {
  readonly titre: string;
  readonly texte: string;
  readonly icone: React.ReactNode;
  /** Position par rapport au téléphone, en px, et profondeur. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly d: number;
  readonly ton?: "succes";
}

function Telephone({ satellites = [], children }: { satellites?: readonly Satellite[]; children: React.ReactNode }) {
  return (
    <div className={s.orbite} aria-hidden="true">
      <div className={s.telephone}>
        <div className={s.ecran}>
          <span className={s.encoche} />
          <div className={s.statut}>
            <span>9:41</span>
            <span>●●●</span>
          </div>
          <div className={s.barreApp}>
            <span className={s.marqueApp}>
              study<span>.</span>
            </span>
            <span className={s.pastilles}>
              <i />
              <i />
            </span>
          </div>
          <div className={s.contenu}>{children}</div>
        </div>
      </div>
      {satellites.map((sat) => (
        <div
          key={sat.titre}
          className={s.satellite}
          data-ton={sat.ton}
          style={{ left: sat.x, top: sat.y, "--z": `${sat.z}px`, "--ry": `${sat.ry}deg`, "--d": `${sat.d}ms` } as Style}
        >
          <span className={s.satelliteIcone}>{sat.icone}</span>
          <span>
            <strong>{sat.titre}</strong>
            {sat.texte}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legende({ sourcil, titre, texte }: { sourcil: string; titre: React.ReactNode; texte: string }) {
  return (
    <div className={s.legende}>
      <p className={`${s.sourcil} ${s.entre}`} style={{ "--d": "100ms" } as Style}>
        {sourcil}
      </p>
      <h2 className={`${s.titre} ${s.entre}`} style={{ "--d": "250ms" } as Style}>
        {titre}
      </h2>
      <p className={`${s.texte} ${s.entre}`} style={{ "--d": "450ms" } as Style}>
        {texte}
      </p>
    </div>
  );
}

/** Cubes en fil de fer, décor des scènes de marque. */
function Cubes({ cubes }: { cubes: readonly { x: string; y: string; t: number; a0: number; tour: number }[] }) {
  return (
    <div className={s.decor} aria-hidden="true">
      {cubes.map((c, i) => (
        <span key={i} className={s.cube} style={{ left: c.x, top: c.y, "--t": `${c.t}px`, "--a0": `${c.a0}deg`, "--tour": `${c.tour}deg` } as Style}>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}

const CUBES = [
  { x: "9%", y: "14%", t: 120, a0: 10, tour: 160 },
  { x: "80%", y: "62%", t: 170, a0: -30, tour: -140 },
  { x: "74%", y: "10%", t: 70, a0: 40, tour: 220 },
  { x: "14%", y: "70%", t: 90, a0: -10, tour: 190 },
] as const;

const CHOIX = ["f(2) = 1", "f(2) = 3", "f(2) = -1"];

export default async function Film({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const format = (await searchParams).format === "9x16" ? "9x16" : "16x9";
  const vertical = format === "9x16";
  const [debutCorrection] = SCENES.correction;
  const [debutProgression] = SCENES.progression;
  // Les satellites se placent autour du téléphone (430 px de large, 808 de haut).
  const gauche = vertical ? -150 : -230;
  const droite = vertical ? 260 : 160;
  return (
    <div className={s.stage} data-format={format} data-film-duree={DUREE_FILM}>
      {/* 1 — Le logo se retourne comme une pièce ; des cubes tournent autour. */}
      <Scene cle="logo" className={s.fondBerry}>
        <Cubes cubes={CUBES} />
        <div className={s.logoScene}>
          <div className={s.marque}>
            <svg className={s.anneau} viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="29" pathLength={100} />
            </svg>
            <span className={s.lettre}>s</span>
          </div>
          <p className={s.mot}>
            study<span>.</span>
          </p>
          <p className={`${s.accroche} ${s.entre}`} style={{ "--d": "1500ms" } as Style}>
            Le cours se termine. L&apos;apprentissage continue.
          </p>
        </div>
      </Scene>

      {/* 2 — La promesse : les lignes basculent en 3D. */}
      <Scene cle="promesse" className={s.fondPapier}>
        <div className={s.cinetique}>
          <div className={s.ligne}>
            <span style={{ "--d": "200ms" } as Style}>Tes cours.</span>
          </div>
          <div className={s.ligne}>
            <span style={{ "--d": "650ms" } as Style}>Tes révisions.</span>
          </div>
          <div className={s.ligne}>
            <span style={{ "--d": "1100ms" } as Style}>Ta classe.</span>
          </div>
          <p className={s.sousCinetique}>Au même endroit, pour avancer.</p>
          <span className={s.filet} />
        </div>
      </Scene>

      {/* 3 — Trois cartes arrivent du fond et se posent en éventail. */}
      <Scene cle="trio" className={s.fondClair}>
        <div className={s.trio}>
          <p className={`${s.trioTitre} ${s.entre}`} style={{ "--d": "100ms" } as Style}>
            Tout ce qu&apos;il faut, <em>rien de plus.</em>
          </p>
          <div className={s.eventail}>
            <article className={s.carte3d} style={{ "--d": "300ms", "--depart": "-70deg", "--pose": vertical ? "rotateX(8deg)" : "rotateY(16deg) translateZ(-40px)" } as Style}>
              <div className={s.carte3dTete}>
                <span className={s.carte3dIcone}>
                  <BookOpen size={30} />
                </span>
                <div>
                  <p className={s.carte3dSourcil}>Cours</p>
                  <p className={s.carte3dTitre}>Fonctions affines</p>
                </div>
              </div>
              <div className={s.lignes}>
                <i />
                <i />
                <i />
              </div>
              <p className={s.carte3dPied}>Reprendre où j&apos;en étais →</p>
            </article>
            <article className={s.carte3d} style={{ "--d": "550ms", "--depart": "0deg", "--pose": vertical ? "rotateX(4deg)" : "translateZ(40px)" } as Style}>
              <div className={s.carte3dTete}>
                <span className={s.carte3dIcone}>
                  <Sparkles size={30} />
                </span>
                <div>
                  <p className={s.carte3dSourcil}>Réviser</p>
                  <p className={s.carte3dTitre}>Ta semaine</p>
                </div>
              </div>
              <div className={s.flammes}>
                <Flame size={34} fill="currentColor" />
                <Flame size={34} fill="currentColor" />
                <span>
                  <Flame size={34} />
                </span>
                <Flame size={34} fill="currentColor" />
                <Flame size={34} fill="currentColor" />
              </div>
              <p className={s.carte3dPied}>3 notions à revoir aujourd&apos;hui</p>
            </article>
            <article className={s.carte3d} style={{ "--d": "800ms", "--depart": "70deg", "--pose": vertical ? "rotateX(0deg)" : "rotateY(-16deg) translateZ(-40px)" } as Style}>
              <div className={s.carte3dTete}>
                <span className={s.carte3dIcone}>
                  <Users size={30} />
                </span>
                <div>
                  <p className={s.carte3dSourcil}>Classe</p>
                  <p className={s.carte3dTitre}>Seconde 2</p>
                </div>
              </div>
              <p className={s.bulle}>Comment lire f(3) sur le graphique ?</p>
              <p className={s.carte3dPied}>
                <MessagesSquare size={22} /> 4 « même question »
              </p>
            </article>
          </div>
        </div>
      </Scene>

      {/* 4 — Une correction immédiate. */}
      <Scene cle="correction" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="S'entraîner" titre={<>Une correction <em>tout de suite.</em></>} texte="Les exercices de ton professeur, corrigés à l'instant, avec le passage du cours pour comprendre." />
          <Telephone
            satellites={[
              { titre: "Bonne réponse !", texte: "Trouvée sans indice", icone: <Check size={24} strokeWidth={3} />, x: gauche, y: 120, z: 160, ry: 16, d: 2300, ton: "succes" },
              { titre: "Le passage du cours", texte: "Lire une image sur un graphique", icone: <BookOpen size={22} />, x: droite, y: 560, z: 110, ry: -18, d: 2700 },
            ]}
          >
            <div className={s.enTeteEntrainement}>
              <span>Question 3 sur 8</span>
              <BarreProgression fait={2} total={8} />
            </div>
            <p className={s.question}>Sur le graphique, quelle est l&apos;image de 2 par f ?</p>
            {CHOIX.map((c, i) => (
              <div key={c} className={s.choix}>
                <b>{String.fromCharCode(65 + i)}</b>
                {c}
                {i === 1 ? (
                  <>
                    <span className={s.tap} style={{ "--d": "1300ms" } as Style} />
                    <span className={s.choixJuste} style={{ "--d": "1450ms" } as Style}>
                      <b>B</b>
                      {c}
                    </span>
                  </>
                ) : null}
              </div>
            ))}
            <Bloc debut={debutCorrection + 2100} duree={3900}>
              <RetourReponse ton="succes">
                <EnteteRetour juste sansIndice />
                <p className="m-0 mt-2 text-[15px]">On part de 2 sur l&apos;axe horizontal, on lit la hauteur : 3.</p>
              </RetourReponse>
            </Bloc>
          </Telephone>
        </div>
      </Scene>

      {/* 5 — La progression, puis une notion consolidée. */}
      <Scene cle="progression" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="Ta progression" titre={<>Notion par notion. <em>Sans note.</em></>} texte="Trois réussites sans aide, sur deux jours et deux exercices : la notion rejoint tes acquis." />
          <Telephone
            satellites={[
              { titre: "3 réussites", texte: "sans aide, sur 2 jours", icone: <Check size={24} strokeWidth={3} />, x: gauche, y: 470, z: 150, ry: 16, d: 1900, ton: "succes" },
              { titre: "Consolidée", texte: "Fonctions affines", icone: <Star size={22} fill="currentColor" />, x: droite, y: 150, z: 120, ry: -18, d: 2600 },
            ]}
          >
            <div className={s.enTeteEntrainement}>
              <span>Question 4 sur 8</span>
              <BarreProgression fait={4} total={8} />
            </div>
            <Bloc debut={debutProgression + 1600} duree={4400}>
              <NotionConsolidee notion="Fonctions affines" />
            </Bloc>
          </Telephone>
        </div>
      </Scene>

      {/* 6 — Ta semaine. */}
      <Scene cle="semaine" className={s.fondPapier}>
        <div className={s.compo}>
          <Legende sourcil="Un peu chaque jour" titre={<>Chaque jour <em>s&apos;allume.</em></>} texte="Une pause ne fait rien perdre : pas de série à tenir, juste ta semaine." />
          <Telephone
            satellites={[
              { titre: "4 jours", texte: "d'entraînement cette semaine", icone: <Flame size={22} fill="currentColor" />, x: droite, y: 380, z: 150, ry: -18, d: 1300 },
            ]}
          >
            <div className="panneau">
              <MaSemaine semaine={{ jours: [true, true, false, true, true, false, false], aujourdHui: 4, actifs: 4 }} />
            </div>
          </Telephone>
        </div>
      </Scene>

      {/* 7 — Copie remise. */}
      <Scene cle="remise" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="Les devoirs" titre={<>Rendu en <em>un geste.</em></>} texte="La copie part, le serveur l'horodate, tu gardes la référence. Sans doute possible." />
          <Telephone
            satellites={[
              { titre: "AS-7K2F-91QX", texte: "ta référence", icone: <Hash size={22} />, x: gauche, y: 470, z: 150, ry: 16, d: 1200, ton: "succes" },
              { titre: "12 oct. · 14:32", texte: "horodaté par le serveur", icone: <Clock size={22} />, x: droite, y: 120, z: 110, ry: -18, d: 1600 },
            ]}
          >
            <AccuseDeRemise etat={{ etat: "remis", reference: "AS-7K2F-91QX", remisLe: "2026-10-12T12:32:00Z", numero: 1, enRetard: false }} />
          </Telephone>
        </div>
      </Scene>

      {/* 8 — Pour les professeurs. */}
      <Scene cle="professeur" className={s.fondPapier}>
        <div className={s.compo}>
          <Legende sourcil="Pour les professeurs" titre={<>Voir ce qui <em>bloque.</em></>} texte="Questions et passages « pas compris », regroupés par séance. Des nombres, jamais de noms." />
          <Telephone
            satellites={[
              { titre: "2 sans réponse", texte: "Lire une image sur un graphique", icone: <TriangleAlert size={22} />, x: gauche, y: 520, z: 150, ry: 16, d: 1300 },
              { titre: "Répondre une fois", texte: "à toute la classe", icone: <MessagesSquare size={22} />, x: droite, y: 140, z: 110, ry: -18, d: 1700 },
            ]}
          >
            <VuePointsBloquants
              points={[
                { seance: "s1", titre: "Lire une image sur un graphique", questions: 3, sansReponse: 2, memeQuestion: 4, passagesIncompris: 2, elevesPassages: 3, exemple: "Pourquoi on part de l'axe horizontal ?", href: "#" },
                { seance: "s2", titre: "La fonction carré", questions: 1, sansReponse: 0, memeQuestion: 1, passagesIncompris: 0, elevesPassages: 0, exemple: "Le carré d'un négatif est positif ?", href: "#" },
              ]}
            />
          </Telephone>
        </div>
      </Scene>

      {/* 9 — Fin : le nom bascule et prend du relief. */}
      <Scene cle="fin" className={s.fondBerry}>
        <Cubes cubes={CUBES} />
        <div className={s.fin}>
          <p className={s.finMot}>
            study<span>.</span>
          </p>
          <p className={s.adresse}>avecstudy.fr</p>
          <p className={s.mentions}>Pour les lycées · financé par l&apos;établissement · sans publicité</p>
        </div>
      </Scene>
    </div>
  );
}

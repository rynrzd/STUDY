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
  correction: [7800, 6000],
  progression: [13800, 6000],
  semaine: [19800, 4400],
  remise: [24200, 4400],
  professeur: [28600, 4600],
  fin: [33200, 3800],
} as const;
const DUREE_FILM = 37000;

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

function Telephone({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.telephone} aria-hidden="true">
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

const CHOIX = ["f(2) = 1", "f(2) = 3", "f(2) = -1"];

export default async function Film({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const format = (await searchParams).format === "9x16" ? "9x16" : "16x9";
  const [debutCorrection] = SCENES.correction;
  const [debutProgression] = SCENES.progression;
  return (
    <div className={s.stage} data-format={format} data-film-duree={DUREE_FILM}>
      {/* 1 — Le logo tourne et se dessine. */}
      <Scene cle="logo" className={s.fondBerry}>
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

      {/* 2 — La promesse, en typographie cinétique. */}
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

      {/* 3 — Une correction immédiate. */}
      <Scene cle="correction" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="S'entraîner" titre={<>Une correction <em>tout de suite.</em></>} texte="Les exercices de ton professeur, corrigés à l'instant, avec le passage du cours pour comprendre." />
          <Telephone>
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

      {/* 4 — La progression, puis une notion consolidée. */}
      <Scene cle="progression" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="Ta progression" titre={<>Notion par notion. <em>Sans note.</em></>} texte="Trois réussites sans aide, sur deux jours et deux exercices : la notion rejoint tes acquis." />
          <Telephone>
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

      {/* 5 — Ta semaine. */}
      <Scene cle="semaine" className={s.fondPapier}>
        <div className={s.compo}>
          <Legende sourcil="Un peu chaque jour" titre={<>Chaque jour <em>s&apos;allume.</em></>} texte="Une pause ne fait rien perdre : pas de série à tenir, juste ta semaine." />
          <Telephone>
            <div className="panneau">
              <MaSemaine semaine={{ jours: [true, true, false, true, true, false, false], aujourdHui: 4, actifs: 4 }} />
            </div>
          </Telephone>
        </div>
      </Scene>

      {/* 6 — Copie remise. */}
      <Scene cle="remise" className={s.fondClair}>
        <div className={s.compo}>
          <Legende sourcil="Les devoirs" titre={<>Rendu en <em>un geste.</em></>} texte="La copie part, le serveur l'horodate, tu gardes la référence. Sans doute possible." />
          <Telephone>
            <AccuseDeRemise etat={{ etat: "remis", reference: "AS-7K2F-91QX", remisLe: "2026-10-12T12:32:00Z", numero: 1, enRetard: false }} />
          </Telephone>
        </div>
      </Scene>

      {/* 7 — Pour les professeurs. */}
      <Scene cle="professeur" className={s.fondPapier}>
        <div className={s.compo}>
          <Legende sourcil="Pour les professeurs" titre={<>Voir ce qui <em>bloque.</em></>} texte="Questions et passages « pas compris », regroupés par séance. Des nombres, jamais de noms." />
          <Telephone>
            <VuePointsBloquants
              points={[
                { seance: "s1", titre: "Lire une image sur un graphique", questions: 3, sansReponse: 2, memeQuestion: 4, passagesIncompris: 2, elevesPassages: 3, exemple: "Pourquoi on part de l'axe horizontal ?", href: "#" },
                { seance: "s2", titre: "La fonction carré", questions: 1, sansReponse: 0, memeQuestion: 1, passagesIncompris: 0, elevesPassages: 0, exemple: "Le carré d'un négatif est positif ?", href: "#" },
              ]}
            />
          </Telephone>
        </div>
      </Scene>

      {/* 8 — Fin. */}
      <Scene cle="fin" className={s.fondBerry}>
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

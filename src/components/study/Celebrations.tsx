import { Flame, Lightbulb, Star, Zap } from "lucide-react";
import { JOURS_COURTS, type Semaine } from "@/lib/semaine";
import s from "./celebrations.module.css";

/**
 * Célébrations AvecStudy — la planche « 8 animations » adaptée au produit.
 *
 * Chaque animation salue un **vrai** événement, avec de vraies valeurs :
 * fin d'entraînement (bilan sans note), copie remise (référence et heure du
 * serveur), réponse juste ou pas encore, progression dans l'entraînement,
 * jours d'entraînement de la semaine (jamais une série qui se perd), notion
 * consolidée (la règle du moteur de révision), indice du professeur.
 *
 * Purement décoratives : le texte porte toujours l'information, les formes
 * animées sont `aria-hidden`. Sans état ni effet, utilisables côté serveur
 * comme côté client.
 */

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

const TEINTES = {
  marque: ["var(--color-accent)", "var(--color-rose-decor)", "#e8b7c8", "var(--color-encre)", "#a65d79"],
  succes: ["var(--color-succes)", "#7fbf95", "var(--color-accent)", "#c4e3cf", "var(--color-rose-decor)"],
} as const;

/** Éclats déterministes : mêmes positions au serveur et au client. */
function eclats(nombre: number, rayon: number) {
  return Array.from({ length: nombre }, (_, i) => {
    const angle = (i / nombre) * Math.PI * 2 + (i % 3) * 0.17;
    const distance = rayon * (0.7 + ((i * 37) % 30) / 100);
    return {
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance * 0.8 - rayon * 0.15),
      r: ((i * 73) % 300) - 150,
      d: (i % 6) * 25 + 140,
    };
  });
}
const ECLATS = { grand: eclats(20, 110), petit: eclats(10, 56) } as const;

export function Confettis({ ton = "marque", taille = "grand" }: { ton?: keyof typeof TEINTES; taille?: "grand" | "petit" }) {
  const teintes = TEINTES[ton];
  return (
    <span className={s.confettis} data-taille={taille} aria-hidden="true">
      {ECLATS[taille].map((e, i) => (
        <i key={i} style={{ "--x": `${e.x}px`, "--y": `${e.y}px`, "--r": `${e.r}deg`, "--d": `${e.d}ms`, "--c": teintes[i % teintes.length] } as Style} />
      ))}
    </span>
  );
}

export function Medaillon({
  ton = "marque",
  icone = "coche",
  taille = "grand",
}: {
  ton?: "marque" | "succes" | "erreur";
  icone?: "coche" | "croix" | "document";
  taille?: "grand" | "petit";
}) {
  return (
    <span className={s.medaillon} data-ton={ton} data-icone={icone} data-taille={taille} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {icone === "document" ? (
          <g className={s.document}>
            <path d="M6 2.5h8l4 4v15H6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 11h6M9 14.5h6M9 18h4" stroke="currentColor" strokeWidth="1.8" />
          </g>
        ) : null}
        {icone === "croix" ? <path className={s.trace} d="M6 6l12 12M18 6L6 18" /> : <path className={s.trace} d="M4.5 12.5l5 5 10-11" />}
      </svg>
    </span>
  );
}

/** Le nombre monte jusqu'à sa valeur ; la valeur exacte est lue par les lecteurs d'écran. */
export function Compteur({ valeur }: { valeur: number }) {
  return (
    <>
      <span className={s.compteur} style={{ "--cible": valeur } as Style} aria-hidden="true" />
      <span className="sr-only">{valeur}</span>
    </>
  );
}

/** 1 — Fin d'entraînement : un bilan, pas une note. */
export function BilanEntrainement({
  reussies,
  corrigees,
  semaine,
  children,
}: {
  reussies: number;
  corrigees: number;
  semaine: Semaine | null;
  children: React.ReactNode;
}) {
  return (
    <section className={s.panneau} aria-labelledby="bilan-titre">
      <Medaillon />
      <Confettis />
      <h2 id="bilan-titre" className={s.titre}>
        Entraînement terminé !
      </h2>
      <p className={s.sousTitre}>Bravo, tu as fini cet entraînement.</p>
      <div className={`${s.bloc} ${s.bilan}`}>
        <Compteur valeur={reussies} />
        <p>
          <strong>
            réussite{reussies > 1 ? "s" : ""} sur {corrigees} question{corrigees > 1 ? "s" : ""} corrigée{corrigees > 1 ? "s" : ""}
          </strong>
          <br />
          <span className="text-[color:var(--color-encre-faible)]">Ce n&apos;est pas une note : tes erreurs sont rangées dans ton carnet, pour y revenir.</span>
        </p>
      </div>
      {semaine ? (
        <div className={s.bloc} style={{ marginTop: 22 }}>
          <MaSemaine semaine={semaine} />
        </div>
      ) : null}
      <div className={`${s.bloc} mt-6 flex flex-wrap justify-center gap-2`}>{children}</div>
    </section>
  );
}

/** 2 — Copie remise : ce que le serveur a enregistré, avec une coche qui remplace la feuille. */
export function EnteteRemise() {
  return (
    <div className={s.accuseTete}>
      <span className="relative block">
        <Medaillon ton="succes" icone="document" />
        <Confettis ton="succes" taille="petit" />
      </span>
    </div>
  );
}

/** 3 et 4 — Le retour d'une correction : juste (coche, éclats) ou pas encore (croix, sans secousse). */
export function EnteteRetour({ juste, sansIndice }: { juste: boolean; sansIndice: boolean }) {
  return (
    <div className={s.retourTete}>
      <span className="relative block">
        <Medaillon ton={juste ? "succes" : "erreur"} icone={juste ? "coche" : "croix"} taille="petit" />
        {juste ? <Confettis ton="succes" taille="petit" /> : null}
      </span>
      <div>
        <p className={s.retourTitre}>{juste ? "Bonne réponse !" : "Pas encore"}</p>
        <p className={s.retourSous}>
          {juste ? (sansIndice ? "Trouvée sans indice." : "Trouvée avec un indice : c'est comme ça qu'on apprend.") : "Lis l'explication : ton erreur est rangée dans ton carnet."}
        </p>
      </div>
    </div>
  );
}

export function RetourReponse({ ton, children }: { ton: "succes" | "erreur" | "neutre"; children: React.ReactNode }) {
  return (
    <div role="status" className={s.retour} data-ton={ton}>
      {children}
    </div>
  );
}

/** 5 — La barre de l'entraînement : elle se remplit, la moitié franchie s'annonce. */
export function BarreProgression({ fait, total }: { fait: number; total: number }) {
  const moitie = total >= 4 && fait === Math.ceil(total / 2);
  return (
    <div className={s.progression}>
      {moitie ? (
        <p className={s.etape} aria-hidden="true">
          <Zap size={13} strokeWidth={2} /> Déjà la moitié !
        </p>
      ) : null}
      <div className={s.barre} aria-hidden="true">
        <span style={{ "--p": total === 0 ? 0 : fait / total } as Style} />
      </div>
    </div>
  );
}

/** Classe à poser sur les segments d'une barre existante pour qu'ils se remplissent. */
export const REMPLISSAGE = s.remplit;

/** 6 — Ta semaine : les jours d'entraînement s'allument. Rien ne se perd. */
export function MaSemaine({ semaine }: { semaine: Semaine }) {
  let rang = 0;
  return (
    <div className={s.semaine}>
      <div className={s.semaineTete}>
        <p className={s.semaineTitre}>Ta semaine</p>
        <p className={s.semaineCompte}>
          {semaine.actifs === 0 ? "Pas encore d'entraînement" : `${semaine.actifs} jour${semaine.actifs > 1 ? "s" : ""} d'entraînement`}
        </p>
      </div>
      <ul className={s.jours}>
        {JOURS_COURTS.map((jour, i) => {
          const actif = semaine.jours[i] === true;
          const delai = actif ? 120 + rang++ * 90 : 0;
          return (
            <li key={jour} className={s.jour} data-actif={actif ? "oui" : "non"} data-aujourdhui={i === semaine.aujourdHui ? "oui" : "non"}>
              <Flame className={s.flamme} size={20} strokeWidth={1.75} fill={actif ? "currentColor" : "none"} style={{ "--d": `${delai}ms` } as Style} aria-hidden="true" />
              <span>
                {jour}
                <span className="sr-only">{actif ? " : entraînement" : i > semaine.aujourdHui ? " : à venir" : " : pas d'entraînement"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={s.semaineNote}>Chaque jour où tu t&apos;entraînes s&apos;allume. Une pause ne fait rien perdre.</p>
    </div>
  );
}

/** 7 — Notion consolidée : la règle du moteur (3 réussites sans aide, 2 jours, 2 exercices). */
export function NotionConsolidee({ notion }: { notion: string }) {
  return (
    <section className={s.panneau} style={{ marginTop: 20 }} aria-labelledby="consolidee-titre" role="status">
      <span className={s.hexaScene} aria-hidden="true">
        <span className={s.hexagone}>
          <Star className={s.etoile} size={34} strokeWidth={1.75} fill="currentColor" />
        </span>
      </span>
      <Confettis />
      <h2 id="consolidee-titre" className={s.titre}>
        Notion consolidée !
      </h2>
      <p className={`${s.sousTitre} ${s.notion} font-bold`}>{notion}</p>
      <p className={s.sousTitre}>Réussie sans aide, sur plusieurs jours et plusieurs exercices : elle rejoint tes acquis. Study te la reproposera de loin en loin.</p>
    </section>
  );
}

/** 8 — L'indice du professeur se dévoile. */
export function IndiceDevoile({ texte }: { texte: string }) {
  return (
    <div className={s.indice}>
      <span className={s.ampoule} aria-hidden="true">
        <Lightbulb size={20} strokeWidth={1.9} />
      </span>
      <div>
        <p className={s.indiceTitre}>Indice de ton professeur</p>
        <p className="mt-1">{texte}</p>
      </div>
    </div>
  );
}

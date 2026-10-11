import { cookies } from "next/headers";
import { COOKIE_EFFETS, COOKIE_INTRO, lirePreference } from "@/lib/mouvement";
import { EffacerIntro } from "./EffacerIntro";
import s from "./intro.module.css";

/**
 * Intro de marque, une fois, juste après la connexion : le logo tourne et se
 * dessine, puis l'espace se dévoile vers le haut (≈ 1,1 s). Rendue côté
 * serveur à partir d'un cookie posé par la connexion, donc sans flash. En CSS
 * seul et `pointer-events: none` : elle ne bloque jamais un clic, et finit
 * cachée même sans JavaScript. La préférence « Effets visuels » et le réglage
 * système « réduire les animations » la suppriment.
 */
export async function IntroConnexion() {
  const magasin = await cookies();
  if (magasin.get(COOKIE_INTRO)?.value !== "1") return null;
  if (lirePreference(magasin.get(COOKIE_EFFETS)?.value) !== "auto") return <EffacerIntro />;
  return (
    <>
      <VueIntro />
      <EffacerIntro />
    </>
  );
}

/** Le rendu seul, pour l'aperçu fictif. */
export function VueIntro() {
  return (
    <div className={s.intro} aria-hidden="true">
      <div className={s.marque}>
        <svg className={s.anneau} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" pathLength={100} />
        </svg>
        <span className={s.lettre}>s</span>
      </div>
      <p className={s.mot}>
        study<span>.</span>
      </p>
    </div>
  );
}

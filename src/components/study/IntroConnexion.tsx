import { cookies } from "next/headers";
import { COOKIE_EFFETS, COOKIE_INTRO, lirePreference } from "@/lib/mouvement";
import { EffacerIntro } from "./EffacerIntro";
import { VueIntro } from "./VueIntro";

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

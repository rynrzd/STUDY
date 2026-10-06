import { RubanStudy } from "@/components/study/ruban/RubanStudy";
import type { Composition } from "@/components/study/ruban/scene";

/** Le ruban seul, à la taille de son image fixe : sert à produire cette image. */
const TAILLES: Record<Composition, [number, number]> = { grande: [960, 760], petite: [640, 520], fragment: [480, 400] };

export default async function ApercuRuban({ searchParams }: { searchParams: Promise<{ composition?: string }> }) {
  const { composition: brute } = await searchParams;
  const composition: Composition = brute === "petite" || brute === "fragment" ? brute : "grande";
  const [l, h] = TAILLES[composition];
  return (
    <main id="contenu" style={{ background: "transparent", padding: 0 }}>
      <div id="cible" style={{ width: l, height: h, position: "relative" }}>
        <RubanStudy composition={composition} webgl controle={false} className="absolute inset-0" />
      </div>
    </main>
  );
}

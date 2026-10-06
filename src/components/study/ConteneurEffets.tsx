import { cookies } from "next/headers";
import { COOKIE_EFFETS, lirePreference } from "@/lib/mouvement";

/**
 * Pose la préférence « Effets visuels » côté serveur, sur un conteneur sans
 * boîte (`display: contents`) : sur une page dynamique, aucune animation ne
 * joue avant que la préférence soit connue.
 */
export async function ConteneurEffets({ children }: { children: React.ReactNode }) {
  const effets = lirePreference((await cookies()).get(COOKIE_EFFETS)?.value);
  return (
    <div data-effets={effets} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

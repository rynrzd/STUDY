import { ImageResponse } from "next/og";

/**
 * Image de partage (Open Graph).
 *
 * Elle reprend le titre du produit, rien d'autre : pas de capture d'écran
 * illisible à cette taille, pas de chiffre, pas de logo d'établissement.
 */

export const alt = "AvecStudy — Le travail de la classe, au même endroit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImageOpenGraph() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafbfd",
          color: "#0e1a33",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0e1a33",
              color: "#ffffff",
              borderRadius: 12,
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>
            AvecStudy
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 74,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Le travail de la classe, au même endroit.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, color: "#55607a" }}>
          <div style={{ display: "flex" }}>
            Cours, séances, devoirs et entraide, par classe.
          </div>
          <div style={{ display: "flex", width: 6, height: 6, background: "#2b4fff", borderRadius: 3 }} />
          <div style={{ display: "flex" }}>avecstudy.fr</div>
        </div>
      </div>
    ),
    size,
  );
}

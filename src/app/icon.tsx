import { ImageResponse } from "next/og";

/**
 * Favicon — généré, pour n'avoir qu'une seule définition de la marque.
 *
 * L'ancien favicon appartenait à « study. » ; le cahier de finition impose de
 * supprimer les anciens logos, favicon, titres et métadonnées.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icone() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e1a33",
          color: "#ffffff",
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          borderRadius: 7,
        }}
      >
        A
      </div>
    ),
    size,
  );
}

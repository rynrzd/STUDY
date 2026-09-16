import { ImageResponse } from "next/og";

/** Icône d'écran d'accueil iOS, même marque que le favicon. */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeApple() {
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
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        A
      </div>
    ),
    size,
  );
}

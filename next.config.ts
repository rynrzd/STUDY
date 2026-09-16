import type { NextConfig } from "next";

/**
 * En-tetes statiques (WEB-01 / WEB-02 du cahier des charges).
 * La CSP nonce-based est posee par le middleware, car elle change a chaque reponse.
 * HSTS n'est emis qu'en production, apres verification de tous les hotes concernes.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const productionOnlyHeaders = [
  {
    key: "Strict-Transport-Security",
    // preload volontairement absent : ne pas precharger avant verification de tous les sous-domaines.
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Les images distantes ne sont pas autorisees : tout support vient du stockage prive via le BFF.
  images: { remotePatterns: [] },
  async redirects() {
    // Anciennes adresses publiques, conservees pour ne pas casser un lien
    // deja envoye a un etablissement. /demo et /etablissements sont desormais
    // un seul parcours (finition V1, 5.2).
    return [
      { source: "/fonctionnalites", destination: "/produit", permanent: true },
      { source: "/demo", destination: "/etablissements", permanent: true },
    ];
  },
  async headers() {
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, ...productionOnlyHeaders]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;

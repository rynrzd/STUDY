import { NextResponse } from "next/server";

/**
 * PDF d'exemple pour l'aperçu du lecteur intégré — développement uniquement.
 *
 * Le gabarit de `/apercu` (notFound en production) ne s'applique pas aux
 * routes : le refus est donc écrit ici, explicitement. Le document est
 * fabriqué à la main (deux pages, du texte et un tracé) : aucune donnée réelle,
 * aucun fichier stocké.
 */
export const dynamic = "force-dynamic";

function fabriquerPdf(): Uint8Array {
  const pages = [
    "BT /F1 26 Tf 72 760 Td (Les fonctions affines) Tj ET\n" +
      "BT /F1 14 Tf 72 720 Td (Une fonction affine s'ecrit f\\(x\\) = ax + b.) Tj ET\n" +
      "BT /F1 14 Tf 72 696 Td (a est le coefficient directeur, b l'ordonnee a l'origine.) Tj ET\n" +
      "0.48 0.25 0.36 RG 2 w 72 380 m 520 380 l S 120 300 m 120 640 l S\n" +
      "0.7 0.2 0.4 RG 3 w 120 330 m 500 610 l S\n" +
      "BT /F1 12 Tf 470 620 Td (y = 2x + 1) Tj ET",
    "BT /F1 26 Tf 72 760 Td (Exercice) Tj ET\n" +
      "BT /F1 14 Tf 72 720 Td (1. Tracer la droite d'equation y = -x + 3.) Tj ET\n" +
      "BT /F1 14 Tf 72 696 Td (2. Lire l'image de 2 sur le graphique.) Tj ET\n" +
      "0.2 0.4 0.3 RG 1 w 72 300 450 300 re S",
  ];

  const objets: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objets.push("<< /Type /Catalog /Pages 2 0 R >>");
  objets.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objets.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((contenu, i) => {
    objets.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objets.push(`<< /Length ${Buffer.byteLength(contenu, "latin1")} >>\nstream\n${contenu}\nendstream`);
  });

  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((corps, i) => {
    positions.push(Buffer.byteLength(sortie, "latin1"));
    sortie += `${i + 1} 0 obj\n${corps}\nendobj\n`;
  });
  const debutXref = Buffer.byteLength(sortie, "latin1");
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const p of positions) sortie += `${String(p).padStart(10, "0")} 00000 n \n`;
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(sortie, "latin1"));
}

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }
  const octets = fabriquerPdf();
  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=exemple.pdf",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

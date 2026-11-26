import { pdfModerniseExemple, pdfOriginalExemple } from "@/lib/exemple-studio";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ version: "original" }, { version: "modernise" }];
}

export async function GET(_requete: Request, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (version !== "original" && version !== "modernise") return new Response(null, { status: 404 });
  const octets = await (version === "original" ? pdfOriginalExemple() : pdfModerniseExemple());
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fonctions-affines-${version}.pdf"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

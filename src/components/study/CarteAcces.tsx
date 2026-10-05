import Link from "next/link";

/**
 * Coque des écrans d'accès (E30 à E34) : marque, carte centrée de 480 px,
 * retour explicite. Aucune donnée scolaire n'y est chargée.
 */
export function CarteAcces({
  titre,
  sousTitre,
  children,
  retour = { href: "/connexion", libelle: "Retour à la connexion" },
}: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  retour?: { href: string; libelle: string } | null;
}) {
  return (
    <div className="app-coque !block min-h-dvh">
      <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center px-4 py-10">
        <Link href="/" className="marque-study mb-8 text-[2rem] leading-none">
          study<span>.</span>
        </Link>
        <section className="panneau">
          <h1 className="titre-section text-[1.5rem] leading-[2rem]">{titre}</h1>
          {sousTitre ? <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">{sousTitre}</p> : null}
          <div className="mt-6">{children}</div>
        </section>
        {retour ? (
          <p className="meta m-0 mt-6">
            <Link href={retour.href} className="text-[color:var(--color-encre-faible)]">
              ← {retour.libelle}
            </Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}

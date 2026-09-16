import { FicheDemande } from "@/components/administration/FicheDemande";
import { compterDemandesParEtat, listerDemandes } from "@/lib/administration";
import { ETATS, libelleEtat, type Etat } from "@/lib/demande-commerciale";
import Link from "next/link";

/**
 * Demandes commerciales.
 *
 * Une demande déposée sur le site apparaît ici immédiatement : c'est le seul
 * endroit où elle arrive, puisque aucun courrier n'est envoyé. D'où le soin
 * apporté à ce qu'elle soit lisible d'un coup d'œil — nom, contact, besoin,
 * état — sans avoir à ouvrir quoi que ce soit.
 */
export const dynamic = "force-dynamic";

export default async function PageDemandes({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const parametres = await searchParams;
  const filtre = ETATS.some((element) => element.valeur === parametres.etat)
    ? (parametres.etat as Etat)
    : undefined;

  const [demandes, comptes] = await Promise.all([
    listerDemandes(filtre),
    compterDemandesParEtat(),
  ]);

  const total = Object.values(comptes).reduce((somme, valeur) => somme + valeur, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
            Demandes commerciales
          </h1>
          <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            {total === 0
              ? "Aucune demande pour le moment."
              : `${total} demande${total > 1 ? "s" : ""} au total.`}
          </p>
        </div>
      </div>

      <nav aria-label="Filtrer par état" className="mt-6">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          <li>
            <Filtre href="/administration" actif={filtre === undefined}>
              Toutes ({total})
            </Filtre>
          </li>
          {ETATS.map((element) => (
            <li key={element.valeur}>
              <Filtre
                href={`/administration?etat=${element.valeur}`}
                actif={filtre === element.valeur}
              >
                {element.libelle} ({comptes[element.valeur] ?? 0})
              </Filtre>
            </li>
          ))}
        </ul>
      </nav>

      {demandes.length === 0 ? (
        <div className="carte mt-8 p-8 text-center">
          <p className="m-0 font-semibold">
            {filtre === undefined
              ? "Aucune demande reçue."
              : `Aucune demande à l'état « ${libelleEtat(filtre)} ».`}
          </p>
          <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Les demandes déposées depuis{" "}
            <Link href="/etablissements" className="text-[color:var(--color-accent)]">
              la page établissements
            </Link>{" "}
            arrivent ici sans délai.
          </p>
        </div>
      ) : (
        <ul className="m-0 mt-8 list-none space-y-4 p-0">
          {demandes.map((demande) => (
            <li key={demande.id}>
              <FicheDemande demande={demande} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Filtre({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[length:var(--text-tableau)] no-underline ${
        actif
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
          : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] text-[color:var(--color-encre-faible)] hover:border-[color:var(--color-bordure-forte)]"
      }`}
    >
      {children}
    </Link>
  );
}

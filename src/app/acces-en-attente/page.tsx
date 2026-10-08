import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Hourglass, RefreshCw } from "lucide-react";
import { CarteAcces } from "@/components/study/CarteAcces";
import { Confirmer } from "@/components/study/Dialogue";
import { Etiquette, ICONE, dateLisible } from "@/components/study/ui";
import { pagePrivee } from "@/lib/metadonnees";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { versConnexion } from "@/lib/v6/redirection";
import { annulerDemande } from "./actions";

export const metadata: Metadata = pagePrivee({ titre: "Accès en attente", description: "Votre demande d'accès à une classe." });
export const dynamic = "force-dynamic";

/**
 * E34 — Accès en attente. Une demande ne donne pas encore accès à la classe :
 * aucun aperçu des cours, aucune liste de membres. « Actualiser » relit le
 * statut serveur ; un refus reste générique.
 */
export default async function PageAccesEnAttente({ searchParams }: { searchParams: Promise<{ envoyee?: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/acces-en-attente"));
  if (personne.activationRequise) redirect("/activation");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/acces-en-attente", "expiree"));
  const { envoyee } = await searchParams;

  const client = clientUtilisateur(jeton);
  const [demandes, contextes] = await Promise.all([client.rpc("classe_mes_demandes"), client.rpc("mes_contextes")]);
  const lignes = (demandes.data ?? []) as { id: string; classe: string; etat: string; demandee_le: string; decidee_le: string | null }[];
  const aDesClasses = ((contextes.data ?? []) as unknown[]).length > 0;
  const enAttente = lignes.filter((d) => d.etat === "en_attente");
  const acceptee = lignes.find((d) => d.etat === "acceptee");

  return (
    <CarteAcces
      titre={enAttente.length > 0 ? "Accès en attente" : aDesClasses ? "Votre accès est ouvert" : "Aucune classe pour l'instant"}
      sousTitre={
        enAttente.length > 0
          ? "Votre demande a bien été reçue. Elle sera examinée par votre professeur principal ou la vie scolaire."
          : aDesClasses
            ? "Votre demande a été acceptée : votre classe vous attend."
            : "Votre compte n'est encore rattaché à aucune classe active."
      }
      retour={null}
    >
      {envoyee === "1" ? (
        <p role="status" className="m-0 mb-4 rounded-[10px] bg-[color:var(--color-succes-fond)] p-3 text-[0.8125rem] font-medium text-[color:var(--color-succes)]">
          Demande envoyée.
        </p>
      ) : null}

      {enAttente.length > 0 ? (
        <div className="mb-5 flex items-center gap-4 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-accent)]" aria-hidden="true">
            <Hourglass size={24} strokeWidth={1.75} />
          </span>
          <p className="m-0 text-[0.9375rem]">
            <span className="block font-bold">En attente de validation</span>
            Tant que la demande n&apos;est pas validée, aucun cours ni membre de la classe n&apos;est visible. Actualise pour connaître la décision.
          </p>
        </div>
      ) : null}

      {lignes.length === 0 ? (
        <p className="m-0 text-[color:var(--color-encre-faible)]">
          Si votre professeur vous a donné un code de classe, saisissez-le. Sinon, la vie scolaire peut vous inscrire.
        </p>
      ) : (
        <ul className="m-0 mb-5 list-none p-0">
          {lignes.slice(0, 5).map((d) => (
            <li key={d.id} className="ligne">
              <Clock3 {...ICONE} className="shrink-0 text-[color:var(--color-encre-faible)]" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{d.classe}</span>
                <span className="meta">Demandée le {dateLisible(d.demandee_le, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              <Etiquette ton={d.etat === "en_attente" ? "attention" : d.etat === "acceptee" ? "succes" : "neutre"}>
                {d.etat === "en_attente" ? "En attente" : d.etat === "acceptee" ? "Acceptée" : d.etat === "annulee" ? "Annulée" : "Non retenue"}
              </Etiquette>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {aDesClasses || acceptee ? (
          <Link href="/app/bienvenue" className="bouton bouton-primaire">
            Découvrir mon espace
          </Link>
        ) : (
          <Link href="/acces-en-attente" className="bouton bouton-primaire">
            <RefreshCw {...ICONE} /> Actualiser
          </Link>
        )}
        <Link href="/rejoindre" className="bouton bouton-secondaire">
          Saisir un code
        </Link>
        {enAttente.map((d) => (
          <Confirmer
            key={d.id}
            declencheur={`Annuler la demande (${d.classe})`}
            variante="discret"
            titre="Annuler cette demande ?"
            impact={<p className="m-0">La demande pour {d.classe} sera retirée. Vous pourrez en faire une nouvelle avec un code valable.</p>}
          >
            <form action={annulerDemande}>
              <input type="hidden" name="demande" value={d.id} />
              <button type="submit" className="bouton bouton-danger">
                Annuler la demande
              </button>
            </form>
          </Confirmer>
        ))}
      </div>

      <form method="post" action="/deconnexion" className="mt-6 border-t border-[color:var(--color-bordure)] pt-4">
        <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] text-[color:var(--color-encre-faible)] underline">
          Se déconnecter
        </button>
      </form>
    </CarteAcces>
  );
}

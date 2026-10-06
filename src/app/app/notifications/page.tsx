import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { EnTetePage, EtatErreur, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { decrireNotification, notifications } from "@/lib/v6/eleve";
import { ouvrirNotification, toutLu } from "./actions";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * E29 — Notifications regroupées par sujet, lues ou non. Ouvrir passe par une
 * action qui marque lu (idempotent) puis mène à l'objet, dont les droits
 * sont revérifiés à l'ouverture : un objet retiré affiche « pas accessible ».
 * Aucune notification ne recopie de texte de message.
 */
export default async function PageNotifications({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const ctx = await contexteApp();
  const { filtre } = await searchParams;
  const nonLues = filtre === "non-lues";
  const liste = await notifications(ctx.jeton, { limite: 100, nonLuesSeulement: nonLues });
  const parSujet = new Map<string, NonNullable<typeof liste>>();
  for (const n of liste ?? []) {
    const sujet = decrireNotification(n).sujet;
    parSujet.set(sujet, [...(parSujet.get(sujet) ?? []), n]);
  }

  return (
    <div className="mx-auto max-w-[820px]">
      <EnTetePage
        titre="Notifications"
        actions={
          <>
            <Link href={nonLues ? "/app/notifications" : "/app/notifications?filtre=non-lues"} className="bouton bouton-secondaire">
              {nonLues ? "Tout afficher" : "Non lues seulement"}
            </Link>
            <form action={toutLu}>
              <button type="submit" className="bouton bouton-secondaire">
                Tout marquer comme lu
              </button>
            </form>
            <Link href="/app/reglages#notifications" className="bouton bouton-discret" aria-label="Préférences de notification">
              <Settings {...ICONE} />
            </Link>
          </>
        }
      />
      {liste === null ? (
        <EtatErreur requestId={idRequete()} />
      ) : liste.length === 0 ? (
        <EtatVide icone={Bell} titre={nonLues ? "Tout est lu" : "Aucune notification"} texte="Tu seras prévenu ici des nouveaux cours, des réponses à tes messages, des consultations et de tes fiches prêtes." />
      ) : (
        <div className="grid gap-6">
          {[...parSujet.entries()].map(([sujet, items]) => (
            <Panneau key={sujet} titre={sujet}>
              <ul className="m-0 list-none p-0">
                {items.map((n) => {
                  const d = decrireNotification(n);
                  return (
                    <li key={n.id} className="ligne">
                      {n.luLe === null ? <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-accent)]" aria-label="Non lue" /> : <span className="w-2 shrink-0" />}
                      <form action={ouvrirNotification} className="min-w-0 flex-1">
                        <input type="hidden" name="notification" value={n.id} />
                        <input type="hidden" name="lien" value={d.lien} />
                        <button type="submit" className="w-full cursor-pointer border-0 bg-transparent p-0 text-left">
                          <span className={`block ${n.luLe === null ? "font-semibold" : ""}`}>{d.titre}</span>
                          <span className="meta">{dateLisible(n.survenuLe, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </Panneau>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { CopiesLocales } from "@/components/study/HorsLigne";
import { EnTetePage, ICONE, Panneau } from "@/components/study/ui";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { FormulairePreferences } from "./FormulairePreferences";

export const metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

/**
 * E28 — Réglages : alertes et horaires calmes, copies locales, sécurité et
 * confidentialité. Se déconnecter n'est pas supprimer son compte : les deux
 * gestes sont séparés et nommés.
 */
export default async function PageReglages() {
  const ctx = await contexteApp();
  const { data } = await clientUtilisateur(ctx.jeton)
    .from("preferences_notifications")
    .select("categories, calme_debut, calme_fin, copies_locales")
    .maybeSingle();
  const p = (data ?? {}) as { categories?: Record<string, boolean>; calme_debut?: string; calme_fin?: string; copies_locales?: boolean };

  return (
    <div className="mx-auto max-w-[820px]">
      <EnTetePage titre="Réglages" sousTitre={`${ctx.personne.prenom} ${ctx.personne.nom}${ctx.personne.organisation ? ` · ${ctx.personne.organisation}` : ""}`} />
      <div className="grid gap-6">
        <Panneau id="notifications" titre="Notifications">
          <FormulairePreferences
            initiales={{
              categories: p.categories ?? { travail: true, classe: true, messages: true, revisions: true },
              calme_debut: p.calme_debut ?? "21:00",
              calme_fin: p.calme_fin ?? "07:00",
              copies_locales: p.copies_locales ?? false,
            }}
            appareilPartage={ctx.personne.appareil === "partage"}
          />
        </Panneau>

        <Panneau id="appareil" titre="Copies sur cet appareil">
          {ctx.copiesLocales ? (
            <CopiesLocales />
          ) : (
            <p className="m-0 text-[color:var(--color-encre-faible)]">
              Les copies hors ligne sont désactivées sur cet appareil. Active-les ci-dessus pour garder une séance lisible sans réseau.
            </p>
          )}
        </Panneau>

        <Panneau id="securite" titre="Sécurité">
          <div className="flex flex-wrap gap-2">
            <Link href="/parametres" className="bouton bouton-secondaire">
              <KeyRound {...ICONE} /> Mot de passe et sessions
            </Link>
            {ctx.roles.admin || ctx.roles.professeur ? (
              <Link href="/second-facteur" className="bouton bouton-secondaire">
                <ShieldCheck {...ICONE} /> Double authentification
              </Link>
            ) : null}
            <form action={seDeconnecter}>
              <button type="submit" className="bouton bouton-discret">
                Se déconnecter de cet appareil
              </button>
            </form>
          </div>
        </Panneau>

        <Panneau id="donnees" titre="Mes données">
          <ul className="m-0 grid gap-2 pl-5">
            <li>
              <a href="/app/erreurs/export">Exporter mon carnet d&apos;erreurs (CSV)</a>
            </li>
            <li>Tes notes, fiches, carnet et projets personnels ne sont lus ni par tes professeurs ni par l&apos;administration.</li>
            <li>
              Les messages des salons ne sont pas chiffrés de bout en bout : ils sont conservés par l&apos;établissement et lisibles par la
              modération en cas de signalement.
            </li>
            <li>
              La suppression d&apos;un compte se demande à l&apos;établissement, qui vérifie l&apos;identité et les obligations de conservation.
              Ce n&apos;est pas la même chose que se déconnecter.
            </li>
          </ul>
          <Link href="/confidentialite" className="meta mt-3 inline-block">
            Politique de confidentialité
          </Link>
        </Panneau>
      </div>
    </div>
  );
}

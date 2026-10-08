import Link from "next/link";
import { Building2, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { CopiesLocales } from "@/components/study/HorsLigne";
import { PreferencesMouvement } from "@/components/study/PreferencesMouvement";
import { EnTetePage, ICONE, OngletsLiens, Panneau } from "@/components/study/ui";
import type { ContexteApp } from "@/lib/v6/contexte";
import { FormulairePreferences } from "./FormulairePreferences";

export const ONGLETS = [
  { cle: "compte", libelle: "Mon compte" },
  { cle: "affichage", libelle: "Notifications et affichage" },
  { cle: "sessions", libelle: "Sessions" },
  { cle: "donnees", libelle: "Confidentialité" },
] as const;

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueReglages({ onglet, ctx, p, initiales, role }: {
  onglet: string;
  ctx: ContexteApp;
  p: { categories?: Record<string, boolean>; calme_debut?: string; calme_fin?: string; copies_locales?: boolean };
  initiales: string;
  role: string;
}) {
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage sourcil="Réglages" titre="Paramètres" sousTitre="Personnalise ton expérience de Study." />
      <OngletsLiens etiquette="Sections des réglages" onglets={ONGLETS.map((o) => ({ href: o.cle === "compte" ? "/app/reglages" : `/app/reglages?onglet=${o.cle}`, libelle: o.libelle, actif: o.cle === onglet }))} />

      {onglet === "compte" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panneau flex items-center gap-4" aria-label="Profil">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[color:var(--color-rose-clair)] text-[1.25rem] font-extrabold text-[color:var(--color-accent)]" aria-hidden="true">
              {initiales}
            </span>
            <span className="min-w-0">
              <span className="titre-bloc block font-bold">
                {ctx.personne.prenom} {ctx.personne.nom}
              </span>
              <span className="meta block">
                {role}
                {ctx.classeActive ? ` · ${ctx.classeActive.libelle}` : ""}
              </span>
            </span>
          </section>
          <section className="panneau flex items-center gap-4" aria-label="Établissement">
            <span className="tuile tuile-grande" aria-hidden="true">
              <Building2 size={22} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{ctx.personne.organisation ?? "Établissement"}</span>
              <span className="meta block">Ton compte est géré par ton établissement : nom et classe s&apos;y modifient.</span>
            </span>
          </section>
          <Panneau titre="Sécurité" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Link href="/parametres" className="bouton bouton-secondaire">
                <KeyRound {...ICONE} /> Mot de passe et sessions
              </Link>
              {ctx.roles.admin || ctx.roles.professeur ? (
                <Link href="/second-facteur" className="bouton bouton-secondaire">
                  <ShieldCheck {...ICONE} /> Double authentification
                </Link>
              ) : null}
            </div>
          </Panneau>
        </div>
      ) : null}

      {onglet === "affichage" ? (
        <div className="grid gap-4 md:grid-cols-2">
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
          <div className="grid content-start gap-4">
            <Panneau id="effets" titre="Accessibilité">
              <PreferencesMouvement />
            </Panneau>
            <Panneau id="appareil" titre="Copies sur cet appareil">
              {ctx.copiesLocales ? (
                <CopiesLocales />
              ) : (
                <p className="m-0 text-[color:var(--color-encre-faible)]">
                  Les copies hors ligne sont désactivées sur cet appareil. Active-les dans les notifications pour garder une séance lisible sans réseau.
                </p>
              )}
            </Panneau>
          </div>
        </div>
      ) : null}

      {onglet === "sessions" ? (
        <Panneau id="securite" titre="Sessions actives">
          <p className="m-0 text-[color:var(--color-encre-faible)]">
            Sur ordinateur partagé, la session se ferme à la fermeture du navigateur ou après 30 minutes sans activité (8 heures au plus). Sur ton appareil, après 2 heures sans
            activité (12 heures au plus). À la déconnexion, les brouillons et copies de Study enregistrés dans ce navigateur sont effacés ; les fichiers téléchargés restent dans
            ton dossier de téléchargements.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form method="post" action="/deconnexion">
              <button type="submit" className="bouton bouton-primaire">
                <LogOut {...ICONE} /> Se déconnecter de cet appareil
              </button>
            </form>
            <form method="post" action="/deconnexion">
              <input type="hidden" name="partout" value="oui" />
              <button type="submit" className="bouton bouton-secondaire">
                Se déconnecter de tous mes appareils
              </button>
            </form>
          </div>
        </Panneau>
      ) : null}

      {onglet === "donnees" ? (
        <Panneau id="donnees" titre="Mes données">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] bg-[color:var(--color-rose-clair)] p-4">
            <p className="m-0 min-w-0 flex-1 text-[0.9375rem]">
              <span className="block font-bold">Télécharger toutes mes données</span>
              Un fichier JSON (format ouvert) : profil, classes, copies et appréciations reçues, notes, messages écrits, révisions, projets, orientation, demandes.
            </p>
            <a href="/app/reglages/export" className="bouton bouton-primaire" download>
              Télécharger (JSON)
            </a>
          </div>
          <ul className="m-0 grid gap-2 pl-5">
            <li>
              <a href="/app/erreurs/export">Exporter mon carnet d&apos;erreurs (CSV)</a>
            </li>
            <li>Tes notes, fiches, carnet et projets personnels ne sont lus ni par tes professeurs ni par l&apos;administration.</li>
            <li>
              Les messages des salons ne sont pas chiffrés de bout en bout : ils sont conservés par l&apos;établissement et lisibles par la modération en cas de signalement.
            </li>
            <li>
              La suppression d&apos;un compte se demande à l&apos;établissement, qui vérifie l&apos;identité et les obligations de conservation. Ce n&apos;est pas la même chose que se
              déconnecter.
            </li>
          </ul>
          <Link href="/confidentialite" className="meta mt-3 inline-block">
            Politique de confidentialité
          </Link>
        </Panneau>
      ) : null}
    </div>
  );
}

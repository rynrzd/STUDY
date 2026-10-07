import type { Metadata } from "next";
import Link from "next/link";
import { pagePublique } from "@/lib/metadonnees";
import { ExempleCours, ExempleEchange, ExempleMatieres, ExemplePublication } from "@/components/site/Exemples";
import { Faq } from "@/components/site/Onglets";

export const metadata: Metadata = pagePublique({
  chemin: "/",
  titre: "Ta classe, tout simplement",
  description: "Tes cours, le travail à faire et les échanges de ta classe, au même endroit. Une plateforme pédagogique pour les lycées, financée par l'établissement.",
});

/**
 * Landing R2 — cahier « refonte complète, sans 3D », §04 (L01 à L08).
 *
 * Un seul hero, le produit au premier plan, contenu visible dès le premier
 * rendu et complet sans script. Les exemples sont nommés comme tels ; aucune
 * statistique, aucun témoignage. Fonds alternés : gris clair, blanc, blush,
 * blanc, rose très clair, blanc, baie.
 */

function Surtitre({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-[color:var(--color-accent)]">{children}</p>;
}

function TitreSection({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="m-0 mt-3 text-[length:var(--text-h2-mobile)] font-extrabold leading-[var(--text-h2-mobile--line-height)] tracking-[-0.035em] md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]"
    >
      {children}
    </h2>
  );
}

function Texte({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-4 max-w-[52ch] text-[1.0625rem] leading-[1.7] text-[color:var(--color-encre-faible)] md:text-[1.125rem]">{children}</p>;
}

export default function PageAccueil() {
  return (
    <main id="contenu">
      {/* -- L02 — Hero unique ------------------------------------------------ */}
      <section aria-labelledby="hero-titre" className="pb-14 pt-10 md:pb-24 md:pt-20">
        <div className="contenu-site grid items-center gap-10 lg:grid-cols-[5fr_7fr] lg:gap-12">
          <div>
            <Surtitre>L&apos;espace de ta classe</Surtitre>
            <h1
              id="hero-titre"
              className="m-0 mt-4 text-[length:var(--text-h1-etroit)] font-extrabold leading-[var(--text-h1-etroit--line-height)] tracking-[-0.045em] min-[390px]:text-[length:var(--text-h1-mobile)] min-[390px]:leading-[var(--text-h1-mobile--line-height)] lg:text-[length:var(--text-h1)] lg:leading-[var(--text-h1--line-height)]"
            >
              Ta classe, <span className="text-[color:var(--color-accent)]">tout simplement.</span>
            </h1>
            <p className="m-0 mt-5 max-w-[40ch] text-[1.125rem] leading-[1.65] text-[color:var(--color-encre-faible)] md:text-[1.25rem]">
              Tes cours, le travail à faire et les échanges de ta classe. Enfin au même endroit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#decouvrir" className="bouton bouton-primaire bouton-grand">
                Découvrir Study
              </a>
              <Link href="/connexion" className="bouton bouton-secondaire bouton-grand">
                Se connecter
              </Link>
            </div>
          </div>
          <ExempleCours />
        </div>
      </section>

      {/* -- L03 — Retrouver un cours ------------------------------------------ */}
      <section id="decouvrir" aria-labelledby="titre-retrouver" className="bande-blanche scroll-mt-20 py-14 md:py-24">
        <div className="contenu-site grid items-center gap-10 lg:grid-cols-[4fr_8fr] lg:gap-16">
          <div>
            <Surtitre>01 / Retrouver</Surtitre>
            <TitreSection id="titre-retrouver">Le bon cours. Au bon moment.</TitreSection>
            <Texte>Retrouve la séance, ses documents et le travail à faire sans chercher dans plusieurs endroits.</Texte>
            <p className="m-0 mt-6">
              <Link href="/produit" className="lien-fleche">
                Découvrir les cours <span aria-hidden="true" className="fleche">→</span>
              </Link>
            </p>
          </div>
          <ExempleMatieres />
        </div>
      </section>

      {/* -- L04 — Échanger avec sa classe ------------------------------------- */}
      <section aria-labelledby="titre-echanger" className="py-14 md:py-24">
        <div className="contenu-site">
          <div className="grid items-center gap-10 rounded-[var(--radius-grand)] bg-[color:var(--color-rose-clair)] p-6 sm:p-10 lg:grid-cols-[5fr_7fr] lg:gap-14 lg:p-14">
            <div>
              <Surtitre>02 / Échanger</Surtitre>
              <TitreSection id="titre-echanger">Une question ne devrait pas te bloquer.</TitreSection>
              <Texte>Un espace commun avec ta classe et ton professeur, pour poser une question et retrouver les réponses.</Texte>
            </div>
            <ExempleEchange />
          </div>
        </div>
      </section>

      {/* -- L05 — Professeurs : visuel à gauche, texte à droite ---------------- */}
      <section aria-labelledby="titre-transmettre" className="bande-blanche py-14 md:py-24">
        <div className="contenu-site grid items-center gap-10 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div className="lg:order-2">
            <Surtitre>03 / Transmettre</Surtitre>
            <TitreSection id="titre-transmettre">Préparez une fois. Partagez à la bonne classe.</TitreSection>
            <Texte>Organisez la séance, ajoutez les supports et publiez le travail dans l&apos;espace de vos élèves.</Texte>
            <p className="m-0 mt-6">
              <Link href="/produit" className="lien-fleche">
                Voir l&apos;espace professeur <span aria-hidden="true" className="fleche">→</span>
              </Link>
            </p>
          </div>
          <div className="lg:order-1">
            <ExemplePublication />
          </div>
        </div>
      </section>

      {/* -- L06 — Établissements -------------------------------------------- */}
      <section aria-labelledby="titre-etablissement" className="bande-douce py-14 md:py-24">
        <div className="contenu-site">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <TitreSection id="titre-etablissement">Votre établissement, simplement.</TitreSection>
            <Link href="/etablissements" className="bouton bouton-primaire bouton-grand">
              Pour mon établissement
            </Link>
          </div>
          <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
            {[
              ["Importer la liste", "Chargez le fichier de rentrée (CSV ou Excel) : chaque ligne est lue avant toute création de compte."],
              ["Vérifier les classes", "Corrigez les lignes signalées et les doublons dans un aperçu, puis confirmez."],
              ["Préparer les accès", "Chaque élève reçoit son identifiant d'établissement et un lien d'activation remis par vos équipes."],
            ].map(([titre, texte], i) => (
              <li key={titre} className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-rose-clair)] text-[1rem] font-extrabold text-[color:var(--color-accent)]" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="m-0 mt-4 text-[1.1875rem] font-extrabold">{titre}</h3>
                <p className="m-0 mt-2 text-[1rem] text-[color:var(--color-encre-faible)]">{texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -- L07 — FAQ -------------------------------------------------------- */}
      <section aria-labelledby="titre-faq" className="bande-blanche py-14 md:py-24">
        <div className="contenu-site grid gap-8 lg:grid-cols-[4fr_8fr] lg:gap-16">
          <TitreSection id="titre-faq">Les questions qu&apos;on nous pose.</TitreSection>
          <Faq
            questions={[
              {
                question: "Faut-il un ordinateur par élève ?",
                reponse: "Non. La projection en classe et le travail sur papier sont prévus ; le cours se consulte ensuite sur n'importe quel appareil, y compris un téléphone.",
              },
              {
                question: "Qui finance Study ?",
                reponse: "L'établissement, sur devis. Aucun achat par les familles, aucun abonnement élève, aucune publicité.",
              },
              {
                question: "Comment démarrer ?",
                reponse: "Un échange sur vos besoins, la configuration de votre espace, puis l'import de vos classes depuis votre fichier de rentrée.",
              },
            ]}
          />
        </div>
      </section>

      {/* -- L08 — Conclusion ------------------------------------------------- */}
      <section aria-labelledby="titre-conclusion" className="bande-baie py-14 md:py-20">
        <div className="contenu-site flex flex-wrap items-center justify-between gap-8">
          <h2 id="titre-conclusion" className="m-0 max-w-[18ch] text-[length:var(--text-h2-mobile)] font-extrabold leading-[var(--text-h2-mobile--line-height)] tracking-[-0.035em] text-white md:text-[length:var(--text-h2-large)] md:leading-[var(--text-h2-large--line-height)]">
            Une classe qui avance ensemble.
          </h2>
          <div className="grid gap-3">
            <Link href="/contact" className="bouton bouton-clair bouton-grand">
              Demander une démonstration
            </Link>
            <Link href="/connexion" className="inline-flex min-h-[44px] items-center justify-center text-[1rem] font-semibold text-white underline-offset-4 hover:underline">
              Déjà un accès ? Se connecter
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

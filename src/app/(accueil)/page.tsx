import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesCombined, FileText } from "lucide-react";
import { pagePublique } from "@/lib/metadonnees";
import s from "./accueil.module.css";
import { MenuMobile } from "./MenuMobile";

export const metadata: Metadata = pagePublique({
  chemin: "/",
  titre: "Ta classe, tout simplement",
  description: "Tes cours, le travail à faire et les échanges de ta classe, au même endroit. Une plateforme pédagogique pour les lycées, financée par l'établissement.",
});

/** Landing : présentation bureau R2 et composition mobile éditoriale. */
export default function Accueil() {
  return (
    <div className={s.page}>
      <header className={`${s.wrap} ${s.topbar}`}>
        <Link className={s.brand} href="/">
          study<span>.</span>
        </Link>
        <nav className={s.nav} aria-label="Navigation principale">
          <Link className={s.desktop} href="/produit">
            La plateforme
          </Link>
          <Link className={s.desktop} href="/etablissements">
            Établissements
          </Link>
          <Link href="/connexion">Se connecter</Link>
          <Link className={`${s.button} ${s.desktop}`} href="/contact">
            Demander une démo
          </Link>
          <MenuMobile />
        </nav>
      </header>

      <main id="contenu">
        <section className={`${s.section} ${s.wrap} ${s.split} ${s.hero}`}>
          <div className={s.copy}>
            <p className={`${s.mobileOnly} ${s.eyebrow}`}>La classe continue ici</p>
            <h1>
              <span className={s.desktopOnly}>Ta classe,<br /><span className={s.primaryText}>tout simplement.</span></span>
              <span className={s.mobileOnly}>Le cours se termine.<br /><span className={s.primaryText}>L’apprentissage continue.</span></span>
            </h1>
            <p><span className={s.desktopOnly}>Tes cours, le travail à faire et les échanges de ta classe. Enfin au même endroit.</span><span className={s.mobileOnly}>Tes cours, tes révisions et ta classe. Un même endroit pour avancer.</span></p>
            <div className={s.actions}>
              <a className={s.button} href="#decouvrir">
                Découvrir Study <ArrowRight className={s.mobileOnly} size={20} aria-hidden="true" />
              </a>
              <Link className={`${s.button} ${s.secondary}`} href="/connexion">
                Se connecter
              </Link>
            </div>
          </div>
          <figure className={`${s.mobileOnly} ${s.mobilePreview}`} aria-label="Aperçu illustratif des cours">
            <h2>À toi de jouer.</h2>
            <div className={s.mobileCourse}>
              <div className={s.courseTitle}><span className={s.courseIcon}><ChartNoAxesCombined size={25} aria-hidden="true" /></span><div><p>Mathématiques</p><h3>Fonctions affines</h3></div></div>
              <Link href="/produit#cours" className={s.resumeCourse}><BookOpen size={20} aria-hidden="true" /> Découvrir les cours <ArrowRight size={17} aria-hidden="true" /></Link>
              <div className={s.homework}><FileText size={22} aria-hidden="true" /><div><strong>Exercices 1 à 3</strong><p>Pour demain</p></div></div>
            </div>
            <div className={s.notebook} aria-hidden="true"><span>Un cours. Un déclic.</span><span>f(x) = ax + b</span><svg viewBox="0 0 160 60" fill="none"><path d="M8 50H152M22 58V5" stroke="currentColor" strokeWidth="1.5"/><path d="M28 46L140 10" stroke="currentColor" strokeWidth="2.5"/></svg></div>
            <figcaption>Exemple illustratif · aucune donnée réelle</figcaption>
          </figure>
          <div className={`${s.panel} ${s.rose} ${s.stack} ${s.desktopOnly}`}>
            <div className={`${s.card} ${s.stack}`}>
              <p className={s.eyebrow}>Mathématiques · Seconde</p>
              <h2 style={{ fontSize: 28 }}>Fonctions affines</h2>
              <div className={s.row}>
                Cours <span className={s.muted}>/ Exercices / Documents</span>
              </div>
              <h3>Reconnaître une fonction affine</h3>
              <p>
                Une fonction affine s’écrit <strong>f(x) = ax + b</strong>.
              </p>
              <div className={`${s.panel} ${s.blush}`}>
                <p>
                  Exemple : f(x) = 2x + 1.
                  <br />
                  Pour x = 3, f(3) = 7.
                </p>
              </div>
              <p className={s.row}>À faire · Exercices 1 à 3</p>
            </div>
            <p className={s.sample}>Exemple illustratif de l’interface</p>
          </div>
        </section>

        <section id="decouvrir" className={`${s.section} ${s.white}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.copy}>
              <h2>
                <span className={s.desktopOnly}>Le bon cours.<br />Au bon moment.</span>
                <span className={s.mobileOnly}>Moins chercher.<br /><span className={s.primaryText}>Mieux avancer.</span></span>
              </h2>
              <p>Retrouve les ressources partagées par tes professeurs, les consignes et les documents de ta classe.</p>
              <p className={`${s.mobileOnly} ${s.brandStory}`}>Study rapproche les moments où tu apprends : en classe, à la maison, et quand une question te bloque.</p>
              <Link href="/produit">Découvrir les cours →</Link>
            </div>
            <div className={`${s.card} ${s.stack}`}>
              <p className={s.eyebrow}>Un cours bien organisé</p>
              <h3>Fonctions affines</h3>
              <p className={s.row}>01 · Comprendre la définition</p>
              <p className={s.row}>02 · Lire une représentation graphique</p>
              <p className={s.row}>03 · S’entraîner avec les exercices</p>
              <p className={s.sample}>Exemple illustratif</p>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.blush}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.copy}>
              <h2>Une question ne devrait pas te bloquer.</h2>
              <p>Un espace commun pour échanger avec ta classe et ton professeur, autour des cours et du travail à faire.</p>
            </div>
            <div className={s.stack}>
              <div className={s.card}>
                <strong>Lina · Élève</strong>
                <p>Je ne comprends pas pourquoi on remplace x par 3 dans cet exemple.</p>
              </div>
              <div className={s.card}>
                <strong>Mme Bernard · Professeure</strong>
                <p>On cherche l’image de 3. On calcule donc f(3) = 2 × 3 + 1 = 7.</p>
              </div>
              <p className={s.sample}>Échange illustratif · salon collectif de classe</p>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.wrap}`}>
          <div className={s.copy} style={{ marginBottom: 36 }}>
            <p className={s.eyebrow}>Pour les professeurs</p>
            <h2>
              Préparez une fois.
              <br />
              Partagez à la bonne classe.
            </h2>
            <p>Composez votre contenu, choisissez ses destinataires et publiez votre séance.</p>
          </div>
          <div className={s.steps}>
            <article className={s.card}>
              <span className={s.number}>1</span>
              <h3>Préparer</h3>
              <p>Le cours, les ressources et les consignes.</p>
            </article>
            <article className={s.card}>
              <span className={s.number}>2</span>
              <h3>Choisir la classe</h3>
              <p>Vérifier les destinataires avant publication.</p>
            </article>
            <article className={s.card}>
              <span className={s.number}>3</span>
              <h3>Publier</h3>
              <p>Rendre la séance accessible à la classe.</p>
            </article>
          </div>
        </section>

        <section className={`${s.section} ${s.roseLight}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.copy}>
              <h2>Votre établissement, simplement.</h2>
              <p>Organisez les classes et préparez les accès de vos équipes et de vos élèves.</p>
              <Link href="/etablissements">Voir la mise en place →</Link>
            </div>
            <div className={s.stack}>
              <div className={s.row}>
                <strong>01 · Importer</strong>
                <p>Charger les listes dans le format accepté.</p>
              </div>
              <div className={s.row}>
                <strong>02 · Vérifier</strong>
                <p>Corriger les erreurs et les doublons.</p>
              </div>
              <div className={s.row}>
                <strong>03 · Préparer les accès</strong>
                <p>Distribuer les invitations selon votre procédure.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.wrap} ${s.split}`}>
          <h2>Questions fréquentes</h2>
          <div>
            <details name="faq">
              <summary>Faut-il un ordinateur par élève ?</summary>
              <p>Non. La projection en classe et le travail sur papier sont prévus ; le cours se consulte ensuite sur n’importe quel appareil, y compris un téléphone.</p>
            </details>
            <details name="faq">
              <summary>Qui finance la plateforme ?</summary>
              <p>L’établissement, sur devis. Aucun achat par les familles, aucun abonnement élève, aucune publicité.</p>
            </details>
            <details name="faq">
              <summary>Comment installer Study dans mon lycée ?</summary>
              <p>
                <Link href="/contact">Contactez l’équipe</Link> pour présenter vos besoins et préparer la mise en place.
              </p>
            </details>
          </div>
        </section>

        <section className={`${s.section} ${s.cta}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.copy}>
              <h2>Une classe qui avance ensemble.</h2>
              <p>Parlons de votre établissement.</p>
            </div>
            <div>
              <Link className={s.button} href="/contact">
                Demander une démonstration →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <Link className={s.brand} href="/">
            study<span>.</span>
          </Link>
          <Link href="/produit">Produit</Link>
          <Link href="/offre">Offre</Link>
          <Link href="/securite">Sécurité et données</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </div>
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesCombined, Check, FileText, Flame, Landmark, Languages, TriangleAlert } from "lucide-react";
import { pagePublique } from "@/lib/metadonnees";
import s from "./accueil.module.css";
import { MenuMobile } from "./MenuMobile";

export const metadata: Metadata = pagePublique({
  chemin: "/",
  titre: "Ta classe, tout simplement",
  description: "Tes cours, le travail à faire et les échanges de ta classe, au même endroit. Une plateforme pédagogique pour les lycées, financée par l'établissement.",
});

const COURS = [
  { matiere: "Mathématiques", chapitre: "Fonctions affines", seances: "3 séances · exercices", avance: 66, icone: ChartNoAxesCombined },
  { matiere: "Histoire-géographie", chapitre: "L’urbanisation", seances: "2 séances · documents", avance: 40, icone: Landmark },
  { matiere: "Anglais", chapitre: "Present perfect", seances: "1 séance · audio", avance: 20, icone: Languages },
] as const;

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
            <div className={s.phone} aria-hidden="true">
              <div className={s.phoneScreen}>
                <div className={s.phoneBar}>
                  <span className={s.phoneBrand}>study<span>.</span></span>
                  <span className={s.phoneDots}><i /><i /><i /></span>
                </div>
                <div className={s.phoneBody}>
                  <p className={s.phoneHello}>Mardi · Seconde 2</p>
                  <div className={s.mobileCourse}>
                    <div className={s.courseTitle}><span className={s.courseIcon}><ChartNoAxesCombined size={24} aria-hidden="true" /></span><div><p>Mathématiques</p><h3>Fonctions affines</h3></div></div>
                    <div className={s.resumeCourse}><BookOpen size={19} aria-hidden="true" /> Reprendre le cours <ArrowRight size={16} aria-hidden="true" /></div>
                    <div className={s.homework}><FileText size={21} aria-hidden="true" /><div><strong>Exercices 1 à 3</strong><p>Pour demain</p></div></div>
                  </div>
                  <div className={s.phoneChip}><span className={s.phoneTick}>✓</span> Révision du jour · 5 min</div>
                </div>
              </div>
            </div>
            <div className={`${s.flottant} ${s.flottantHaut}`} aria-hidden="true">
              <span className={s.flottantIcone}><Check size={14} strokeWidth={3} /></span>
              <span><strong>Bonne réponse !</strong><br />Trouvée sans indice</span>
            </div>
            <div className={`${s.flottant} ${s.flottantBas}`} aria-hidden="true">
              <span className={`${s.flottantIcone} ${s.flottantFlamme}`}><Flame size={14} strokeWidth={2.4} fill="currentColor" /></span>
              <span><strong>4 jours</strong><br />d’entraînement cette semaine</span>
            </div>
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
            <div className={`${s.mobileOnly} ${s.pileZone}`}>
              <div className={s.pile}>
                {COURS.map((c, i) => (
                  <article key={c.matiere} className={s.carteCours} style={{ "--i": i } as React.CSSProperties}>
                    <span className={s.carteIcone} data-teinte={i}>
                      <c.icone size={22} aria-hidden="true" />
                    </span>
                    <div className={s.carteTexte}>
                      <p>{c.matiere}</p>
                      <h3>{c.chapitre}</h3>
                      <span className={s.carteMeta}>{c.seances}</span>
                    </div>
                    <span className={s.carteBarre} aria-hidden="true"><i style={{ width: `${c.avance}%` }} /></span>
                  </article>
                ))}
              </div>
              <p className={s.sample}>Exemple illustratif</p>
            </div>
            <div className={`${s.card} ${s.stack} ${s.desktopOnly}`}>
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
            <div className={`${s.stack} ${s.desktopOnly}`}>
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
            <div className={`${s.chat} ${s.mobileOnly}`} aria-hidden="true">
              <div className={s.chatMeta}>Salon de la classe · Mathématiques</div>
              <div className={s.bubbleRow}>
                <span className={s.avatar}>L</span>
                <div className={s.bubble}>
                  <strong>Lina</strong>
                  <p>Je ne comprends pas pourquoi on remplace x par 3 ici.</p>
                </div>
              </div>
              <div className={`${s.bubbleRow} ${s.fromProf}`}>
                <div className={`${s.bubble} ${s.bubbleProf}`}>
                  <strong>Mme Bernard · Professeure</strong>
                  <p>On cherche l’image de 3. Donc f(3) = 2 × 3 + 1 = 7.</p>
                </div>
              </div>
              <div className={s.chatReacts}><span>👍 4</span><span className={s.chatSame}>J’avais la même question</span></div>
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
              <span className={`${s.mobileOnly} ${s.illu} ${s.illuDoc}`} aria-hidden="true"><b /><i /><i /><i /></span>
            </article>
            <article className={s.card}>
              <span className={s.number}>2</span>
              <h3>Choisir la classe</h3>
              <p>Vérifier les destinataires avant publication.</p>
              <span className={`${s.mobileOnly} ${s.illu} ${s.illuClasses}`} aria-hidden="true"><b data-choisie="oui">Seconde 2 ✓</b><b>Première 3</b></span>
            </article>
            <article className={s.card}>
              <span className={s.number}>3</span>
              <h3>Publier</h3>
              <p>Rendre la séance accessible à la classe.</p>
              <span className={`${s.mobileOnly} ${s.illu} ${s.illuPublier}`} aria-hidden="true"><i /><b>Publiée</b></span>
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
              <div className={`${s.mobileOnly} ${s.carteImport}`} aria-hidden="true">
                <p className={s.importTitre}>Import · Seconde 2 <span>liste.csv</span></p>
                <ul>
                  <li><span>Camille D.</span><Check size={15} strokeWidth={2.6} /></li>
                  <li><span>Hugo F.</span><Check size={15} strokeWidth={2.6} /></li>
                  <li data-alerte="oui"><span>Lina B. · doublon</span><TriangleAlert size={15} strokeWidth={2.2} /></li>
                </ul>
                <p className={s.importPied}><strong>32 élèves</strong> · 1 doublon à corriger</p>
              </div>
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

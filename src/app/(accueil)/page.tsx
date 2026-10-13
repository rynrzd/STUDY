import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesCombined, Check, FileText, Flame, Landmark, Languages, MessageCircle, Users, Upload, Plus, ShieldCheck } from "lucide-react";
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

        <div className={s.lowerLanding}>
          <section className={`${s.wrap} ${s.conversationSection}`}>
            <div className={s.lowerCopy}>
              <p className={s.lowerEyebrow}><MessageCircle size={16} aria-hidden="true" /> Apprendre ensemble</p>
              <h2>Une question ne devrait pas te bloquer.</h2>
              <p>Le cours reste ouvert à la discussion. Pose ta question dans le salon de ta classe et retrouve les explications de ton professeur.</p>
              <Link className={s.textLink} href="/produit">Découvrir les échanges <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
            <figure className={s.conversationFigure}>
              <div className={s.conversationWindow}>
                <div className={s.windowHeading}><span className={s.windowIcon}><MessageCircle size={21} aria-hidden="true" /></span><div><strong>Le salon de la classe</strong><span>Seconde 2 · Mathématiques</span></div></div>
                <div className={s.messages}>
                  <p className={s.messageDay}>Autour du cours · Fonctions affines</p>
                  <div className={s.message}><span className={s.personAvatar} aria-hidden="true">L</span><div><strong>Lina <span>Élève</span></strong><p>Pourquoi on remplace x par 3 dans cet exemple ?</p></div></div>
                  <div className={`${s.message} ${s.teacherMessage}`}><span className={s.personAvatar} aria-hidden="true">B</span><div><strong>Mme Bernard <span>Professeure</span></strong><p>On cherche l’image de 3. On calcule donc :</p><div className={s.formula}>f(3) = 2 × 3 + 1 = <b>7</b></div></div></div>
                  <div className={s.message}><span className={s.personAvatar} aria-hidden="true">L</span><div><strong>Lina</strong><p>D’accord, merci !</p></div></div>
                </div>
              </div>
              <figcaption>Échange illustratif · salon collectif de classe</figcaption>
            </figure>
          </section>

          <section className={`${s.wrap} ${s.teacherSection}`}>
            <div className={s.teacherIntro}>
              <div className={s.lowerCopy}>
                <p className={s.lowerEyebrow}>Pour les professeurs</p>
                <h2>Préparez une fois.<br /><span>Partagez à la bonne classe.</span></h2>
              </div>
              <p>Vos documents deviennent le point de départ. Ajoutez vos consignes, choisissez une classe ou un groupe et publiez.</p>
            </div>
            <div className={s.studioFeature}>
              <div className={s.workflow}>
                <div><span>01</span><div><h3>Préparer</h3><p>Rassemblez le cours, les documents et les exercices.</p></div></div>
                <div><span>02</span><div><h3>Choisir la classe</h3><p>Une classe entière ou un groupe : vous choisissez les destinataires.</p></div></div>
                <div><span>03</span><div><h3>Publier</h3><p>La séance est accessible. Les élèves retrouvent le travail à faire.</p></div></div>
                <Link className={s.textLink} href="/produit">Explorer la plateforme <ArrowRight size={18} aria-hidden="true" /></Link>
              </div>
              <figure className={s.studioFigure}>
                <div className={s.studioWindow}>
                  <div className={s.studioBar}><span>Mon espace prof</span><span className={s.draftBadge}>Brouillon</span></div>
                  <div className={s.studioBody}>
                    <p className={s.lowerEyebrow}>Mathématiques · Séance 03</p>
                    <h3>Les fonctions affines</h3>
                    <div className={s.documentPreview}><span><FileText size={22} aria-hidden="true" /></span><div><strong>Le cours.pdf</strong><p>Document de la séance</p></div><Check size={18} aria-hidden="true" /></div>
                    <div className={s.studioInstruction}><strong>Le travail à faire</strong><p>Lire le cours, puis réaliser les exercices 1 à 3.</p></div>
                    <p className={s.recipientLabel}>Partager avec</p>
                    <div className={s.classChips}><span><Check size={14} aria-hidden="true" /> Seconde 2</span><span><Check size={14} aria-hidden="true" /> Groupe A</span></div>
                    <div className={s.publishPreview} aria-hidden="true">Publier la séance <ArrowRight size={17} /></div>
                  </div>
                </div>
                <figcaption>Aperçu illustratif de la préparation d’une séance</figcaption>
              </figure>
            </div>
          </section>

          <section className={`${s.wrap} ${s.schoolSection}`}>
            <div className={s.schoolHeading}><span className={s.schoolIcon}><Users size={25} aria-hidden="true" /></span><div className={s.lowerCopy}><p className={s.lowerEyebrow}>Pour les établissements</p><h2>Votre établissement, simplement.</h2><p>Les classes, les groupes et les accès. Une organisation qui suit celle de votre lycée.</p><Link className={s.textLink} href="/etablissements">Voir la mise en place →</Link></div></div>
            <div className={s.schoolSteps}>
              <div><Upload size={20} aria-hidden="true" /><h3>01 · Importer</h3><p>Ajoutez les listes d’élèves et de professeurs.</p></div>
              <div><ShieldCheck size={20} aria-hidden="true" /><h3>02 · Vérifier</h3><p>Repérez les erreurs et les doublons avant validation.</p></div>
              <div><Users size={20} aria-hidden="true" /><h3>03 · Préparer les accès</h3><p>Distribuez les invitations à vos équipes et aux élèves.</p></div>
            </div>
          </section>

          <section className={`${s.wrap} ${s.faqSection}`}>
            <div className={s.lowerCopy}><p className={s.lowerEyebrow}>Quelques réponses</p><h2>Questions fréquentes</h2><p>Un autre point à éclaircir ?<br /><Link className={s.textLink} href="/contact">Parlons-en <ArrowRight size={17} aria-hidden="true" /></Link></p></div>
            <div className={s.faqList}>
              <details name="faq"><summary>Faut-il un ordinateur par élève ?<Plus size={20} aria-hidden="true" /></summary><p>Non. La projection en classe et le travail sur papier sont prévus ; le cours se consulte ensuite sur n’importe quel appareil, y compris un téléphone.</p></details>
              <details name="faq"><summary>Qui finance la plateforme ?<Plus size={20} aria-hidden="true" /></summary><p>L’établissement, sur devis. Aucun achat par les familles, aucun abonnement élève, aucune publicité.</p></details>
              <details name="faq"><summary>Comment installer Study dans mon lycée ?<Plus size={20} aria-hidden="true" /></summary><p><Link href="/contact">Contactez l’équipe</Link> pour présenter vos besoins et préparer la mise en place.</p></details>
            </div>
          </section>

          <section className={`${s.wrap} ${s.finalSection}`}>
            <div className={s.finalCard}>
              <span className={s.finalMark} aria-hidden="true">s.</span>
              <p className={s.lowerEyebrow}>La suite se construit avec vous</p>
              <h2>Une classe qui<br />avance ensemble.</h2>
              <p>Parlons de votre établissement.</p>
              <Link className={s.finalButton} href="/contact">Demander une démonstration <ArrowRight size={19} aria-hidden="true" /></Link>
              <span className={s.finalNote}>Déjà un accès ? <Link href="/connexion">Se connecter</Link></span>
            </div>
          </section>
        </div>
      </main>

      <footer className={`${s.wrap} ${s.newFooter}`}>
        <div className={s.footerTop}><div className={s.footerIdentity}><Link className={s.brand} href="/">study<span>.</span></Link><p>La classe continue ici.</p></div><nav aria-label="Découvrir Study"><p>Découvrir</p><Link href="/produit">La plateforme</Link><Link href="/etablissements">Établissements</Link><Link href="/offre">Offre</Link></nav><nav aria-label="Informations et aide"><p>Une question ?</p><Link href="/contact">Contact</Link><Link href="/aide">Aide</Link><Link href="/securite">Sécurité et données</Link></nav></div>
        <div className={s.footerBottom}><span>AvecStudy · La plateforme de votre classe</span><div><Link href="/confidentialite">Confidentialité</Link><Link href="/conditions">Conditions</Link><Link href="/mentions-legales">Mentions légales</Link></div></div>
      </footer>
    </div>
  );
}

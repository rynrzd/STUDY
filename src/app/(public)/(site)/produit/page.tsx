import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, FileText, MessageCircle } from "lucide-react";
import { pagePublique } from "@/lib/metadonnees";
import s from "./produit.module.css";

export const metadata: Metadata = pagePublique({
  chemin: "/produit",
  titre: "La plateforme",
  description: "Du cours à la question posée au professeur : découvrez comment Study accompagne le travail de la classe.",
});

export default function PageProduit() {
  return (
    <div className={s.page}>
      <section className={s.hero} aria-labelledby="titre-produit">
        <div className={s.intro}>
          <p className={s.kicker}>STUDY / LA PLATEFORME</p>
          <h1 id="titre-produit">Le cours est fini.<br /><em>Pas les questions.</em></h1>
          <p className={s.lead}>Le chapitre à retrouver. L’exercice pour jeudi. Le passage qu’on n’a pas compris. Study les rassemble dans l’espace de la classe.</p>
          <a className={s.primary} href="#parcours">Voir comment ça se passe <ArrowDown size={18} aria-hidden="true" /></a>
          <p className={s.introNote}>Pour les élèves, leurs professeurs et leur établissement.</p>
        </div>
        <figure className={s.lesson}>
          <div className={s.lessonTop}><span>SECONDE 1</span><span>Mathématiques</span></div>
          <div className={s.lessonBody}>
            <p className={s.chapter}>CHAPITRE 03</p>
            <h2>Les fonctions<br />affines.</h2>
            <p>Comprendre la droite.<br />Savoir calculer une image.</p>
            <svg className={s.graph} viewBox="0 0 400 160" role="img" aria-label="La droite f(x) = 2x + 1 passe par A (0 ; 1) et B (3 ; 7).">
              <path d="M28 124H380 M82 146V14" fill="none" stroke="#bcaeb5" />
              <path d="M34 134L346 17" fill="none" stroke="#81445b" strokeWidth="3" />
              <path d="M298 124V35H82" fill="none" stroke="#bcaeb5" strokeDasharray="4 5" />
              <circle cx="82" cy="116" r="5" fill="#81445b" /><circle cx="298" cy="35" r="5" fill="#81445b" />
              <g fill="#51464d" fontSize="12"><text x="91" y="106">A (0 ; 1)</text><text x="308" y="46">B (3 ; 7)</text><text x="289" y="143">3</text><text x="65" y="39">7</text></g>
            </svg>
          </div>
          <div className={s.lessonTask}><FileText size={19} aria-hidden="true" /><span><strong>Exercices 1 à 3</strong><small>À faire pour jeudi</small></span><a href="#travail" aria-label="Voir l’exemple de travail à faire"><ArrowRight size={22} aria-hidden="true" /></a></div>
          <figcaption>Exemple illustratif de cours · données fictives</figcaption>
        </figure>
      </section>

      <nav className={s.contents} aria-label="Le parcours dans Study">
        <a href="#cours"><span>01</span> Retrouver</a><a href="#travail"><span>02</span> Comprendre</a><a href="#echanges"><span>03</span> Échanger</a>
      </nav>

      <div id="parcours" className={s.journey}>
        <section id="cours" className={s.step} aria-labelledby="titre-cours">
          <div className={s.stepCopy}><p className={s.kicker}>01 / RETROUVER SON COURS</p><h2 id="titre-cours">« C’était où,<br />déjà ? »</h2><p>La séance, ses documents et le travail demandé restent ensemble. L’élève retrouve le contexte, même après avoir fermé son cahier.</p><p className={s.aside}>Le professeur prépare une séance, choisit sa classe et publie quand elle est prête.</p></div>
          <figure className={s.index}>
            <div className={s.indexHeading}><span>Dans cette séance</span><span>Fonctions affines</span></div>
            <ol><li><span>01</span><strong>Le cours</strong><small>Définition et exemples</small></li><li><span>02</span><strong>Les documents</strong><small>Les supports du professeur</small></li><li><span>03</span><strong>Le travail à faire</strong><small>Exercices 1 à 3 · jeudi</small></li></ol>
            <figcaption>Exemple de contenu · les éléments ci-dessus ne sont pas des liens.</figcaption>
          </figure>
        </section>

        <section id="travail" className={`${s.step} ${s.exerciseStep}`} aria-labelledby="titre-travail">
          <div className={s.stepCopy}><p className={s.kicker}>02 / PRENDRE LE TEMPS DE COMPRENDRE</p><h2 id="titre-travail">Une formule.<br />Puis le déclic.</h2><p>Revenir au cours, s’entraîner, reprendre une correction. Study garde les ressources à portée de main pour travailler à son rythme.</p><p className={s.aside}>Les révisions s’appuient sur les cours : cartes, entraînements et fiches composées à partir de leurs passages.</p></div>
          <figure className={s.exercise}>
            <p className={s.exerciseLabel}>À TON TOUR · EXEMPLE INTERACTIF</p><p className={s.question}>Si f(x) = 2x + 1,<br />combien vaut f(3) ?</p>
            <details className={s.answer}><summary>Voir l’explication <span aria-hidden="true">+</span></summary><div><p>On remplace <strong>x par 3</strong>.</p><p className={s.calculation}>2 × 3 + 1 = <strong>7</strong></p><p>L’image de 3 est 7. C’est le point B sur le graphique du cours.</p></div></details>
            <figcaption>Cet exemple ne crée aucun résultat ni suivi d’élève.</figcaption>
          </figure>
        </section>

        <section id="echanges" className={s.step} aria-labelledby="titre-echanges">
          <div className={s.stepCopy}><p className={s.kicker}>03 / POSER SA QUESTION</p><h2 id="titre-echanges">On peut aussi<br />demander.</h2><p>Une question sur le cours ne devrait pas finir perdue dans une conversation. Le salon réunit la classe et son professeur autour du travail.</p><p className={s.aside}>La vie de classe a aussi sa place : propositions, consultations et suivi des décisions avec les délégués.</p></div>
          <figure className={s.conversation}>
            <div className={s.conversationHeading}><MessageCircle size={20} aria-hidden="true" /><strong>La question de Lina</strong><span>Seconde 1</span></div>
            <blockquote><p>« Pourquoi on remplace x par 3 ? »</p><footer>Lina · élève</footer></blockquote>
            <div className={s.reply}><p className={s.teacher}>Mme Bernard <span>Professeure</span></p><p>Parce qu’on cherche l’image de 3. On reprend la formule du cours : f(3) = 2 × 3 + 1 = 7.</p></div>
            <figcaption>Échange fictif pour illustrer le salon collectif de classe.</figcaption>
          </figure>
        </section>
      </div>

      <section className={s.school} aria-labelledby="titre-lycee">
        <div><p className={s.kicker}>DU CÔTÉ DU LYCÉE</p><h2 id="titre-lycee">Derrière chaque classe,<br />une équipe qui garde la main.</h2><Link className={s.textLink} href="/etablissements">Voir le fonctionnement établissement <ArrowRight size={18} aria-hidden="true" /></Link></div>
        <ul><li><Check size={19} aria-hidden="true" /><span><strong>Les bonnes classes, les bons accès.</strong> L’établissement importe les personnes et prépare leurs accès.</span></li><li><Check size={19} aria-hidden="true" /><span><strong>Le professeur décide de la publication.</strong> Un brouillon reste invisible pour les élèves.</span></li><li><Check size={19} aria-hidden="true" /><span><strong>Les échanges ont un cadre.</strong> Les signalements sont examinés par un responsable de l’établissement.</span></li></ul>
      </section>

      <section className={s.practical} aria-labelledby="titre-pratique"><h2 id="titre-pratique">Avant de vous lancer.</h2><div>
        <details><summary>Comment les élèves se connectent-ils ? <span aria-hidden="true">+</span></summary><p>L’établissement remet les accès. Study dispose de sa propre connexion ; aucune intégration ENT, EduConnect ou GAR n’est actuellement proposée. <Link href="/activer">Voir la première connexion.</Link></p></details>
        <details><summary>Que fait Study aujourd’hui ? <span aria-hidden="true">+</span></summary><p>Cours, devoirs, corrections, révisions et échanges de classe. Study ne gère pas les absences, les bulletins ou la cantine et ne propose pas de visioconférence. Les fiches assemblent des passages du cours ; aucun fournisseur d’IA n’est raccordé. La recherche est lexicale et n’indexe pas les PDF scannés.</p></details>
        <details><summary>Et les données et les fichiers ? <span aria-hidden="true">+</span></summary><p>Les accès sont gérés par l’établissement, avec un second facteur pour les administrateurs. Les fichiers sont contrôlés par leur type, leur taille et leur empreinte, sans analyse antivirus. Les accès sont remis par l’établissement : aucun envoi d’e-mail automatique n’est raccordé. <Link href="/securite">Lire les mesures et leurs limites.</Link></p></details>
      </div></section>

      <section className={s.closing} aria-labelledby="titre-demo"><p className={s.kicker}>ET POUR VOTRE ÉTABLISSEMENT ?</p><h2 id="titre-demo">Voyons Study<br />avec votre équipe.</h2><p>Une démonstration pour parcourir les usages et voir ce qui correspond à votre organisation.</p><Link href="/contact" className={s.primary}>Demander une démonstration <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/offre" className={s.offer}>Consulter l’offre</Link></section>
    </div>
  );
}

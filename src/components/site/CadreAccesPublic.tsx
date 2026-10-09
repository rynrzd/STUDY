import Link from "next/link";
import { ArrowLeft, KeyRound, BookOpen, MessagesSquare } from "lucide-react";
import { MotSymbole } from "./MotSymbole";
import s from "./acces-public.module.css";

/** Opt-in réservé aux écrans publics ; ne remplace pas la coque de connexion. */
export function CadreAccesPublic({ titre, sousTitre, children }: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  visuel?: string;
}) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href="/" aria-label="Study, retour à l’accueil"><MotSymbole titre="Study" className="block h-auto w-[86px]" /></Link>
        <Link href="/" className={s.back}><ArrowLeft size={16} aria-hidden="true" />Retour au site</Link>
      </header>
      <div className={s.layout}>
        <aside className={s.aside}>
          <p className={s.eyebrow}>Les cours. La classe. Le lien.</p>
          <h2>Le prochain chapitre commence ici.</h2>
          <p>Les accès à Study sont remis et gérés par ton établissement.</p>
          <div><BookOpen size={22} aria-hidden="true" /><span>Retrouver les cours de sa classe.</span></div>
          <div><MessagesSquare size={22} aria-hidden="true" /><span>Garder le lien avec ses professeurs.</span></div>
        </aside>
        <main id="contenu" className={s.main}>
          <span className={s.icon} aria-hidden="true"><KeyRound size={28} strokeWidth={1.5} /></span>
          <h1>{titre}</h1>
          {sousTitre ? <p className={s.lead}>{sousTitre}</p> : null}
          <div className={s.body}>{children}</div>
          <p className={s.help}>Besoin d’un repère ? <Link href="/aide">Consulter l’aide</Link></p>
        </main>
      </div>
    </div>
  );
}

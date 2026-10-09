import Link from "next/link";
import { ArrowRight, KeyRound, School, MessageCircle } from "lucide-react";
import s from "./public-pages.module.css";

/** Trois destinations réelles ; aucune recherche ou assistance simulée. */
export function RaccourcisPublics() {
  const liens = [
    { href: "/acces-oublie", titre: "Retrouver mon accès", texte: "Avec l’aide de mon établissement", Icone: KeyRound },
    { href: "/rejoindre", titre: "Rejoindre ma classe", texte: "J’ai reçu un code de classe", Icone: School },
    { href: "/contact#demande", titre: "Découvrir Study", texte: "Une démonstration pour mon lycée", Icone: MessageCircle },
  ];
  return <nav aria-label="Votre prochaine étape" className={s.quickLinks}>{liens.map(({href,titre,texte,Icone}) => <Link key={href} href={href} className={s.quickLink}><Icone size={23} aria-hidden="true"/><span><strong>{titre}</strong><span>{texte}</span></span><ArrowRight size={17} aria-hidden="true"/></Link>)}</nav>;
}

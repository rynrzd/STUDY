"use client";

import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { COURBES, DUREES } from "@/lib/mouvement";
import s from "./intro.module.css";

/** La connexion a déjà été confirmée lorsque le serveur rend ce composant. */
export function VueIntro() {
  useEffect(() => {
    const zone = document.querySelector(".app-principal");
    const mouvement = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!zone || mouvement.matches) return;
    const titre = zone.querySelector("h1");
    const panneaux = [...zone.querySelectorAll("section, .panneau, .carte-chiffre")].filter(
      (element) => !element.parentElement?.closest("section, .panneau, .carte-chiffre") && !element.contains(titre),
    ).slice(0, 4);
    const elements = titre ? [titre, ...panneaux] : panneaux;
    const animations = elements.map((element, index) =>
      element.animate(
        [{ opacity: 0.65, transform: "translateY(7px)" }, { opacity: 1, transform: "none" }],
        { duration: DUREES.section, delay: index * 55, easing: COURBES.entree, fill: "backwards" },
      ),
    );
    const annuler = () => animations.forEach((animation) => animation.cancel());
    mouvement.addEventListener("change", annuler);
    return () => {
      mouvement.removeEventListener("change", annuler);
      annuler();
    };
  }, []);
  return <div className={s.intro} aria-hidden="true"><BookOpen size={20} /><span>AvecStudy</span></div>;
}


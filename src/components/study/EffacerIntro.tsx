"use client";

import { useEffect } from "react";
import { COOKIE_INTRO } from "@/lib/mouvement";

/** L'intro ne se joue qu'une fois : la première page affichée efface son cookie. */
export function EffacerIntro() {
  useEffect(() => {
    document.cookie = `${COOKIE_INTRO}=; Max-Age=0; path=/; SameSite=Lax`;
  }, []);
  return null;
}

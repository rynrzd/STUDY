import Link from "next/link";
import { ChevronRight, Hash, Megaphone, MessageCircleQuestion, Users } from "lucide-react";
import type { SalonResume } from "@/lib/v6/messagerie";
import { dateLisible } from "./ui";

/**
 * Liste des salons lisibles : général, matières, projets. Non-lus calculés
 * côté base. « barre » : navigation latérale compacte d'un salon ouvert ;
 * « liste » : page Messagerie, lignes à tuile des maquettes R2.
 */
export function ListeSalons({ salons, actif, presentation = "barre" }: { salons: readonly SalonResume[]; actif?: string | null; presentation?: "barre" | "liste" }) {
  return (
    <ul className={presentation === "liste" ? "liste-r2" : "m-0 grid list-none gap-1 p-0"}>
      {salons.map((s) => {
        const href = s.classId && s.kind !== "projet" ? `/app/classes/${s.classId}/salons/${s.id}` : `/app/messagerie/${s.id}`;
        const Icone = s.kind === "projet" ? Users : s.mode === "annonces" ? Megaphone : s.mode === "questions" ? MessageCircleQuestion : Hash;
        const detail = `${s.kind === "general" ? "Toute la classe" : s.kind === "projet" ? "Projet" : s.classe ?? "Groupe"}${s.dernierMessage ? ` · ${dateLisible(s.dernierMessage, { day: "numeric", month: "short" })}` : ""}`;
        const nonLus =
          s.nonLus > 0 ? (
            <span className="compteur" aria-label={`${s.nonLus} non lus`}>
              {s.nonLus > 99 ? "99+" : s.nonLus}
            </span>
          ) : null;
        return (
          <li key={s.id}>
            {presentation === "liste" ? (
              <Link href={href} className="ligne-r2" aria-current={actif === s.id ? "true" : undefined}>
                <span className="tuile" aria-hidden="true">
                  <Icone size={20} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.label}</span>
                  <span className="meta block truncate">{detail}</span>
                </span>
                {nonLus}
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="chevron" />
              </Link>
            ) : (
              <Link href={href} className="lien-barre" aria-current={actif === s.id ? "page" : undefined}>
                <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.label}</span>
                  <span className="meta block truncate">{detail}</span>
                </span>
                {nonLus}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

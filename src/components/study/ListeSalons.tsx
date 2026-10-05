import Link from "next/link";
import { Hash, Megaphone, MessageCircleQuestion, Users } from "lucide-react";
import type { SalonResume } from "@/lib/v6/messagerie";
import { dateLisible } from "./ui";

/** Liste des salons lisibles : général, matières, projets. Non-lus calculés côté base. */
export function ListeSalons({ salons, actif }: { salons: readonly SalonResume[]; actif?: string | null }) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {salons.map((s) => {
        const href = s.classId && s.kind !== "projet" ? `/app/classes/${s.classId}/salons/${s.id}` : `/app/messagerie/${s.id}`;
        const Icone = s.kind === "projet" ? Users : s.mode === "annonces" ? Megaphone : s.mode === "questions" ? MessageCircleQuestion : Hash;
        return (
          <li key={s.id}>
            <Link href={href} className="lien-barre" aria-current={actif === s.id ? "page" : undefined}>
              <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{s.label}</span>
                <span className="meta block truncate">
                  {s.kind === "general" ? "Toute la classe" : s.kind === "projet" ? "Projet" : s.classe ?? "Groupe"}
                  {s.dernierMessage ? ` · ${dateLisible(s.dernierMessage, { day: "numeric", month: "short" })}` : ""}
                </span>
              </span>
              {s.nonLus > 0 ? (
                <span className="compteur" aria-label={`${s.nonLus} non lus`}>
                  {s.nonLus > 99 ? "99+" : s.nonLus}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

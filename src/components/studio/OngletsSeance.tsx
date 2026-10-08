import { FilAriane, OngletsLiens } from "@/components/study/ui";

/**
 * T03 — navigation d'une séance dans le Studio (R2) : contenu, exercices et
 * notions, aperçu élève. Les trois pages gardent leurs propres contrôles de
 * droits ; ces onglets ne sont que des liens.
 */
export function OngletsSeance({ seance, titre, actif }: { seance: string; titre: string; actif: "contenu" | "exercices" }) {
  return (
    <div className="mb-6">
      <FilAriane etapes={[{ href: "/studio", libelle: "Studio" }]} />
      <p className="sourcil">Séance</p>
      <h1 className="titre-page m-0 mb-4">{titre}</h1>
      <OngletsLiens
        etiquette="Sections de la séance"
        onglets={[
          { href: `/studio/${seance}`, libelle: "Contenu", actif: actif === "contenu" },
          { href: `/studio/${seance}/exercices`, libelle: "Exercices et notions", actif: actif === "exercices" },
          { href: `/app/seances/${seance}`, libelle: "Aperçu élève", actif: false },
        ]}
      />
    </div>
  );
}

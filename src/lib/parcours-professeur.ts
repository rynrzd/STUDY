/** Une étape à la fois, calculée sur des actions réellement enregistrées. */
export function etatParcoursProfesseur(cours: number, seances: number, publiees: number) {
  const classePrete = cours > 0;
  const seancePrete = classePrete && seances > 0;
  const publicationPrete = seancePrete && publiees > 0;
  const progression = Number(classePrete) + Number(seancePrete) + Number(publicationPrete);
  const action = !classePrete
    ? { href: "/professeur/classes", libelle: "Créer ma première classe" }
    : !seancePrete
      ? { href: "/studio", libelle: "Préparer ma première séance" }
      : !publicationPrete
        ? { href: "/studio", libelle: "Terminer et publier ma séance" }
        : { href: "/professeur/classes", libelle: "Inviter mes élèves" };
  return { classePrete, seancePrete, publicationPrete, progression, action } as const;
}

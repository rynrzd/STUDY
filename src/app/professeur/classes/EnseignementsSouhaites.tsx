import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { classerEnseignements, type ProjetProfesseur } from "@/lib/projet-professeur";
import { FormulaireCreationClasse } from "./FormulaireCreation";

export function EnseignementsSouhaites({ projet, classes, creationAutonome }: {
  projet: ProjetProfesseur;
  classes: readonly { label: string; matieres: readonly string[] }[];
  creationAutonome: boolean;
}) {
  const { dejaCrees, aCreer } = classerEnseignements(projet.enseignements, classes);
  if (aCreer.length === 0 && dejaCrees.length === 0 && !projet.etablissement) return null;

  return (
    <section aria-labelledby="enseignements-prevus" className="mb-7 rounded-2xl border border-[#e7cad6] bg-[#fff4f7] p-5 sm:p-7">
      <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#874b62]">Tes réponses à l&apos;inscription</p>
      <h2 id="enseignements-prevus" className="m-0 text-xl font-bold text-[#44333d]">Préparons tes enseignements</h2>
      {projet.etablissement ? (
        <p className="mb-0 mt-3 text-sm leading-6 text-[#65545e]">
          Tu as indiqué <strong>{projet.etablissement}</strong>. Ce nom nous aide à organiser ton espace personnel ;
          pour accéder aux classes officielles de cet établissement, il faut une invitation ou l&apos;accord d&apos;un responsable.
        </p>
      ) : null}

      {aCreer.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 text-base font-bold text-[#44333d]">{creationAutonome ? "Encore à créer dans ton espace" : "Enseignements à demander à ton établissement"}</h3>
          <p className="mt-0 text-sm leading-6 text-[#65545e]">{creationAutonome ? "Choisis seulement celles que tu veux ouvrir maintenant. Les autres resteront dans ta liste." : "Ton lycée gère la création officielle de ses classes. Adresse-toi à son responsable pour les faire ouvrir ou pour recevoir une affectation."}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {aCreer.map((souhait) => (
              creationAutonome ? <FormulaireCreationClasse key={`${souhait.classe}-${souhait.matiere}`} proposition={souhait} />
                : <div key={`${souhait.classe}-${souhait.matiere}`} className="rounded-xl border border-[color:var(--color-bordure)] bg-white p-4"><span className="block font-bold">{souhait.classe}</span><span className="text-sm text-[color:var(--color-encre-faible)]">{souhait.matiere} · En attente de l&apos;établissement</span></div>
            ))}
          </div>
        </div>
      ) : null}

      {dejaCrees.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-[#44333d]">Déjà prêt dans ton espace</h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {dejaCrees.map((souhait) => (
              <li key={`${souhait.classe}-${souhait.matiere}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-[#65545e]">
                <CheckCircle2 size={16} className="text-[#47755a]" aria-hidden="true" />
                {souhait.classe} · {souhait.matiere}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mb-0 mt-5 text-sm leading-6 text-[#65545e]">
        Tu rejoins plutôt une classe d&apos;un établissement ? <Link href="/rejoindre" className="font-bold text-[#75465a]">Demander à la rejoindre avec un code</Link>.
      </p>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, BookOpenText, Check, CircleHelp, FileUp, GraduationCap, Users } from "lucide-react";

/** Parcours court : on montre l'utilité avant de montrer les fonctionnalités. */
export function GuideDemarrage({ prenom, premiereVisite = false }: { prenom?: string; premiereVisite?: boolean }) {
  return (
    <div className="grid gap-7">
      <section className="relative overflow-hidden rounded-[28px] bg-[#503d4a] px-6 py-9 text-white sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[56px] border-[#ffffff0e]" />
        <div className="relative max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#f7c5d5]">
            {premiereVisite ? "Ton compte est prêt" : "Bien démarrer · Espace professeur"}
          </span>
          <h1 className="mb-3 mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            {prenom ? `Bienvenue ${prenom},` : "Bienvenue,"}<br />on commence ensemble.
          </h1>
          <p className="m-0 max-w-xl text-base leading-7 text-[#f0e7ec]">
            Tu n&apos;as rien à paramétrer pour commencer. Crée simplement une classe,
            prépare ton premier cours, puis invite tes élèves quand tu es prêt.
          </p>
          <Link href="/professeur/classes" className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#f5c5d4] px-5 font-bold text-[#442b39] no-underline transition hover:bg-white">
            Créer ma première classe <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="etapes-demarrage">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--color-accent)]">Ton chemin, en 3 étapes</span>
            <h2 id="etapes-demarrage" className="mb-0 mt-1 text-2xl font-bold">De l&apos;idée au cours partagé</h2>
          </div>
          <span className="text-sm text-[color:var(--color-encre-faible)]">À ton rythme, sans obligation</span>
        </div>
        <ol className="grid list-none gap-4 p-0 lg:grid-cols-3">
          <li className="flex flex-col rounded-2xl border border-[#e2c7d2] bg-[color:var(--color-surface)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between"><span className="text-sm font-bold text-[color:var(--color-accent)]">01 · Commencer</span><GraduationCap className="text-[color:var(--color-accent)]" size={25} aria-hidden="true" /></div>
            <h3 className="m-0 text-lg font-bold">Crée ta classe</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Donne-lui un nom (ex. 3e B) et choisis une matière. C&apos;est tout : aucun code de lycée n&apos;est demandé.</p>
            <Link className="mt-5 inline-flex items-center gap-2 font-bold text-[color:var(--color-accent)]" href="/professeur/classes">Créer une classe <ArrowRight size={17} /></Link>
          </li>
          <li className="flex flex-col rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
            <div className="mb-5 flex items-center justify-between"><span className="text-sm font-bold text-[color:var(--color-encre-faible)]">02 · Préparer</span><BookOpenText size={25} className="text-[color:var(--color-accent)]" aria-hidden="true" /></div>
            <h3 className="m-0 text-lg font-bold">Prépare un cours</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Rédige une séance ou importe un PDF ou un Word. Tu peux enregistrer un brouillon sans que les élèves le voient.</p>
            <Link className="mt-5 inline-flex items-center gap-2 font-bold text-[color:var(--color-accent)]" href="/professeur/studio">Importer un document <ArrowRight size={17} /></Link>
          </li>
          <li className="flex flex-col rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
            <div className="mb-5 flex items-center justify-between"><span className="text-sm font-bold text-[color:var(--color-encre-faible)]">03 · Partager</span><Users size={25} className="text-[color:var(--color-accent)]" aria-hidden="true" /></div>
            <h3 className="m-0 text-lg font-bold">Fais venir tes élèves</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Depuis ta classe, importe une liste d&apos;élèves et prépare leurs invitations. Publie ton cours quand il est prêt.</p>
            <Link className="mt-5 inline-flex items-center gap-2 font-bold text-[color:var(--color-accent)]" href="/professeur/classes">Gérer mes élèves <ArrowRight size={17} /></Link>
          </li>
        </ol>
      </section>

      <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5 sm:p-6">
        <FileUp size={23} className="shrink-0 text-[color:var(--color-accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-bold">Tu as déjà un cours en PDF ou en Word ?</h2>
          <p className="mb-3 mt-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Tu peux l&apos;importer tout de suite, même avant d&apos;avoir créé ta classe. Tu choisiras à qui le partager plus tard.</p>
          <Link href="/professeur/studio" className="inline-flex items-center gap-2 font-bold text-[color:var(--color-accent)]">Importer mon cours <ArrowRight size={17} /></Link>
        </div>
      </section>
    </div>
  );
}

export function BandeauPremiersPas({ aUneSeance }: { aUneSeance: boolean }) {
  return (
    <section aria-label="Prochaine étape" className="mb-7 flex flex-wrap items-center gap-4 rounded-2xl border border-[#e7cad6] bg-[#fff3f7] p-5 text-[#44333d] sm:p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2d9e3] text-[#884b63]">
        {aUneSeance ? <Check size={22} /> : <BookOpenText size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-base font-bold">{aUneSeance ? "Ton premier cours prend forme !" : "Ta classe est créée. Et maintenant ?"}</h2>
        <p className="mb-0 mt-1 text-sm leading-6">{aUneSeance ? "Vérifie ta séance, puis publie-la lorsque tu souhaites la montrer aux élèves." : "Prépare une séance dans « Mes cours ». Tu pourras la garder en brouillon le temps de la terminer."}</p>
      </div>
      <Link href="/studio" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#75465a] px-4 font-bold text-white no-underline hover:bg-[#5e3447]">
        {aUneSeance ? "Voir mes cours" : "Préparer ma séance"}<ArrowRight size={17} />
      </Link>
      <Link href="/professeur/demarrage" className="inline-flex items-center gap-2 text-sm font-semibold text-[#75465a]"><CircleHelp size={16} /> Voir le guide</Link>
    </section>
  );
}

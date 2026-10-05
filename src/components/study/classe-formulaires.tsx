"use client";

import { Copy, Printer } from "lucide-react";
import { useActionState, useState } from "react";
import {
  changerDecision,
  creerCode,
  creerConsultation,
  creerDecision,
  creerInvitation,
  creerRevisionCollective,
  designerDelegue,
  modifierSynthese,
  proposerRessource,
  repondreConsultation,
  retirerEleve,
} from "@/app/app/classes/actions";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "./formulaire";
import { AvisVisibilite } from "./ui";

/* -------------------------------------------------------------------------- */
/* Accès                                                                       */
/* -------------------------------------------------------------------------- */

function Copier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className="bouton bouton-secondaire bouton-compact"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
        } catch {
          setCopie(false);
        }
      }}
    >
      <Copy size={16} strokeWidth={1.75} aria-hidden="true" /> {copie ? "Copié" : "Copier"}
    </button>
  );
}

/** Code de classe : affiché une seule fois, puis seule son empreinte existe. */
export function FormulaireCode({ classe }: { classe: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerCode.bind(null, classe), {});
  if (etat.ok && etat.message) {
    const [code, echeance] = etat.message.split("|");
    return (
      <div role="status" className="rounded-[12px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4">
        <p className="meta m-0">Code de classe — affiché une seule fois</p>
        <p className="m-0 mt-1 font-mono text-[1.75rem] font-bold tracking-[0.18em]">{code}</p>
        <p className="meta m-0 mt-1">Valable jusqu&apos;au {echeance}. Le code ne donne aucun accès : chaque demande arrivera ici pour validation.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Copier texte={code ?? ""} />
          <button type="button" className="bouton bouton-secondaire bouton-compact" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Imprimer
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <RetourFormulaire etat={etat} />
      <Liste
        libelle="Durée de validité"
        nom="heures"
        valeur="48"
        options={[
          { valeur: "24", libelle: "24 heures" },
          { valeur: "48", libelle: "48 heures (recommandé)" },
          { valeur: "168", libelle: "7 jours" },
        ]}
      />
      <div className="mb-4">
        <BoutonEnvoi enCours="Création…">Créer un nouveau code</BoutonEnvoi>
      </div>
    </form>
  );
}

/** Lien d'invitation nominatif : montré une fois, à remettre en main propre ou imprimer. */
export function FormulaireInvitationEleve({ classe, profil, nom }: { classe: string; profil: string; nom: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerInvitation.bind(null, classe), {});
  if (etat.ok && etat.message) {
    return (
      <div className="fiche-impression rounded-[12px] border border-[color:var(--color-bordure)] p-4">
        <p className="m-0 font-semibold">Invitation de {nom}</p>
        <p className="m-0 mt-2 break-all font-mono text-[0.8125rem]">{etat.message}</p>
        <p className="meta m-0 mt-2">Valable 7 jours, une seule fois. Il ne sera plus affiché : copiez-le ou imprimez-le maintenant.</p>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <Copier texte={etat.message} />
          <button type="button" className="bouton bouton-secondaire bouton-compact" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Imprimer
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="profil" value={profil} />
      <RetourFormulaire etat={etat} />
      <BoutonEnvoi enCours="Création…" variante="secondaire" className="bouton-compact">
        Créer un lien d&apos;invitation
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireRetrait({ classe, profil, nom }: { classe: string; profil: string; nom: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(retirerEleve.bind(null, classe), {});
  if (etat.ok) return <RetourFormulaire etat={etat} />;
  return (
    <form action={action}>
      <input type="hidden" name="profil" value={profil} />
      <RetourFormulaire etat={etat} />
      <p className="m-0 mb-3">
        {nom} n&apos;aura plus accès aux cours, salons et documents de la classe dès sa prochaine action. Ses copies et l&apos;historique sont
        conservés. Ce qui a déjà été téléchargé sur son appareil ne peut pas être effacé à distance.
      </p>
      <Champ libelle="Motif (journalisé, non montré à la classe)" nom="motif" requis maxLength={480} erreurs={etat.champs?.motif} />
      <BoutonEnvoi variante="danger" enCours="Retrait…">
        Retirer de la classe
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireDelegue({ classe, eleves, finAnnee }: { classe: string; eleves: readonly { id: string; nom: string }[]; finAnnee: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(designerDelegue.bind(null, classe), {});
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Liste libelle="Élève" nom="profil" options={eleves.map((e) => ({ valeur: e.id, libelle: e.nom }))} />
        <Liste
          libelle="Mandat"
          nom="titre"
          options={[
            { valeur: "titulaire", libelle: "Titulaire" },
            { valeur: "suppleant", libelle: "Suppléant" },
          ]}
        />
        <Champ libelle="Fin du mandat" nom="fin" type="date" requis valeur={finAnnee} erreurs={etat.champs?.fin} />
      </div>
      <p className="meta m-0 mb-3">Le mandat est limité à cette classe et à cette période. Il ne permet pas de gérer des comptes.</p>
      <BoutonEnvoi variante="secondaire" enCours="Enregistrement…">
        Désigner
      </BoutonEnvoi>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Vie de classe                                                               */
/* -------------------------------------------------------------------------- */

export function FormulaireConsultation({ classe }: { classe: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerConsultation.bind(null, classe), {});
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-4 sm:grid-cols-[1fr_180px]">
        <Champ libelle="Titre" nom="titre" requis valeur={etat.valeurs?.titre} erreurs={etat.champs?.titre} placeholder="Consultation de novembre" />
        <Liste
          libelle="Durée d'ouverture"
          nom="jours"
          valeur="7"
          options={[
            { valeur: "5", libelle: "5 jours" },
            { valeur: "7", libelle: "7 jours" },
            { valeur: "14", libelle: "14 jours" },
          ]}
        />
      </div>
      <BoutonEnvoi variante="secondaire" enCours="Création…">
        Préparer la consultation
      </BoutonEnvoi>
    </form>
  );
}

const CATEGORIES = [
  { valeur: "", libelle: "Choisir…" },
  { valeur: "charge", libelle: "Charge de travail" },
  { valeur: "aide", libelle: "Besoin d'aide" },
  { valeur: "projets", libelle: "Projets" },
  { valeur: "vie_quotidienne", libelle: "Vie quotidienne" },
];

/** E11 — réponse avec aperçu : nom et destinataires montrés avant l'envoi. */
export function FormulaireReponseConsultation({
  classe,
  consultation,
  initiale,
  destinataires,
  moi,
}: {
  classe: string;
  consultation: string;
  initiale: { fonctionne: string; difficulte: string; proposition: string; categorie: string; version: number };
  destinataires: string;
  moi: string;
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(repondreConsultation.bind(null, consultation, classe), {
    valeurs: { ...initiale, version: String(initiale.version) },
  });
  const v = etat.valeurs ?? {};
  const apercu = etat.code === "APERCU";
  return (
    <form action={action}>
      <RetourFormulaire etat={etat.code === "APERCU" ? {} : etat} />
      <input type="hidden" name="version" value={v.version ?? "0"} />
      <div hidden={apercu}>
        <ZoneTexte libelle="Ce qui fonctionne bien" nom="fonctionne" valeur={v.fonctionne} lignes={3} maxLength={2000} />
        <ZoneTexte libelle="Une difficulté collective" nom="difficulte" valeur={v.difficulte} lignes={3} maxLength={2000} />
        <ZoneTexte libelle="Une proposition" nom="proposition" valeur={v.proposition} lignes={3} maxLength={2000} erreurs={etat.champs?.proposition} />
        <Liste libelle="Catégorie" nom="categorie" valeur={v.categorie} options={CATEGORIES} erreurs={etat.champs?.categorie} />
        <BoutonEnvoi enCours="Préparation…">Voir l&apos;aperçu avant l&apos;envoi</BoutonEnvoi>
      </div>
      {apercu ? (
        <div className="grid gap-4">
          <AvisVisibilite>
            <strong>Aperçu.</strong> Ta réponse sera envoyée sous ton nom ({moi}) et lue par : {destinataires}. Elle ne sera ni publiée à la
            classe ni montrée à l&apos;administration. Tu pourras la modifier jusqu&apos;à la clôture.
          </AvisVisibilite>
          <dl className="m-0 grid gap-3">
            {[
              ["Ce qui fonctionne", v.fonctionne],
              ["Difficulté", v.difficulte],
              ["Proposition", v.proposition],
              ["Catégorie", CATEGORIES.find((c) => c.valeur === v.categorie)?.libelle],
            ].map(([t, valeur]) => (
              <div key={t}>
                <dt className="meta">{t}</dt>
                <dd className="m-0 whitespace-pre-line">{valeur || "—"}</dd>
              </div>
            ))}
          </dl>
          <input type="hidden" name="fonctionne" value={v.fonctionne ?? ""} />
          <input type="hidden" name="difficulte" value={v.difficulte ?? ""} />
          <input type="hidden" name="proposition" value={v.proposition ?? ""} />
          <input type="hidden" name="categorie" value={v.categorie ?? ""} />
          <div className="flex flex-wrap gap-2">
            <BoutonEnvoi name="confirme" value="oui" enCours="Envoi…">
              Envoyer ma réponse
            </BoutonEnvoi>
            <BoutonEnvoi variante="secondaire" enCours="…">
              Modifier
            </BoutonEnvoi>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function FormulaireSynthese({ classe, consultation, texte, version }: { classe: string; consultation: string; texte: string; version: number }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(modifierSynthese.bind(null, consultation, classe), {
    valeurs: { texte, version: String(version) },
  });
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <input type="hidden" name="version" value={etat.valeurs?.version ?? String(version)} />
      <ZoneTexte
        libelle="Compte rendu"
        nom="texte"
        requis
        lignes={10}
        valeur={etat.valeurs?.texte ?? texte}
        aide="Relisez et réécrivez : aucun nom, aucun détail personnel. Retirez la mention « BROUILLON » quand le texte est prêt."
      />
      <div className="flex flex-wrap gap-2">
        <BoutonEnvoi variante="secondaire" enCours="Enregistrement…">
          Enregistrer le brouillon
        </BoutonEnvoi>
        <BoutonEnvoi name="publier" value="oui" enCours="Publication…">
          Publier à la classe
        </BoutonEnvoi>
      </div>
    </form>
  );
}

export function FormulaireDecision({ classe, consultation }: { classe: string; consultation?: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerDecision.bind(null, classe), {});
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      {consultation ? <input type="hidden" name="consultation" value={consultation} /> : null}
      <Champ libelle="Sujet à suivre" nom="titre" requis valeur={etat.valeurs?.titre} erreurs={etat.champs?.titre} />
      <ZoneTexte libelle="Explication" nom="explication" lignes={2} valeur={etat.valeurs?.explication} />
      <BoutonEnvoi variante="secondaire" enCours="Ajout…">
        Ajouter au suivi
      </BoutonEnvoi>
    </form>
  );
}

const LIBELLES_STATUT: Record<string, string> = {
  discutee: "Discutée",
  transmise: "Transmise",
  repondue: "Réponse reçue",
  en_cours: "En cours",
  faite: "Faite",
  refusee: "Non retenue",
};

export function FormulaireChangerDecision({
  classe,
  decision,
  version,
  suivants,
}: {
  classe: string;
  decision: string;
  version: number;
  suivants: readonly string[];
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(changerDecision.bind(null, classe), {});
  const [statut, setStatut] = useState(suivants[0] ?? "");
  if (suivants.length === 0) return null;
  return (
    <form action={action} className="mt-3 rounded-[10px] bg-[color:var(--color-surface-douce)] p-3">
      <RetourFormulaire etat={etat} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="version" value={version} />
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Liste
          libelle="Nouvel état"
          nom="statut"
          valeur={statut}
          onChange={(e) => setStatut(e.target.value)}
          options={suivants.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] ?? s }))}
        />
        {statut === "en_cours" ? (
          <>
            <Champ libelle="Responsable" nom="responsable" requis maxLength={120} />
            <Champ libelle="Date de suivi" nom="suivi" type="date" requis />
          </>
        ) : null}
      </div>
      <ZoneTexte libelle={statut === "refusee" ? "Motif (requis)" : "Explication"} nom="motif" lignes={2} requis={statut === "refusee"} />
      <BoutonEnvoi variante="secondaire" className="bouton-compact" enCours="Mise à jour…">
        Mettre à jour
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireRessource({ classe, message, fiche, titre, corps }: { classe: string; message?: string; fiche?: string; titre?: string; corps?: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(proposerRessource.bind(null, classe), {});
  if (etat.ok) return <RetourFormulaire etat={etat} />;
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      {message ? <input type="hidden" name="message" value={message} /> : null}
      {fiche ? <input type="hidden" name="fiche" value={fiche} /> : null}
      <Champ libelle="Titre" nom="titre" requis valeur={etat.valeurs?.titre ?? titre} erreurs={etat.champs?.titre} maxLength={140} />
      <ZoneTexte libelle="Contenu" nom="corps" requis lignes={6} valeur={etat.valeurs?.corps ?? corps} erreurs={etat.champs?.corps} maxLength={12000} />
      <Liste
        libelle="Type"
        nom="kind"
        valeur={etat.valeurs?.kind ?? "explication"}
        options={[
          { valeur: "explication", libelle: "Explication" },
          { valeur: "methode", libelle: "Méthode" },
          { valeur: "fiche", libelle: "Fiche" },
          { valeur: "lien", libelle: "Lien utile" },
        ]}
      />
      <p className="meta m-0 mb-3">Visible par toute la classe. Une proposition d&apos;élève reste « non validée » tant qu&apos;un professeur ne l&apos;a pas relue.</p>
      <BoutonEnvoi enCours="Envoi…">Proposer à la classe</BoutonEnvoi>
    </form>
  );
}

export function FormulaireRevisionCollective({ classe }: { classe: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerRevisionCollective.bind(null, classe), {});
  if (etat.ok) return <RetourFormulaire etat={etat} />;
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <Champ libelle="Sujet" nom="titre" requis valeur={etat.valeurs?.titre} erreurs={etat.champs?.titre} placeholder="Entraide sur les fonctions" />
      <ZoneTexte libelle="Déroulé" nom="deroule" lignes={2} valeur={etat.valeurs?.deroule} placeholder="Dix minutes de questions, puis une discussion" />
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Champ libelle="Créneau" nom="debut" type="datetime-local" requis valeur={etat.valeurs?.debut} erreurs={etat.champs?.debut} />
        <Liste
          libelle="Durée"
          nom="duree"
          valeur={etat.valeurs?.duree ?? "45"}
          options={[
            { valeur: "30", libelle: "30 min" },
            { valeur: "45", libelle: "45 min" },
            { valeur: "60", libelle: "1 h" },
          ]}
        />
        <Champ libelle="Places" nom="capacite" type="number" min={2} max={30} requis valeur={etat.valeurs?.capacite ?? "8"} />
      </div>
      <BoutonEnvoi variante="secondaire" enCours="Création…">
        Proposer
      </BoutonEnvoi>
    </form>
  );
}

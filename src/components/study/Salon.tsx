"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  CircleHelp,
  CornerDownRight,
  Flag,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  accuserReception,
  envoyerMessage,
  epingler,
  lu,
  masquer,
  memeQuestion,
  modifierMessage,
  signalerMessage,
  supprimerMessage,
  type ResultatAction,
} from "@/app/app/messagerie/actions";
import type { MessageVu, PageMessages } from "@/lib/v6/messagerie";
import { useMinuteCourante } from "./horloge";
import { useImpulsion } from "./mouvement";

/**
 * Salon de classe — E09.
 *
 * Un message n'est affiché comme « enregistré » qu'après l'accusé du
 * serveur. En cas d'échec, le texte reste là avec « Réessayer », sous le
 * même identifiant client : le serveur ne le créera jamais deux fois. La
 * relecture régulière passe par l'API, sous les droits actuels ; un retrait
 * d'accès efface l'affichage à la relecture suivante.
 */

interface EnAttente {
  readonly clientId: string;
  readonly corps: string;
  readonly parent: string | null;
  readonly kind: "message" | "question" | "annonce";
  readonly lecon: string | null;
  readonly accuse: boolean;
  etat: "envoi" | "echec" | "attente";
  erreur?: string;
}

const INTERVALLE_MS = 8000;

function heure(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

/** Liens rendus cliquables, sans aperçu ni HTML : le reste est du texte échappé par React. */
function Corps({ texte }: { texte: string }) {
  const morceaux = texte.split(/(https?:\/\/[^\s<>"']+)/gu);
  return (
    <p className="m-0 whitespace-pre-wrap break-words">
      {morceaux.map((m, i) =>
        /^https?:\/\//u.test(m) ? (
          <a key={i} href={m} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all">
            {m}
          </a>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </p>
  );
}

export function Salon({
  salon,
  classe,
  moi,
  initiale,
  filInitial,
  seanceCitee,
  citation,
}: {
  salon: { id: string; label: string; mode: "discussion" | "questions" | "annonces" };
  classe: string | null;
  moi: { id: string; prenom: string };
  initiale: PageMessages;
  filInitial: string | null;
  seanceCitee: { id: string; titre: string } | null;
  citation: string | null;
}) {
  const [messages, setMessages] = useState<MessageVu[]>([...initiale.messages].reverse());
  const [suivant, setSuivant] = useState<string | null>(initiale.suivant);
  const [animateur, setAnimateur] = useState(initiale.animateur);
  const [mode, setMode] = useState(initiale.mode ?? salon.mode);
  const [attente, setAttente] = useState<EnAttente[]>([]);
  const [acces, setAcces] = useState<"ok" | "retire" | "session">("ok");
  const [fil, setFil] = useState<string | null>(filInitial);
  const [annonce, setAnnonce] = useState("");
  const liste = useRef<HTMLDivElement>(null);
  const enBas = useRef(true);
  // Arrivés pendant la lecture : apparition courte, et un bouton plutôt qu’un
  // défilement forcé si la personne lit l’historique (brief §3, messagerie).
  const [arrives, setArrives] = useState<ReadonlySet<string>>(() => new Set());
  const [nonVus, setNonVus] = useState(0);

  // --- Relecture régulière ------------------------------------------------
  const relire = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/v6/salons/${salon.id}/messages`, { cache: "no-store" });
      if (reponse.status === 403) {
        setAcces("retire");
        setMessages([]);
        setAttente([]);
        return;
      }
      if (reponse.status === 401) {
        setAcces("session");
        return;
      }
      if (!reponse.ok) return;
      const page = (await reponse.json()) as PageMessages;
      setAnimateur(page.animateur);
      if (page.mode) setMode(page.mode);
      setMessages((anciens) => {
        const recents = [...page.messages].reverse();
        const ids = new Set(recents.map((m) => m.id));
        const nouveaux = recents.filter((m) => !anciens.some((a) => a.id === m.id) && !m.moi);
        if (nouveaux.length > 0) {
          const dernier = nouveaux[nouveaux.length - 1]!;
          setAnnonce(`Nouveau message de ${dernier.auteurNom}`);
          setArrives((a) => new Set([...a, ...nouveaux.map((m) => m.id)]));
          if (!enBas.current) setNonVus((n) => n + nouveaux.length);
        }
        // Les plus anciens chargés restent ; la première page est remplacée.
        return [...anciens.filter((a) => !ids.has(a.id) && a.creeLe < (recents[0]?.creeLe ?? "")), ...recents];
      });
    } catch {
      // Hors ligne : on garde l'affichage, le bandeau réseau le dit.
    }
  }, [salon.id]);

  useEffect(() => {
    void lu(salon.id).catch(() => undefined);
    const minuterie = window.setInterval(() => {
      if (document.visibilityState === "visible") void relire();
    }, INTERVALLE_MS);
    const auRetour = () => void relire();
    window.addEventListener("online", auRetour);
    return () => {
      window.clearInterval(minuterie);
      window.removeEventListener("online", auRetour);
    };
  }, [relire, salon.id]);

  useEffect(() => {
    const el = liste.current;
    if (el && enBas.current) el.scrollTop = el.scrollHeight;
  }, [messages, attente]);

  // --- Envoi ---------------------------------------------------------------
  const envoyer = useCallback(
    async (item: EnAttente) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setAttente((a) => a.map((x) => (x.clientId === item.clientId ? { ...x, etat: "attente", erreur: "En attente du réseau" } : x)));
        return;
      }
      setAttente((a) => a.map((x) => (x.clientId === item.clientId ? { ...x, etat: "envoi", erreur: undefined } : x)));
      let r: ResultatAction;
      try {
        r = await envoyerMessage({
          salon: salon.id,
          corps: item.corps,
          clientId: item.clientId,
          parent: item.parent,
          kind: item.kind,
          lecon: item.lecon,
          exercice: null,
          accuse: item.accuse,
        });
      } catch {
        setAttente((a) => a.map((x) => (x.clientId === item.clientId ? { ...x, etat: "echec", erreur: "Connexion interrompue. Votre texte est gardé." } : x)));
        return;
      }
      if (r.ok) {
        setAttente((a) => a.filter((x) => x.clientId !== item.clientId));
        try {
          window.sessionStorage.removeItem(`study-brouillon-${salon.id}-${item.parent ?? "racine"}`);
        } catch {
          /* ignoré */
        }
        await relire();
        if (item.parent) setFil((f) => f);
      } else {
        if (r.code === "UNAUTHENTICATED") setAcces("session");
        if (r.code === "NOT_ACCESSIBLE" && r.message.startsWith("Ce contenu")) setAcces("retire");
        setAttente((a) => a.map((x) => (x.clientId === item.clientId ? { ...x, etat: "echec", erreur: r.message } : x)));
      }
    },
    [relire, salon.id],
  );

  // Au retour du réseau, ce qui attendait repart — sous le même identifiant.
  useEffect(() => {
    const reprendre = () => attente.filter((a) => a.etat === "attente").forEach((a) => void envoyer(a));
    window.addEventListener("online", reprendre);
    return () => window.removeEventListener("online", reprendre);
  }, [attente, envoyer]);

  const soumettre = (corps: string, options: { parent: string | null; kind?: EnAttente["kind"]; lecon?: string | null; accuse?: boolean }) => {
    const item: EnAttente = {
      clientId: crypto.randomUUID(),
      corps,
      parent: options.parent,
      kind: options.kind ?? "message",
      lecon: options.lecon ?? null,
      accuse: options.accuse ?? false,
      etat: "envoi",
    };
    setAttente((a) => [...a, item]);
    enBas.current = true;
    void envoyer(item);
  };

  const chargerPlusAnciens = async () => {
    if (!suivant || !liste.current) return;
    const hauteurAvant = liste.current.scrollHeight;
    const reponse = await fetch(`/api/v6/salons/${salon.id}/messages?avant=${encodeURIComponent(suivant)}`, { cache: "no-store" });
    if (!reponse.ok) return;
    const page = (await reponse.json()) as PageMessages;
    enBas.current = false;
    setMessages((m) => [...[...page.messages].reverse(), ...m]);
    setSuivant(page.suivant);
    // La position de lecture ne bouge pas.
    requestAnimationFrame(() => {
      if (liste.current) liste.current.scrollTop = liste.current.scrollHeight - hauteurAvant;
    });
  };

  const racines = useMemo(() => messages.filter((m) => m.parentId === null), [messages]);
  const epingles = racines.filter((m) => m.epingle && !m.supprime);
  const peutEcrire = mode !== "annonces" || animateur;

  if (acces === "retire") {
    return (
      <div role="alert" className="panneau text-center">
        <p className="titre-bloc m-0 font-semibold">Ce salon n&apos;est plus accessible</p>
        <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
          Ton accès a été retiré ou la classe a changé. Les messages affichés ont été effacés de cet écran.
        </p>
        <Link href="/app/messagerie" className="bouton bouton-secondaire mt-4">
          Mes salons
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-h-[60dvh] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="panneau flex min-h-[60dvh] flex-col p-0 md:p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="titre-bloc m-0 truncate"># {salon.label}</h2>
            <p className="meta m-0">
              {mode === "annonces" ? "Annonces de l'équipe pédagogique" : mode === "questions" ? "Questions — on répond dans les fils" : "Discussion ouverte"}
            </p>
          </div>
        </div>

        {acces === "session" ? (
          <div role="alert" className="mx-4 mt-3 rounded-[10px] bg-[color:var(--color-attention-fond)] p-3 text-[0.8125rem] text-[color:var(--color-attention)]">
            Ta session a pris fin. Ton brouillon est gardé sur cet appareil.{" "}
            <a href={`/connexion?motif=expiree&suite=${encodeURIComponent(typeof window === "undefined" ? "/app/messagerie" : window.location.pathname)}`} className="font-semibold">
              Se reconnecter
            </a>
          </div>
        ) : null}

        {epingles.length > 0 ? (
          <div className="mx-4 mt-3 grid gap-2">
            {epingles.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => document.getElementById(`m-${m.id}`)?.scrollIntoView({ block: "center" })}
                className="flex w-full items-start gap-2 rounded-[10px] bg-[color:var(--color-rose-clair)] p-3 text-left"
              >
                <Pin size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-semibold">{m.corps.split("\n")[0]}</span>
                  <span className="meta">{m.auteurNom} · épinglé</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={liste}
          className="flex-1 overflow-y-auto px-4 py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            enBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (enBas.current && nonVus > 0) setNonVus(0);
          }}
        >
          {suivant ? (
            <div className="mb-3 text-center">
              <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => void chargerPlusAnciens()}>
                Messages précédents
              </button>
            </div>
          ) : null}
          {racines.length === 0 && attente.length === 0 ? (
            <p className="m-0 py-10 text-center text-[color:var(--color-encre-faible)]">
              {mode === "annonces" ? "Aucune annonce pour l'instant." : "Aucun message. Une question ? Elle aidera sûrement quelqu'un d'autre."}
            </p>
          ) : null}
          <ol className="m-0 list-none p-0">
            {racines.map((m) => (
              <li key={m.id} id={`m-${m.id}`} className={arrives.has(m.id) ? "message-nouveau" : undefined}>
                <Message m={m} animateur={animateur} mode={mode} classe={classe} surFil={() => setFil(m.id)} apres={relire} />
              </li>
            ))}
          </ol>
          {attente
            .filter((a) => a.parent === null)
            .map((a) => (
              <EnvoiLocal key={a.clientId} item={a} prenom={moi.prenom} reessayer={() => void envoyer(a)} abandonner={() => setAttente((x) => x.filter((y) => y.clientId !== a.clientId))} />
            ))}
          {nonVus > 0 ? (
            <div className="nouveaux-messages">
              <button
                type="button"
                className="bouton bouton-primaire bouton-compact"
                onClick={() => {
                  const el = liste.current;
                  const doux = document.documentElement.dataset.effets === "auto" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                  if (el) el.scrollTo({ top: el.scrollHeight, behavior: doux ? "smooth" : "auto" });
                  enBas.current = true;
                  setNonVus(0);
                }}
              >
                Nouveaux messages · {nonVus}
              </button>
            </div>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {annonce}
          </p>
        </div>

        <div className="composeur border-t border-[color:var(--color-bordure)] p-3">
          {peutEcrire ? (
            <Composeur
              cle={`study-brouillon-${salon.id}-racine`}
              animateur={animateur}
              mode={mode}
              seanceCitee={seanceCitee}
              citation={citation}
              envoyer={(corps, o) => soumettre(corps, { parent: null, ...o })}
              etiquette={`Écrire dans ${salon.label}`}
            />
          ) : (
            <p className="m-0 flex items-center gap-2 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
              <Megaphone size={16} strokeWidth={1.75} aria-hidden="true" /> Ce salon est réservé aux annonces de l&apos;équipe pédagogique.
              Pour une question, utilise le salon de la matière ou{" "}
              <Link href="/app/demandes/nouvelle">écris à un adulte</Link>.
            </p>
          )}
        </div>
      </div>

      {fil ? (
        <Fil
          salon={salon.id}
          racine={fil}
          animateur={animateur}
          mode={mode}
          classe={classe}
          moi={moi}
          attente={attente.filter((a) => a.parent === fil)}
          fermer={() => setFil(null)}
          envoyer={(corps) => soumettre(corps, { parent: fil })}
          reessayer={(a) => void envoyer(a)}
          retirer={(id) => setAttente((x) => x.filter((y) => y.clientId !== id))}
          relire={relire}
        />
      ) : (
        <aside className="hidden xl:block">
          <div className="panneau text-[0.8125rem] text-[color:var(--color-encre-faible)]">
            <p className="m-0 font-semibold text-[color:var(--color-encre)]">Bon à savoir</p>
            <ul className="m-0 mt-2 grid gap-1.5 pl-4">
              <li>Les messages sont lus par ta classe et ses professeurs, et conservés par l&apos;établissement.</li>
              <li>Ils ne sont pas chiffrés de bout en bout : la modération peut les lire en cas de signalement.</li>
              <li>Aucune adresse ni heure de connexion n&apos;est affichée.</li>
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

function EnvoiLocal({ item, prenom, reessayer, abandonner }: { item: EnAttente; prenom: string; reessayer: () => void; abandonner: () => void }) {
  return (
    <div className="my-3 flex flex-row-reverse gap-3">
      <div className="max-w-[min(620px,85%)] rounded-[12px_0_12px_12px] bg-[color:var(--color-rose-clair)] px-4 py-3">
        <p className="meta m-0 mb-1 text-right">{prenom}</p>
        <Corps texte={item.corps} />
        <p className="meta m-0 mt-1 flex items-center justify-end gap-2" role="status">
          {item.etat === "envoi" ? "Envoi…" : item.etat === "attente" ? "En attente du réseau" : null}
          {item.etat === "echec" ? (
            <>
              <span className="text-[color:var(--color-erreur)]">
                <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true" className="mr-1 inline" />
                {item.erreur ?? "Non envoyé"}
              </span>
              <button type="button" className="bouton bouton-secondaire bouton-compact" onClick={reessayer}>
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> Réessayer
              </button>
              <button type="button" className="bouton bouton-discret bouton-compact" onClick={abandonner} aria-label="Abandonner ce message">
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function Message({
  m,
  animateur,
  mode,
  classe,
  surFil,
  apres,
  dansFil = false,
}: {
  m: MessageVu;
  animateur: boolean;
  mode: string;
  classe: string | null;
  surFil?: () => void;
  apres: () => Promise<void>;
  dansFil?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [signalement, setSignalement] = useState(false);
  const [joindre, setJoindre] = useState(false);
  const agir =(f: () => Promise<ResultatAction>) =>
    demarrer(async () => {
      setErreur(null);
      try {
        const r = await f();
        if (!r.ok) setErreur(r.message);
        await apres();
      } catch {
        setErreur("Action non enregistrée : connexion interrompue.");
      }
    });
  const minute = useMinuteCourante();
  const impulsion = useImpulsion(m.moiAussi, 220);
  const modifiable = m.moi && !m.supprime && minute * 60_000 - Date.parse(m.creeLe) < 14 * 60_000;

  if (m.supprime) {
    return <p className="meta my-3 italic">Message supprimé{m.reponses > 0 ? ` · ${m.reponses} réponse${m.reponses > 1 ? "s" : ""}` : ""}</p>;
  }

  return (
    <article className={`my-4 flex gap-3 ${m.moi ? "flex-row-reverse" : ""}`} aria-label={`Message de ${m.auteurNom}`}>
      <span className="avatar" aria-hidden="true">
        {m.auteurInitiales}
      </span>
      <div className={`min-w-0 max-w-[min(620px,85%)] ${m.moi ? "text-right" : ""}`}>
        <p className="m-0 flex flex-wrap items-center gap-2 text-[0.75rem] font-bold" style={{ justifyContent: m.moi ? "flex-end" : "flex-start" }}>
          {m.auteurNom}
          {m.auteurAdulte ? <span className="etiquette-etat" data-ton="rose">Professeur</span> : null}
          {m.kind === "question" ? <span className="etiquette-etat">Question</span> : null}
          {m.kind === "annonce" ? <span className="etiquette-etat" data-ton="attention">Annonce</span> : null}
          <time className="font-normal text-[color:var(--color-encre-faible)]" dateTime={m.creeLe}>
            {heure(m.creeLe)}
            {m.modifieLe ? " · modifié" : ""}
          </time>
        </p>
        <div
          className={`mt-1 inline-block px-4 py-3 text-left ${
            m.moi ? "rounded-[12px_0_12px_12px] bg-[color:var(--color-rose-clair)]" : "rounded-[0_12px_12px_12px] bg-[color:var(--color-surface-douce)]"
          } ${m.masque ? "opacity-60" : ""}`}
        >
          {m.masque ? <p className="meta m-0 mb-1">Masqué par la modération — visible seulement par son auteur et l&apos;équipe.</p> : null}
          {edition ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const corps = String(new FormData(e.currentTarget).get("corps") ?? "");
                agir(async () => {
                  const r = await modifierMessage(m.id, corps, m.version);
                  if (r.ok) setEdition(false);
                  return r;
                });
              }}
            >
              <label className="sr-only" htmlFor={`edit-${m.id}`}>
                Modifier le message
              </label>
              <textarea id={`edit-${m.id}`} name="corps" defaultValue={m.corps} className="champ min-w-[240px]" rows={3} maxLength={4000} />
              <div className="mt-2 flex gap-2">
                <button type="submit" className="bouton bouton-primaire bouton-compact" disabled={enCours}>
                  Enregistrer
                </button>
                <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => setEdition(false)}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <Corps texte={m.corps} />
          )}
          {m.leconId ? (
            <Link href={`/app/seances/${m.leconId}`} className="meta mt-2 inline-flex items-center gap-1">
              <CornerDownRight size={14} strokeWidth={1.75} aria-hidden="true" /> Séance citée
            </Link>
          ) : null}
          {m.pieces.length > 0 ? (
            <ul className="m-0 mt-2 grid list-none gap-1 p-0">
              {m.pieces.map((p) => (
                <li key={p.id}>
                  {/* Téléchargement par le serveur : les droits sont relus à chaque ouverture. */}
                  <a href={`/documents/${p.id}`} className="meta inline-flex items-center gap-1 font-semibold">
                    <Paperclip size={14} strokeWidth={1.75} aria-hidden="true" /> {p.nom}
                    <span className="font-normal"> · {taille(p.taille)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {joindre ? <Joindre message={m.id} fermer={() => setJoindre(false)} apres={apres} /> : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" style={{ justifyContent: m.moi ? "flex-end" : "flex-start" }}>
          {!dansFil && m.parentId === null && mode !== "annonces" && m.kind !== "annonce" ? (
            <button
              type="button"
              aria-pressed={m.moiAussi}
              disabled={enCours}
              onClick={() => agir(() => memeQuestion(m.id, !m.moiAussi))}
              className={`bouton bouton-compact ${m.moiAussi ? "bouton-secondaire" : "bouton-discret"} ${impulsion && m.moiAussi ? "reaction-active" : ""}`}
            >
              <CircleHelp size={14} strokeWidth={1.75} aria-hidden="true" /> J&apos;ai la même question{m.memeQuestion > 0 ? ` · ${m.memeQuestion}` : ""}
            </button>
          ) : null}
          {!dansFil && surFil && m.parentId === null ? (
            <button type="button" onClick={surFil} className="bouton bouton-discret bouton-compact">
              <CornerDownRight size={14} strokeWidth={1.75} aria-hidden="true" />
              {m.reponses > 0 ? `${m.reponses} réponse${m.reponses > 1 ? "s" : ""}` : mode === "annonces" && !animateur ? "Voir" : "Répondre"}
            </button>
          ) : null}
          {m.kind === "annonce" && m.demandeAccuse && !m.moi ? (
            <button type="button" disabled={enCours} onClick={() => agir(() => accuserReception(m.id))} className="bouton bouton-discret bouton-compact">
              <Check size={14} strokeWidth={1.75} aria-hidden="true" /> J&apos;ai pris connaissance
            </button>
          ) : null}
          {m.accuses !== null && m.demandeAccuse ? <span className="meta">{m.accuses} accusé{m.accuses > 1 ? "s" : ""} de lecture</span> : null}
          <details className="menu-deroulant">
            <summary className="bouton bouton-discret bouton-compact" aria-label="Plus d'actions">
              <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className={`menu-deroulant-panneau ${m.moi ? "right-0" : "left-0"} top-[40px] grid gap-0.5`}>
              {modifiable ? (
                <button type="button" className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left" onClick={() => setEdition(true)}>
                  <Pencil size={16} strokeWidth={1.75} aria-hidden="true" /> Modifier
                </button>
              ) : null}
              {m.moi && !m.masque && m.pieces.length < 3 ? (
                <button type="button" className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left" onClick={() => setJoindre(true)}>
                  <Paperclip size={16} strokeWidth={1.75} aria-hidden="true" /> Joindre un fichier
                </button>
              ) : null}
              {m.moi || animateur ? (
                <button
                  type="button"
                  className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left"
                  onClick={() => {
                    if (window.confirm("Supprimer ce message ? Son contenu ne sera plus affiché à la classe.")) agir(() => supprimerMessage(m.id));
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /> Supprimer
                </button>
              ) : null}
              {animateur && m.parentId === null ? (
                <button type="button" className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left" onClick={() => agir(() => epingler(m.id, !m.epingle))}>
                  {m.epingle ? <PinOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pin size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {m.epingle ? "Désépingler" : "Épingler"}
                </button>
              ) : null}
              {animateur && classe ? (
                <Link
                  href={`/app/classes/${classe}/bibliotheque?message=${m.id}&titre=${encodeURIComponent(m.corps.slice(0, 80))}`}
                  className="lien-barre"
                >
                  <BookmarkPlus size={16} strokeWidth={1.75} aria-hidden="true" /> À retenir (bibliothèque)
                </Link>
              ) : null}
              {animateur && !m.moi ? (
                <button
                  type="button"
                  className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left"
                  onClick={() => {
                    const motif = window.prompt(m.masque ? "Motif du rétablissement" : "Motif du masquage (journalisé)");
                    if (motif && motif.trim().length >= 3) agir(() => masquer(m.id, !m.masque, motif));
                  }}
                >
                  <X size={16} strokeWidth={1.75} aria-hidden="true" /> {m.masque ? "Rétablir" : "Masquer"}
                </button>
              ) : null}
              {!m.moi ? (
                <button type="button" className="lien-barre w-full cursor-pointer border-0 bg-transparent text-left" onClick={() => setSignalement(true)}>
                  <Flag size={16} strokeWidth={1.75} aria-hidden="true" /> Signaler
                </button>
              ) : null}
            </div>
          </details>
        </div>
        {signalement ? <Signalement id={m.id} fermer={() => setSignalement(false)} /> : null}
        {erreur ? (
          <p role="alert" className="m-0 mt-1 text-[0.75rem] text-[color:var(--color-erreur)]">
            {erreur}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function taille(octets: number) {
  return octets >= 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * Joindre un fichier à son propre message, déjà envoyé. Le fichier est
 * vérifié par le serveur (format réel, taille) avant d'être montré à la
 * classe ; un refus laisse le message intact.
 */
function Joindre({ message, fermer, apres }: { message: string; fermer: () => void; apres: () => Promise<void> }) {
  // Phases réelles : « envoi » tant que les octets partent (progression du
  // transfert), « vérification » pendant que le serveur contrôle et enregistre.
  const [etat, setEtat] = useState<{ phase: "saisie" | "envoi" | "verification" | "fait" | "erreur"; texte?: string }>({ phase: "saisie" });
  return (
    <form
      className="mt-2 grid gap-2 rounded-[10px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-3 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        const fichier = donnees.get("fichier");
        if (!(fichier instanceof File) || fichier.size === 0) {
          setEtat({ phase: "erreur", texte: "Choisissez un fichier." });
          return;
        }
        if (fichier.size > 10 * 1024 * 1024) {
          setEtat({ phase: "erreur", texte: "Ce fichier dépasse 10 Mo." });
          return;
        }
        setEtat({ phase: "envoi" });
        const reponse = await new Promise<{ statut: number; corps: string } | null>((resoudre) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/v6/messages/${message}/pieces`);
          xhr.upload.onload = () => setEtat({ phase: "verification" });
          xhr.onload = () => resoudre({ statut: xhr.status, corps: xhr.responseText });
          xhr.onerror = () => resoudre(null);
          xhr.send(donnees);
        });
        if (reponse === null) {
          setEtat({ phase: "erreur", texte: "Connexion interrompue : le fichier n'a pas été joint." });
          return;
        }
        if (reponse.statut < 200 || reponse.statut >= 300) {
          let texte = "Le fichier n'a pas été joint.";
          try {
            texte = (JSON.parse(reponse.corps) as { error?: { message?: string } }).error?.message ?? texte;
          } catch {
            /* réponse illisible : message générique */
          }
          setEtat({ phase: "erreur", texte: reponse.statut === 401 ? "Session terminée : reconnectez-vous, puis réessayez." : texte });
          return;
        }
        setEtat({ phase: "fait" });
        await apres();
        fermer();
      }}
    >
      <label htmlFor={`piece-${message}`} className="text-[0.8125rem] font-semibold">
        Joindre un fichier
      </label>
      <input id={`piece-${message}`} name="fichier" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="champ" required />
      <p className="meta m-0">PDF ou image (PNG, JPEG, WebP), 10 Mo au plus. Visible par les membres du salon une fois vérifié.</p>
      {etat.phase === "erreur" ? (
        <p role="alert" className="m-0 text-[0.75rem] text-[color:var(--color-erreur)]">
          {etat.texte}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {etat.phase === "envoi" ? "Envoi du fichier…" : etat.phase === "verification" ? "Vérification du fichier…" : etat.phase === "fait" ? "Fichier joint." : ""}
      </p>
      <div className="flex gap-2">
        <button type="submit" className="bouton bouton-primaire bouton-compact" disabled={etat.phase === "envoi" || etat.phase === "verification"}>
          {etat.phase === "envoi" ? "Envoi…" : etat.phase === "verification" ? "Vérification…" : "Joindre"}
        </button>
        <button type="button" className="bouton bouton-discret bouton-compact" onClick={fermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function Signalement({ id, fermer }: { id: string; fermer: () => void }) {
  const [etat, setEtat] = useState<"saisie" | "envoi" | "fait" | string>("saisie");
  if (etat === "fait") {
    return (
      <p role="status" className="m-0 mt-2 rounded-[10px] bg-[color:var(--color-succes-fond)] p-3 text-left text-[0.8125rem] text-[color:var(--color-succes)]">
        Signalement reçu. Il est transmis à l&apos;administration de l&apos;établissement (et pas seulement au professeur du salon). La personne
        signalée ne saura pas qui l&apos;a signalée.{" "}
        <button type="button" className="underline" onClick={fermer}>
          Fermer
        </button>
      </p>
    );
  }
  return (
    <form
      className="mt-2 rounded-[10px] border border-[color:var(--color-bordure)] p-3 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        setEtat("envoi");
        const r = await signalerMessage(id, String(d.get("motif") ?? ""), String(d.get("commentaire") ?? ""));
        setEtat(r.ok ? "fait" : r.message);
      }}
    >
      <label className="mb-1.5 block text-[0.8125rem] font-semibold" htmlFor={`motif-${id}`}>
        Motif du signalement
      </label>
      <select id={`motif-${id}`} name="motif" className="champ" required defaultValue="">
        <option value="" disabled>
          Choisir…
        </option>
        <option value="harcelement">Harcèlement ou moquerie</option>
        <option value="contenu_inapproprie">Contenu inapproprié</option>
        <option value="hors_sujet">Hors sujet</option>
        <option value="autre">Autre</option>
      </select>
      <label className="mb-1.5 mt-3 block text-[0.8125rem] font-semibold" htmlFor={`commentaire-${id}`}>
        Commentaire <span className="font-normal text-[color:var(--color-encre-faible)]">(facultatif)</span>
      </label>
      <textarea id={`commentaire-${id}`} name="commentaire" className="champ" rows={2} maxLength={1000} />
      {etat !== "saisie" && etat !== "envoi" ? (
        <p role="alert" className="m-0 mt-2 text-[0.75rem] text-[color:var(--color-erreur)]">
          {etat}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="bouton bouton-primaire bouton-compact" disabled={etat === "envoi"}>
          {etat === "envoi" ? "Envoi…" : "Signaler"}
        </button>
        <button type="button" className="bouton bouton-discret bouton-compact" onClick={fermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function Composeur({
  cle,
  animateur,
  mode,
  seanceCitee,
  citation,
  envoyer,
  etiquette,
}: {
  cle: string;
  animateur: boolean;
  mode: string;
  seanceCitee?: { id: string; titre: string } | null;
  citation?: string | null;
  envoyer: (corps: string, options: { kind?: EnAttente["kind"]; lecon?: string | null; accuse?: boolean }) => void;
  etiquette: string;
}) {
  const [texte, setTexte] = useState(() => (citation ? `« ${citation} »\n` : ""));
  const [lecon, setLecon] = useState(seanceCitee ?? null);
  const [type, setType] = useState<EnAttente["kind"]>("message");
  const [accuse, setAccuse] = useState(false);

  useEffect(() => {
    try {
      const b = window.sessionStorage.getItem(cle);
      // Lecture asynchrone d'un système externe : le brouillon ne réécrit pas le rendu en cours.
      if (b && !citation) window.setTimeout(() => setTexte(b), 0);
    } catch {
      /* ignoré */
    }
  }, [cle, citation]);
  useEffect(() => {
    try {
      if (texte) window.sessionStorage.setItem(cle, texte);
      else window.sessionStorage.removeItem(cle);
    } catch {
      /* ignoré */
    }
  }, [cle, texte]);

  const partir = () => {
    const corps = texte.trim();
    if (!corps) return;
    envoyer(corps, { kind: type, lecon: lecon?.id ?? null, accuse: type === "annonce" && accuse });
    setTexte("");
    setLecon(null);
    setAccuse(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        partir();
      }}
    >
      {lecon ? (
        <p className="meta m-0 mb-2 flex items-center gap-2">
          <CornerDownRight size={14} strokeWidth={1.75} aria-hidden="true" /> Séance citée : {lecon.titre}
          <button type="button" className="underline" onClick={() => setLecon(null)}>
            retirer
          </button>
        </p>
      ) : null}
      {animateur && mode !== "questions" ? (
        <div className="mb-2 flex flex-wrap items-center gap-3 text-[0.8125rem]">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="type" checked={type === "message"} onChange={() => setType("message")} /> Message
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="type" checked={type === "annonce"} onChange={() => setType("annonce")} /> Annonce
          </label>
          {type === "annonce" ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={accuse} onChange={(e) => setAccuse(e.target.checked)} /> Demander « pris connaissance »
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor={`${cle}-texte`} className="sr-only">
          {etiquette}
        </label>
        <textarea
          id={`${cle}-texte`}
          className="champ max-h-[40dvh] min-h-[44px] flex-1 resize-none"
          rows={Math.min(6, Math.max(1, texte.split("\n").length))}
          value={texte}
          maxLength={4000}
          placeholder={mode === "questions" && !animateur ? "Pose ta question…" : "Écrire à la classe…"}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              partir();
            }
          }}
        />
        <button type="submit" className="bouton bouton-primaire h-[44px] w-[44px] p-0" aria-label="Envoyer" disabled={texte.trim().length === 0}>
          <Send size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <p className="meta m-0 mt-1">
        Entrée pour envoyer, Maj+Entrée pour aller à la ligne. {texte.length > 3500 ? `${4000 - texte.length} caractères restants.` : ""}
      </p>
    </form>
  );
}

function Fil({
  salon,
  racine,
  animateur,
  mode,
  classe,
  moi,
  attente,
  fermer,
  envoyer,
  reessayer,
  retirer,
  relire,
}: {
  salon: string;
  racine: string;
  animateur: boolean;
  mode: string;
  classe: string | null;
  moi: { id: string; prenom: string };
  attente: EnAttente[];
  fermer: () => void;
  envoyer: (corps: string) => void;
  reessayer: (a: EnAttente) => void;
  retirer: (clientId: string) => void;
  relire: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<MessageVu[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const charger = useCallback(async () => {
    try {
      const r = await fetch(`/api/v6/salons/${salon}/messages?fil=${racine}`, { cache: "no-store" });
      if (!r.ok) {
        setErreur(true);
        return;
      }
      setMessages(((await r.json()) as PageMessages).messages as MessageVu[]);
    } catch {
      setErreur(true);
    }
  }, [salon, racine]);
  useEffect(() => {
    const premier = window.setTimeout(() => void charger(), 0);
    const t = window.setInterval(() => void charger(), INTERVALLE_MS);
    return () => {
      window.clearTimeout(premier);
      window.clearInterval(t);
    };
  }, [charger, attente.length]);
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => titre.current?.focus(), [racine]);

  const peutRepondre = mode !== "annonces" || animateur;
  return (
    <aside
      className="panneau-fil fixed inset-0 z-40 flex flex-col bg-[color:var(--color-surface)] xl:static xl:z-auto xl:rounded-[var(--radius-carte)] xl:border xl:border-[color:var(--color-bordure)]"
      aria-label="Fil de discussion"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-bordure)] px-4 py-3">
        <h2 ref={titre} tabIndex={-1} className="titre-bloc m-0 outline-none">
          Fil
        </h2>
        <button type="button" onClick={fermer} className="bouton-icone" aria-label="Fermer le fil">
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {erreur ? <p className="m-0 text-[color:var(--color-erreur)]">Ce fil n&apos;a pas pu être chargé.</p> : null}
        {messages === null && !erreur ? <span className="squelette-ligne my-4 w-2/3" /> : null}
        {(messages ?? []).map((m) => (
          <Message key={m.id} m={m} animateur={animateur} mode={mode} classe={classe} apres={async () => { await charger(); await relire(); }} dansFil />
        ))}
        {attente.map((a) => (
          <EnvoiLocal key={a.clientId} item={a} prenom={moi.prenom} reessayer={() => reessayer(a)} abandonner={() => retirer(a.clientId)} />
        ))}
      </div>
      <div className="border-t border-[color:var(--color-bordure)] p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {peutRepondre ? (
          <Composeur cle={`study-brouillon-${salon}-${racine}`} animateur={false} mode="discussion" envoyer={(c) => envoyer(c)} etiquette="Répondre dans le fil" />
        ) : (
          <p className="meta m-0">Les annonces ne reçoivent pas de réponse dans le salon.</p>
        )}
      </div>
    </aside>
  );
}

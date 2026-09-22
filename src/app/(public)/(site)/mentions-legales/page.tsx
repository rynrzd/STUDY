import type { Metadata } from "next";
import { pagePublique } from "@/lib/metadonnees";
import Link from "next/link";
import { Prose, Section, TitrePage } from "@/components/site/Ui";
import {
  DOMAINE,
  IDENTITE,
  MARQUE,
  mention,
  mentionsManquantes,
} from "@/lib/identite-legale";

export const metadata: Metadata = pagePublique({
  chemin: "/mentions-legales",
  titre: "Mentions légales",
  description:
    "Éditeur, directeur de la publication, hébergeur et informations de publication.",
});

/**
 * Mentions légales.
 *
 * Toutes les valeurs viennent de `identite-legale.ts`. Celles qui ne seraient
 * pas encore officiellement établies s'afficheraient « En cours de
 * publication » : un numéro d'immatriculation inventé sur cette page-ci serait
 * une fausse déclaration, pas une approximation.
 *
 * **Trois identités, et la page les sépare.** L'entreprise qui édite le
 * service, le nom commercial sous lequel il est vendu, et l'hébergeur qui le
 * sert. Les confondre est l'erreur la plus courante des pages légales — et
 * c'est celle qui laisse croire qu'un nom commercial est une société.
 */

const MANQUANTES = mentionsManquantes();

export default function PageMentionsLegales() {
  return (
    <>
      <TitrePage surtitre="Informations légales" titre="Mentions légales." />

      <Section>
        <dl className="m-0 max-w-[var(--spacing-lecture)] space-y-6 p-0">
          <Ligne terme="Entreprise éditrice">
            {IDENTITE.editeur} — {IDENTITE.formeJuridique}
          </Ligne>
          <Ligne terme="Nom commercial du service">
            {IDENTITE.nomCommercial}
            {/* Sans cette phrase, un lecteur suppose une société : c'est la
                confusion la plus fréquente sur une page légale, et elle
                change qui est responsable. */}
            <span className="mt-1.5 block">
              {IDENTITE.nomCommercial} est un nom commercial, et non une
              société. Le service est exploité par l&apos;entreprise
              individuelle nommée ci-dessus.
            </span>
          </Ligne>
          <Ligne terme="Adresse professionnelle">{mention(IDENTITE.adresse)}</Ligne>
          <Ligne terme="SIREN">{mention(IDENTITE.siren)}</Ligne>
          <Ligne terme="SIRET">{mention(IDENTITE.siret)}</Ligne>
          <Ligne terme="Code APE">{mention(IDENTITE.codeApe)}</Ligne>
          <Ligne terme="TVA">
            {/* La franchise en base n'attribue pas de numéro intracommunautaire.
                Afficher « en cours de publication » à sa place laisserait croire
                qu'il en manque un, alors que la mention due est celle-ci. */}
            {mention(IDENTITE.regimeTva)}
            {IDENTITE.tvaIntracommunautaire === null ? null : (
              <span className="mt-1.5 block">
                Numéro intracommunautaire : {IDENTITE.tvaIntracommunautaire}
              </span>
            )}
          </Ligne>
          <Ligne terme="Directeur de la publication">
            {IDENTITE.directeurPublication}
          </Ligne>
          <Ligne terme="Contact">
            {IDENTITE.contactEmail === null ? (
              <>
                En cours de publication. En attendant, le{" "}
                <Link href="/etablissements" className="text-[color:var(--color-accent)]">
                  formulaire de demande
                </Link>{" "}
                enregistre votre message et vous rend une référence de suivi.
              </>
            ) : (
              <a href={`mailto:${IDENTITE.contactEmail}`} className="text-[color:var(--color-accent)]">
                {IDENTITE.contactEmail}
              </a>
            )}
          </Ligne>
          <Ligne terme="Hébergeur technique">
            {IDENTITE.hebergeur.nom}
            {IDENTITE.hebergeur.raisonSociale === null
              ? ""
              : ` — ${IDENTITE.hebergeur.raisonSociale}`}
            {IDENTITE.hebergeur.adresse === null ? "" : `, ${IDENTITE.hebergeur.adresse}`}
            {IDENTITE.hebergeur.raisonSociale === null || IDENTITE.hebergeur.adresse === null
              ? " — coordonnées légales complètes en cours de publication"
              : ""}
            <span className="mt-1.5 block">
              Prestataire technique distinct de l&apos;éditeur : il héberge
              l&apos;application, il ne l&apos;édite pas.
            </span>
          </Ligne>
          {IDENTITE.contactTelephone === null ? null : (
            <Ligne terme="Téléphone">
              <a
                href={`tel:${IDENTITE.contactTelephone.replace(/\s/g, "")}`}
                className="text-[color:var(--color-accent)]"
              >
                {IDENTITE.contactTelephone}
              </a>
            </Ligne>
          )}
          <Ligne terme="Adresse du site">{DOMAINE}</Ligne>
        </dl>
      </Section>

      {MANQUANTES.length > 0 ? (
        <Section fond="doux">
          <div className="carte max-w-[var(--spacing-lecture)] p-7">
            <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              Mentions en cours de publication
            </h2>
            <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">
              Les éléments suivants sont en cours d&apos;enregistrement et seront
              publiés ici dès qu&apos;ils seront officiels. Ils ne sont pas
              affichés par approximation : une immatriculation ne se devine pas.
            </p>
            <ul className="m-0 mt-5 list-none space-y-2 p-0 text-[color:var(--color-encre-faible)]">
              {MANQUANTES.map((element) => (
                <li key={element} className="flex gap-2.5 border-t border-[color:var(--color-bordure)] pt-2">
                  {element.charAt(0).toUpperCase() + element.slice(1)}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      <Section fond={MANQUANTES.length > 0 ? "clair" : "doux"}>
        <Prose>
          <h2>Propriété intellectuelle</h2>
          <p>
            La structure du site, ses textes et son interface sont la propriété
            de l&apos;éditeur. Les contenus pédagogiques déposés par un
            établissement, un enseignant ou un élève restent la propriété de leur
            auteur ou de l&apos;établissement, selon ce que prévoit le contrat.
            {" "}{MARQUE} n&apos;en acquiert aucun droit d&apos;exploitation et
            ne les réutilise pour aucun autre usage.
          </p>

          <h2>Données personnelles</h2>
          <p>
            Le traitement des données, les durées de conservation et l&apos;exercice
            des droits sont décrits dans la page{" "}
            <Link href="/confidentialite">confidentialité</Link>. Les conditions
            d&apos;utilisation du service figurent dans les{" "}
            <Link href="/conditions">conditions</Link>.
          </p>

          <h2>Signalement</h2>
          <p>
            Un contenu illicite, une atteinte à un droit ou un défaut de sécurité
            peut nous être signalé depuis la page{" "}
            <Link href="/contact">contact</Link>. Nous accusons réception de
            chaque signalement.
          </p>
        </Prose>
      </Section>
    </>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[color:var(--color-bordure)] pb-6">
      <dt className="font-semibold">{terme}</dt>
      <dd className="m-0 mt-2 text-[color:var(--color-encre-faible)]">{children}</dd>
    </div>
  );
}

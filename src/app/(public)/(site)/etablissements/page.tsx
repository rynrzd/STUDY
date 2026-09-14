import type { Metadata } from "next";
import { TitrePage, BandeauIndisponible } from "@/components/public/Chrome";

export const metadata: Metadata = {
  title: "Pour les établissements",
  description:
    "Demander un devis pour équiper votre lycée. Aucun fichier d'élèves n'est " +
    "demandé à cette étape.",
};

/**
 * /etablissements — formulaire de demande (ch. 05).
 *
 * Champs exactement ceux du cahier des charges : nom, type, commune, effectif
 * approximatif, nom et fonction du contact, email professionnel, message ;
 * téléphone facultatif. **Aucun fichier d'élèves à cette étape.**
 *
 * Le bouton d'envoi est désactivé et le dit. Le ch. 19 interdit les boutons
 * factices : afficher un bouton qui ne fait rien, ou pire qui affiche « merci »
 * sans rien enregistrer, serait simuler une fonctionnalité comme réussie.
 * Le formulaire reste affiché pour que la saisie et l'accessibilité soient
 * revues dès maintenant.
 */

const CHAMP =
  "mt-2 block w-full min-h-[44px] rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] " +
  "bg-[color:var(--color-surface)] px-3 text-[length:var(--text-corps)] " +
  "disabled:bg-[color:var(--color-fond)] disabled:text-[color:var(--color-encre-faible)]";

const ETIQUETTE = "block font-semibold";
const AIDE = "mt-1 block text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]";

export default function Etablissements() {
  return (
    <>
      <TitrePage
        surtitre="Pour les établissements"
        titre="Parlons de vos classes."
        chapeau="Dites-nous comment votre lycée est équipé et ce que vous cherchez à régler. Nous répondons avec un devis, pas avec une relance commerciale."
      />

      <div className="grid gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <BandeauIndisponible
            quoi="Le formulaire ci-dessous est affiché pour revue : il ne peut rien envoyer."
            bloquePar="la base de données et le fournisseur d'e-mail ne sont pas raccordés. Écrire un faux « merci, message envoyé » reviendrait à simuler une fonctionnalité qui n'existe pas."
          />

          <form className="mt-8 space-y-6" aria-describedby="mention-information">
            <fieldset className="m-0 border-0 p-0" disabled>
              <legend className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)] titre-app">
                L&apos;établissement
              </legend>

              <div className="mt-6 space-y-6">
                <div>
                  <label className={ETIQUETTE} htmlFor="nom-etablissement">
                    Nom de l&apos;établissement
                  </label>
                  <input className={CHAMP} id="nom-etablissement" name="nom" type="text" autoComplete="organization" required />
                </div>

                <fieldset className="m-0 border-0 p-0">
                  <legend className={ETIQUETTE}>Type d&apos;établissement</legend>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {[
                      ["public", "Public"],
                      ["prive", "Privé"],
                      ["autre", "Autre"],
                    ].map(([valeur, libelle]) => (
                      <label key={valeur} className="inline-flex min-h-[44px] items-center gap-2">
                        <input type="radio" name="type" value={valeur} className="h-4 w-4" />
                        {libelle}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className={ETIQUETTE} htmlFor="commune">Commune</label>
                    <input className={CHAMP} id="commune" name="commune" type="text" autoComplete="address-level2" />
                  </div>
                  <div>
                    <label className={ETIQUETTE} htmlFor="effectif">
                      Nombre approximatif d&apos;élèves
                    </label>
                    <input className={CHAMP} id="effectif" name="effectif" type="number" min={0} max={10000} inputMode="numeric" aria-describedby="aide-effectif" />
                    <span className={AIDE} id="aide-effectif">
                      Un ordre de grandeur suffit. Il servira à établir le devis, pas à facturer.
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0" disabled>
              <legend className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)] titre-app">
                Votre contact
              </legend>

              <div className="mt-6 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className={ETIQUETTE} htmlFor="contact-nom">Nom et prénom</label>
                    <input className={CHAMP} id="contact-nom" name="contact_nom" type="text" autoComplete="name" required />
                  </div>
                  <div>
                    <label className={ETIQUETTE} htmlFor="contact-fonction">Fonction</label>
                    <input className={CHAMP} id="contact-fonction" name="contact_fonction" type="text" autoComplete="organization-title" />
                  </div>
                </div>

                <div>
                  <label className={ETIQUETTE} htmlFor="contact-email">
                    Adresse électronique professionnelle
                  </label>
                  <input className={CHAMP} id="contact-email" name="contact_email" type="email" autoComplete="email" required />
                </div>

                <div>
                  <label className={ETIQUETTE} htmlFor="contact-telephone">
                    Téléphone <span className="font-normal text-[color:var(--color-encre-faible)]">(facultatif)</span>
                  </label>
                  <input className={CHAMP} id="contact-telephone" name="contact_telephone" type="tel" autoComplete="tel" />
                </div>

                <div>
                  <label className={ETIQUETTE} htmlFor="message">Votre message</label>
                  <textarea
                    className={`${CHAMP} min-h-[132px] py-2`}
                    id="message"
                    name="message"
                    rows={5}
                    aria-describedby="aide-message"
                  />
                  <span className={AIDE} id="aide-message">
                    Combien de classes, quel équipement, quelle échéance. Ne joignez
                    aucune liste d&apos;élèves : elle ne serait ni nécessaire, ni
                    conservée.
                  </span>
                </div>
              </div>
            </fieldset>

            <div>
              <button
                type="submit"
                disabled
                aria-describedby="raison-desactivation"
                className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-6 text-[color:var(--color-surface)] opacity-50"
              >
                Envoyer la demande
              </button>
              <p id="raison-desactivation" className={AIDE}>
                Envoi indisponible : le service de réception des demandes
                n&apos;est pas encore raccordé.
              </p>
            </div>

            <p
              id="mention-information"
              className="max-w-[62ch] rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
            >
              Les informations saisies serviraient uniquement à répondre à votre
              demande et à établir un devis. Durée de conservation prévue :
              12 mois sans suite, puis suppression ou anonymisation. Aucune
              donnée d&apos;élève n&apos;est demandée à cette étape, et aucune
              case de consentement commercial n&apos;est pré-cochée. Le
              responsable de traitement et le contact pour l&apos;exercice des
              droits seront précisés dès que l&apos;identité contractuelle de
              l&apos;éditeur sera arrêtée.
            </p>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Ce qui se passe ensuite
            </h2>
            <ol className="mt-4 space-y-3 pl-5 text-[color:var(--color-encre-faible)]">
              <li>Nous vous écrivons pour comprendre vos classes et votre équipement.</li>
              <li>Vous recevez un devis chiffré sur l&apos;effectif couvert.</li>
              <li>Après commande, l&apos;espace de l&apos;établissement est créé et le premier administrateur est invité.</li>
              <li>L&apos;import de rentrée crée les classes et prépare les accès.</li>
            </ol>
          </div>

          <div className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-selection)] p-6">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Sans engagement
            </h2>
            <p className="mt-3 m-0 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
              Une demande de devis n&apos;est pas une commande. Aucun compte
              n&apos;est créé, aucun élève n&apos;est enregistré, et vous ne
              recevrez pas de relance automatique.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

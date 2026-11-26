# E-mails d'authentification AvecStudy

Ces fichiers sont les modèles HTML pour **Supabase Auth**. Les conserver dans Git
permet d'éviter de perdre une modification faite à la main dans le tableau de bord.
L'envoi des e-mails reste géré par **Supabase Auth**, avec le SMTP Resend déjà configuré ;
ce ne sont pas des modèles « Resend Templates » à publier séparément.

| Dans Supabase → Authentication → Emails → Modèles | Sujet conseillé | Fichier |
| --- | --- | --- |
| Confirmer l'inscription | `Ton code de confirmation · AvecStudy` | `confirmation-professeur-code.html` |
| Réinitialiser le mot de passe | `Réinitialise ton mot de passe · AvecStudy` | `recuperation-mot-de-passe.html` |
| Inviter l'utilisateur | `Tu es invité sur AvecStudy` | `invitation.html` |
| Lien magique / OTP | `Ton accès à AvecStudy` | `connexion-par-email.html` |
| Changer l'adresse e-mail | `Confirme ta nouvelle adresse · AvecStudy` | `changement-adresse.html` |
| Réauthentification | `Ton code de sécurité · AvecStudy` | `verification-securite.html` |

## Mise en service

1. Sur le projet de production, ouvrir **Authentication → Emails → Modèles**.
2. Ouvrir le type d'e-mail souhaité, passer dans l'éditeur **Source** et copier
   l'intégralité du contenu HTML du fichier correspondant.
3. Mettre le sujet indiqué, enregistrer et refaire la vérification sur l'écran
   avant de poursuivre avec le modèle suivant.
4. Tester **avec une adresse de test**, sans modifier un compte réel :
   inscription (code à six chiffres), mot de passe oublié, modification d'adresse.
   Vérifier mobile et ordinateur, délivrabilité et usage unique des jetons.

**Important :** les fichiers Git ne mettent pas à jour automatiquement les
modèles du projet Supabase hébergé. La copie dans le tableau de bord est une
opération distincte, à faire une fois les essais validés.

## Variables sensibles aux parcours

- Inscription : `{{ .Token }}` — conserver **six chiffres** et le formulaire OTP ;
  aucun bouton n'est nécessaire. Après saisie, le site doit ouvrir une vraie
  session applicative avant la redirection vers `/professeur`.
- Récupération : le lien `{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}`
  est **nécessaire** à la page `/inscription/professeur/acces?mode=recuperation`.
  Ne pas le remplacer par `{{ .ConfirmationURL }}` sans adapter le parcours.
- Invitation, lien magique, changement d'adresse : `{{ .ConfirmationURL }}` est
  fourni par Supabase. Tester la destination et la session de l'application
  avant d'activer ces modes pour les utilisateurs, car l'application possède
  son propre cookie de session en plus de Supabase Auth.
- Réauthentification : `{{ .Token }}` est un code temporaire, pas un mot de passe.

Les notifications de sécurité (mot de passe modifié, adresse modifiée, facteur MFA)
sont configurables séparément et certaines sont désactivées par défaut. Leur
activation doit être testée avant de les envoyer aux comptes existants.

Documentation officielle : https://supabase.com/docs/guides/local-development/customizing-email-templates

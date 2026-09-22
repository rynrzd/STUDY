# 15 — Questionnaire d'établissement, rempli

*Les questions qu'un référent numérique ou un DPO pose avant de déployer un
outil, avec les réponses d'AvecStudy au 23 septembre 2026. Une réponse « non »
ou « non vérifié » est aussi utile qu'un « oui » : ce document sert à décider,
pas à convaincre.*

## Identité de l'éditeur

| Question | Réponse |
|---|---|
| Qui édite le service ? | Nouh Tifouti, entrepreneur individuel — micro-entreprise. Nom commercial : AvecStudy. |
| SIREN / SIRET | 979 992 443 / 979 992 443 00023 |
| Adresse | 1 avenue d'Alsace, 90000 Belfort, France |
| Code APE | 62.01Z — Programmation informatique |
| TVA | TVA non applicable, article 293 B du Code général des impôts |
| Directeur de publication | Nouh Tifouti |
| Contact | nireo.contacte@gmail.com — 07 81 69 74 77 |
| AvecStudy est-il une société ? | **Non.** C'est un nom commercial, pas une personne morale. La responsabilité est celle de l'entreprise individuelle. |
| Combien de personnes travaillent sur le produit ? | **Une.** Voir R-01, que nous vous demandons de peser en premier. |

## Données

| Question | Réponse |
|---|---|
| Quelles données d'élèves sont collectées ? | Prénom, nom, identifiant local remis par le lycée, classe, groupes. Et le travail scolaire : copies, corrections, documents, entraide. |
| L'INE est-il collecté ? | **Non.** Vérifié : aucune colonne des deux schémas ne peut en porter un. |
| Date de naissance, adresse, téléphone, photo ? | **Non**, pour les élèves. |
| Adresse électronique d'élève ? | **Non.** Un test de la batterie le vérifie en permanence. |
| Données de santé ou dites sensibles ? | **Non.** |
| Y a-t-il de la publicité ou du profilage ? | **Non**, et le modèle économique l'exclut : l'abonnement est payé par l'établissement, les familles ne paient rien. |
| Les données sont-elles revendues ou partagées ? | **Non.** Aucun destinataire tiers. |
| Qui est responsable de traitement ? | **L'établissement.** AvecStudy est sous-traitant (article 28). |

## Hébergement

| Question | Réponse |
|---|---|
| Où la base est-elle hébergée ? | Supabase, AWS `eu-west-1` — Irlande. |
| Où le traitement a-t-il lieu ? | Vercel, région `cdg1` — Paris, **déclarée depuis le 23 septembre 2026**. Auparavant, l'hébergeur appliquait son défaut et le rendu s'exécutait à Washington (constat F-08). |
| Est-ce un hébergement souverain ? | **Non.** Les deux fournisseurs sont américains. Nous n'écrirons pas « souverain » sans preuve, et il n'y en a pas. |
| Est-ce un hébergeur de données de santé (HDS) ? | Non, et ce n'est pas requis : aucune donnée de santé n'est traitée. |
| Des données quittent-elles l'EEE ? | **NON VÉRIFIÉ.** Les régions sont européennes et un contrôle automatique le vérifie. Les sauvegardes, journaux et accès du support relèvent des contrats des fournisseurs, qui restent à examiner. Voir `08-hebergement-et-transferts.md`. |
| Qui sont les sous-traitants ultérieurs ? | Vercel (hébergement applicatif) et Supabase (base, authentification, stockage). Leurs propres sous-traitants figurent dans leurs contrats, à obtenir. |

## Sécurité technique

| Question | Réponse |
|---|---|
| Les échanges sont-ils chiffrés ? | Oui, HTTPS obligatoire, HSTS un an avec sous-domaines. |
| Le cloisonnement entre établissements est-il vérifié ? | Oui. Il est appliqué **dans la base**, par 144 politiques, et vérifié par 202 tests sur du vrai PostgreSQL à chaque livraison. |
| Un professeur peut-il voir les copies d'une classe qu'il n'enseigne pas ? | Non. Et retirer une affectation coupe l'accès à la requête suivante. |
| L'éditeur peut-il lire les copies des élèves ? | **Pas par les chemins applicatifs** — quatre tests le vérifient. Il détient en revanche les accès à l'infrastructure, comme tout exploitant de base ; cette limite est écrite dans `04-modele-de-menace.md`. |
| Le second facteur est-il disponible ? | Oui, TOTP. Il est **obligatoire** pour tout acte d'administration. |
| Les mots de passe sont-ils stockés par AvecStudy ? | Non. Ils sont vérifiés par le fournisseur d'authentification. |
| Y a-t-il une limitation des tentatives ? | Oui, par compte, et depuis cet audit une détection du balayage d'établissement. |
| Les fichiers déposés sont-ils analysés par un antivirus ? | **Non.** C'est écrit dans le code plutôt que dissimulé. Le type est en revanche reconnu sur les octets, six formats seulement sont acceptés, et rien n'est servi en ligne. Voir R-06. |
| Y a-t-il eu un test d'intrusion indépendant ? | **Non.** Ce dossier est un audit **interne**. Aucune certification, aucune homologation, aucune qualification. |

## Exploitation

| Question | Réponse |
|---|---|
| Y a-t-il un engagement de disponibilité ? | **Non.** Nous ne promettons pas de taux de service, faute de pouvoir le tenir. |
| Y a-t-il une astreinte ? | **Non.** Une panne un dimanche soir peut durer jusqu'au lundi. |
| Y a-t-il une supervision automatique ? | **Non.** C'est le manque le plus structurant après cet audit (R-09). |
| Les sauvegardes sont-elles testées ? | L'exercice est **outillé** (`npm run restauration:test`, qui vérifie qu'une base restaurée garde ses politiques de ligne). L'exercice de bout en bout **reste à jouer**, et les réglages de sauvegarde sont **NON VÉRIFIÉS** faute d'accès à la console. |
| Combien de temps les données sont-elles conservées ? | Le travail scolaire : selon la décision de l'établissement. Les tentatives de connexion : 24 h. Le journal d'audit : conservé, **sans durée déterminée** — à fixer avec votre DPO (R-07). |

## Droits des personnes

| Question | Réponse |
|---|---|
| Un élève peut-il accéder à ses données ? | Oui, dans son espace : devoirs, remises, corrections, preuves de remise. |
| Un export complet des données d'un élève est-il possible ? | Oui, **mais pas en un geste** : l'opération demande aujourd'hui une intervention de l'éditeur (R-08). |
| Comment se fait un effacement ? | Sur décision de l'établissement, par les écrans d'administration. Le journal d'audit en garde la trace. |
| Qui répond aux demandes des familles ? | **L'établissement**, responsable de traitement. AvecStudy l'outille. |

## Réversibilité

| Question | Réponse |
|---|---|
| Que récupérons-nous si nous arrêtons ? | Les accès, la structure et les documents s'exportent déjà par vos écrans. Un instantané complet demande l'éditeur. |
| Et si l'éditeur cesse son activité ? | Le code est intégralement versionné sur un dépôt distant, le schéma se reconstruit de zéro, la base est du PostgreSQL standard. **Aucune clause de réversibilité n'existe aujourd'hui** — nous recommandons de l'inscrire au contrat. Voir `11-sauvegardes-et-continuite.md`. |

## Conformité

| Question | Réponse |
|---|---|
| Une AIPD est-elle nécessaire ? | Le traitement porte sur des mineurs, à grande échelle à l'échelle d'un établissement, sans possibilité réelle de s'y soustraire. **Nous recommandons que votre DPO conduise une AIPD**, ou vérifie que le traitement entre dans un cadre existant. Ce dossier n'en tient pas lieu. |
| Un contrat de sous-traitance est-il prêt ? | Un **projet** d'annexe figure au dossier. Il est marqué « projet à valider par le DPO et/ou un juriste » et n'est pas un avis juridique. |
| Êtes-vous certifié ISO 27001 ? | **Non.** |
| Êtes-vous « conforme ANSSI » ? | **Non**, et cette expression n'a pas de sens sans qualification formelle. L'audit s'appuie sur les recommandations publiques de l'ANSSI, ce qui est autre chose. |
| Êtes-vous « certifié RGPD » ? | **Non.** Aucune certification RGPD n'existe pour ce service. |
| Avez-vous un point de contact pour signaler une faille ? | Oui, depuis cet audit : `https://avecstudy.fr/.well-known/security.txt`. Accusé de réception sous cinq jours ouvrés, et engagement de ne pas poursuivre un signalement de bonne foi. |

## Les trois questions que nous vous invitons à nous reposer dans six mois

1. La configuration des consoles Vercel et Supabase a-t-elle été vérifiée, et le
   second facteur y est-il exigé ? *(R-03)*
2. Les pièces contractuelles sur les transferts hors EEE sont-elles au dossier ?
   *(R-02)*
3. L'exercice de restauration a-t-il été joué de bout en bout, et son compte
   rendu joint ? *(chapitre 11)*

Tant que ces trois réponses sont « pas encore », ce dossier reste incomplet, et
il le dit.

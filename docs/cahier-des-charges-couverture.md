# Cahier des charges — relevé de couverture

Relevé exigence par exigence du cahier des charges maître AvecStudy, établi le 13 octobre 2026 à partir du code, des migrations (0001–0080) et des tests (base et unitaires). « Fait » signifie : présent en production et appuyé sur une preuve (migration, test ou écran). « Partiel » dit ce qui manque. « Écarté » est un choix assumé (produit sans IA, pas d'export, pas de suivi de consultation).

## Synthèse

| Priorité | Fait | Partiel | Non fait | Écarté |
|---|---|---|---|---|
| P0 | 137 | 0 | 0 | 0 |
| P1 | 70 | 31 | 1 | 1 |
| P2 | 2 | 5 | 10 | 4 |
| Total | 209 | 36 | 11 | 5 |

### P0 non entièrement faits

Aucun.

## Mise en route de l'établissement

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **ONB-01** Lors d’un établissement sans données : afficher « Configurer mon lycée » et proposer deux voies : importer… | P0 | Fait | Accueil admin, état « établissement vide » : import ou ajout manuel (D01) |
| **ONB-02** Assistant en étapes : (1) année scolaire ; (2) classes ; (3) élèves ; (4) matières/groupes ; (5)… | P0 | Fait | « Mise en route » en 6 étapes calculées sur les données, reprenable (accueil admin) |
| **ONB-03** Vérifier les dépendances et expliquer : « Créez d’abord une classe », ou proposer « Créer cette classe… | P0 | Fait | Parcours classe → matière → affectation (Classes et cours) ; états vides avec action |
| **ONB-04** Ne jamais bloquer une création de professeur parce qu’aucune classe n’existe : autoriser le compte sans… | P0 | Fait | Professeur créé sans classe (AjouterPersonne) ; signalé « sans cours » (0077) |
| **ONB-05** Tableau de contrôle avant ouverture aux élèves : comptes sans classe, professeurs sans cours, groupes… | P0 | Fait | 0077 + 0080 : « Avant d'ouvrir aux élèves » ; tests controle-fiche-classe, fiche-prof-rapprochement |
| **ONB-06** Import interrompu : reprise à l’étape exacte, pas de doublons ni création anticipée avant confirmation. | P1 | Fait | Lot persisté en base, repris par son adresse ; réimport sans doublon (0038) |
| **ONB-07** Aide très courte intégrée à chaque bloc : « Pourquoi ? », « Qui voit ça ? », « Que se passe-t-il après ?… | P1 | Partiel | Aides courtes sur les écrans clés ; pas de trio « Pourquoi / Qui voit / Après » systématique |
| **ONB-08** Guide d’accueil rejouable par choix volontaire, sans effacer de données. | P1 | Partiel | La mise en route reste consultable ; l'intro de connexion n'est qu'une animation, pas un guide rejouable |
| **ONB-09** Aperçu de la conséquence avant toute opération irréversible ou massive. | P1 | Fait | Aperçus avant bascule d'année, changement de classe, import, import de groupes |
| **ONB-10** Jeu de données de démonstration isolé disponible en environnement de test uniquement, jamais ajouté à un… | P2 | Fait | Données fictives uniquement sur /apercu (404 en production) |

## Classes

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **CL-01** Créer une classe manuellement avec libellé contrôlé : « 2nde 1 », « 1ère G3 », « Tle STMG1 », « CAP … » si… | P0 | Fait | Libellé libre contrôlé (etab_creer_classe) |
| **CL-02** Rechercher une classe existante par équivalence normalisée (ex. « Seconde 1 » / « 2nde 1 ») avant création… | P0 | Fait | Alerte d'équivalence « Seconde 1 » / « 2nde 1 », création forcée par case explicite |
| **CL-03** Une fiche classe expose élèves, professeur principal, cours, groupes associés, compteurs réels, alertes de… | P0 | Fait | Fiche classe (0077, /admin/classes/[classe]) ; test CTL-02 |
| **CL-04** Ajouter un élève, déplacer un élève, choisir un professeur principal et affecter un cours depuis la fiche… | P0 | Fait | Fiche classe : ajouter un élève, professeur principal, affecter un cours ; déplacer via la fiche élève |
| **CL-05** Ne jamais autoriser la classe principale d’un élève à être simultanément deux classes actives dans la même… | P0 | Fait | Index unique class_enrollments_single_principal |
| **CL-06** Empêcher l’utilisation de classes ou matières d’un autre établissement, même avec un UUID forgé. | P0 | Fait | Clés étrangères composites organization_id ; tests isolation, ATTAQUE-01 |
| **CL-07** Archiver, renommer et préparer l’année suivante sans briser les anciens documents, devoirs et copies. | P1 | Fait | Rentrée 0059 + 0073 ; archives conservées |
| **CL-08** Classe sans professeur, classe sans élève et classe avec groupe vide : états explicites, pas « erreur… | P1 | Fait | États explicites (sans professeur, sans élève, groupe vide) ; contrôle avant ouverture |
| **CL-09** Afficher effectif selon la date/année, pas uniquement une valeur globale. | P1 | Partiel | Effectifs du jour ; années passées dans le relevé d'archive (0075), pas d'effectif à une date choisie |
| **CL-10** Création multiple par saisie contrôlée (« 2nde 1 » à « 2nde 8 ») avec prévisualisation, et rejet de doublons. | P2 | Non fait | Pas de création en série de classes |

## Groupes pédagogiques

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **GR-01** Ajouter une entrée « Groupes pédagogiques » avec liste, recherche, filtres (année, matière, type, classe… | P0 | Fait | Recherche et filtres (0078) ; test FIL-01 |
| **GR-02** Assistant « Créer un groupe » : nom, année, type sous-groupe/interclasses, description facultative,… | P0 | Fait | Création (nom, type, description facultative 0081) puis élèves cherchés par classe et enseignants |
| **GR-03** Sélecteur d’élèves avec recherche, filtres par classe, compteur choisi et état « Aucun résultat », sans… | P0 | Fait | Sélecteur à recherche serveur, sans plafond (0072) ; test comptes-pagines |
| **GR-04** Création d’un groupe qui contient des élèves de plusieurs classes avec une seule identité groupe et sans… | P0 | Fait | 0065 ; test groupes |
| **GR-05** Ajouter/retirer plusieurs élèves ; calculer l’effet avant validation ; conserver l’historique des dates… | P0 | Fait | Ajout multiple ; retrait multiple confirmé ; historique des dates |
| **GR-06** Associer une matière au groupe via un espace d’enseignement propre ; ce groupe apparaît chez ses… | P0 | Fait | Espace d'enseignement propre au groupe (0065) |
| **GR-07** Un même élève peut appartenir à plusieurs groupes distincts, y compris plusieurs groupes de langues, si… | P0 | Fait | Appartenances multiples permises ; test groupes |
| **GR-08** Ne pas donner automatiquement accès à tout un groupe à tous les élèves de ses classes sources : uniquement… | P0 | Fait | Accès aux seuls membres (attends_space) ; test groupes |
| **GR-09** Interdire à un non-membre de consulter un support ou de rendre un devoir de groupe en manipulant un lien. | P0 | Fait | RLS sur supports et remises ; tests groupes, remises |
| **GR-10** Gérer un départ de groupe après cours suivis : couper les droits futurs, ne pas effacer la trace… | P1 | Fait | Fin d'appartenance datée, rien d'effacé |
| **GR-11** Duplication d’une structure de groupe pour l’année suivante avec révision explicite des élèves et… | P1 | Fait | Reconduction des groupes sans élèves (0073) |
| **GR-12** Ajouter un professeur principal de groupe/coordinateur si utile, sans lui accorder les droits… | P1 | Non fait | Pas de professeur principal de groupe |
| **GR-13** Affecter un remplaçant et plusieurs co-intervenants avec portée exacte. | P1 | Fait | Remplaçant daté, co-intervenants (0069) |
| **GR-14** Éviter les groupes portant un nom trompeusement identique au sein de la même année ; proposer… | P1 | Partiel | Code de groupe unique dans l'année : pas de doublon exact ; noms voisins non signalés |
| **GR-15** Importer et exporter les appartenances des groupes, sous contrôle d’accès. | P1 | Partiel | Import par fichier (0079) ; pas d'export des appartenances |
| **GR-16** Fonctions de composition assistée (répartition équilibrée par nombre seulement), mais aucune décision… | P2 | Non fait | Pas de composition assistée (P2) |

## Professeurs

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **PROF-01** « Ajouter un professeur » accessible depuis Accueil, Professeurs, Classe et Enseignement ; un seul… | P0 | Fait | Accueil, Professeurs, Classes ; fiche classe pour les élèves |
| **PROF-02** Nom, prénom, identifiant proposé, matière(s), éventuel courrier professionnel si vraiment utilisé, compte… | P0 | Fait | AjouterPersonne : identifiant proposé, sans courriel obligatoire |
| **PROF-03** Affecter en une fois plusieurs couples matière × classe/groupe. Ne surtout pas appliquer par défaut toutes… | P0 | Fait | Affectations multiples ligne par ligne (0067) |
| **PROF-04** Chaque ligne comporte cible, matière, rôle (titulaire, remplacant, co_intervenant), dates optionnelles,… | P0 | Fait | Rôle et dates par ligne (0069) |
| **PROF-05** Résumé avant enregistrement : « 1 compte et 7 affectations, dont 2 déjà existantes » ; double clic/retry… | P0 | Fait | Résumé avant envoi : cours à affecter, déjà en place, doublons ; idempotent |
| **PROF-06** Un compte sans affectation est autorisé ; un message clair demande l’étape suivante ; les écrans prof ne… | P0 | Fait | Compte sans affectation : espace vide expliqué |
| **PROF-07** Fiche professeur : identité, accès, établissements autorisés, matières, classes, groupes, rôle, statut,… | P0 | Fait | Fiche professeur (0080, /admin/professeurs/[id]) ; test FPR-01 |
| **PROF-08** Ajouter/modifier/terminer une affectation indépendamment du compte ; les autres affectations ne doivent… | P0 | Fait | Terminer une affectation seule (0069) ; test roles-affectations |
| **PROF-09** Après ajout d’un cours, le professeur le voit à sa prochaine lecture/actualisation sans opération manuelle… | P0 | Fait | Lecture directe sous RLS, sans cache |
| **PROF-10** Empêcher l’affectation à une cible archivée, d’une autre année non sélectionnée ou d’un autre établissement. | P0 | Fait | Cibles archivées et autres établissements refusés (0069, 0076) |
| **PROF-11** Gérer les remplacements avec dates, rôle explicite, droit de lecture/édition défini et coupure à échéance. | P1 | Fait | Remplacement daté, coupure à échéance ; test ROLE-01 |
| **PROF-12** Co-intervention : deux professeurs sur le même cours, avec responsabilité sur les publications explicitée,… | P1 | Fait | Co-intervention sur un même espace |
| **PROF-13** Réaffecter en lot un professeur qui change de service en milieu d’année, avec aperçu des changements et… | P1 | Partiel | Affecter plusieurs + terminer ; pas d'aperçu de réaffectation en lot |
| **PROF-14** Remplacement temporaire sans fusion des bibliothèques privées ; accès au contenu partagé selon politiques… | P1 | Fait | Bibliothèques privées par auteur |
| **PROF-15** Chercher par nom, identifiant, matière, classe, groupe, rôle, statut et année ; résultats paginés. | P1 | Partiel | Recherche par nom et identifiant ; matière, classe, rôle via « Qui enseigne quoi » |
| **PROF-16** Alerter si plusieurs titulaires sur le même cours lorsque l’établissement n’a pas choisi une… | P1 | Fait | Alerte « plusieurs titulaires », rien retiré d'office |
| **PROF-17** Changer de matière, d’affectation ou de rôle sans recréer l’identité ni régénérer les accès de connexion. | P1 | Fait | Affectations indépendantes du compte |
| **PROF-18** Copier un service pédagogique vers l’année suivante, après validation explicite des groupes et des… | P2 | Partiel | Reconduction des cours de groupe (0073) ; pas de copie de service complète |

## Élèves

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **EL-01** Fiche élève avec classe principale, année, groupes, état du compte, accès, historique des mouvements et… | P0 | Fait | Fiche élève (0068) |
| **EL-02** Créer un élève et l’inscrire à sa classe principale dans le même parcours ; proposer ajout aux groupes… | P0 | Fait | Création avec classe dans le même parcours ; groupes ensuite |
| **EL-03** Transfert de classe : aperçu du retrait/ajout, dates, impact sur devoirs en cours et publications ;… | P0 | Fait | Changement de classe avec aperçu |
| **EL-04** Départ de l’établissement : clôturer inscriptions et droits, suspendre accès si nécessaire, archiver sans… | P0 | Fait | Départ : inscriptions closes, rien supprimé |
| **EL-05** Refuser inscription à une classe d’une autre organisation et groupement d’une autre année. | P0 | Fait | Contrôles en base ; tests isolation |
| **EL-06** Multi-sélection pour ajouter/retirer des élèves d’un groupe depuis la classe et depuis le groupe. | P1 | Partiel | Multi-sélection depuis le groupe ; pas depuis la classe |
| **EL-07** Détecter noms identiques, homonymes, homographes, accents, apostrophes ; utiliser identifiants stables,… | P1 | Fait | Rapprochement INE puis nom, homonymes jamais fusionnés (0038, 0080) ; test FPR-03 |
| **EL-08** Gérer arrivée tardive, interruption de scolarité, retour après suspension, redoublement, changement de… | P1 | Partiel | Arrivée, départ, changement de classe, rentrée ; pas de parcours dédié redoublement/réintégration |
| **EL-09** Éviter toute création de compte surprise lors d’un aperçu d’import. | P1 | Fait | Aperçu d'import sans écriture ; tests import-groupes IMPG-01 |
| **EL-10** Codes de classe ou demandes d’accès existantes : conserver l’approbation requise, ne pas autoriser… | P1 | Fait | Codes de classe avec approbation (0045) |
| **EL-11** Visualiser quels enseignements seront gagnés/perdus avant un mouvement de classe ou de groupe, sous… | P2 | Partiel | Aperçu de changement de classe ; pas pour les groupes |

## Enseignements

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **ENS-01** Gestion distincte des matières et enseignements pour éviter « matière = cours d’une classe ». | P0 | Fait | subjects distinctes de teaching_spaces |
| **ENS-02** Vue matricielle « Classe / groupe × matière × professeur », filtre par niveau et année. | P0 | Fait | « Qui enseigne quoi » (0078) ; test FIL-02 |
| **ENS-03** Ajouter un enseignement depuis la classe, le groupe ou la fiche professeur, avec contrôle des doublons. | P0 | Fait | Depuis classes, groupe, professeurs ; doublons refusés |
| **ENS-04** Un enseignement peut avoir un ou plusieurs intervenants ; un professeur peut avoir plusieurs enseignements. | P0 | Fait | Plusieurs intervenants, plusieurs cours |
| **ENS-05** Si une matière est affectée à plusieurs classes, créer plusieurs espaces séparés, même si le contenu… | P0 | Fait | Un espace par classe et matière |
| **ENS-06** Un espace ne peut pas cibler simultanément classe et groupe ; interdiction côté formulaire, API et… | P0 | Fait | Contrainte teaching_spaces_single_target |
| **ENS-07** Enseignement sans professeur ou groupe sans élève : visible côté admin avec avertissement, jamais présenté… | P1 | Fait | Signalé côté admin ; invisible côté élève sans contenu publié |
| **ENS-08** Annuler une affectation sans supprimer l’espace si des contenus/données y sont rattachés. | P1 | Fait | Terminer une affectation garde l'espace et ses contenus |
| **ENS-09** Mettre à disposition un aperçu « qui recevra cette leçon ? » avec compte réel des destinataires autorisés. | P1 | Fait | Effectifs réels par cible avant publication (0066) |
| **ENS-10** Exporter la matrice des services et effectifs sans exposer les identifiants techniques à des personnes non… | P2 | Non fait | Pas d'export de la matrice |

## Espace professeur

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **TEACH-01** Afficher les cours autorisés sous forme de cartes ou de liste avec filtres par classe, groupe, matière,… | P0 | Fait | Mes cours : recherche, matière, niveau (ChoixCours) ; libellés complets |
| **TEACH-02** Établir un « centre de cours » unifié : matière > classe/groupe > chapitres > leçons / documents /… | P0 | Fait | « Mes cours » : séances, documents, banque, années passées |
| **TEACH-03** Une seule action « Ajouter une leçon » qui propose trois modes explicites : PDF intact, import… | P0 | Fait | « Ajouter une leçon » : écrire, PDF tel quel, importer pour transformer |
| **TEACH-04** Prévoir une bibliothèque personnelle pour les documents non publiés ; distinguer document source, leçon… | P0 | Fait | Documents importés, distincts des séances et publications |
| **TEACH-05** Ne pas lier automatiquement un document importé à une classe avant que l’enseignant ait choisi les… | P0 | Fait | Aucune publication sans choix des destinataires (0066) |
| **TEACH-06** Depuis un cours : « Nouveau chapitre », « Nouvelle leçon », « Ajouter un PDF », « Ajouter un exercice », «… | P0 | Fait | Menu « Ajouter » : leçon (3 modes), chapitre, exercice, devoir |
| **TEACH-07** Afficher le statut exact : brouillon, traitement, à relire, prêt, programmé, publié, erreur, archivé ; pas… | P0 | Fait | Brouillon, traitement, à vérifier, prêt, programmé, publié, échec, archivé |
| **TEACH-08** Sauvegarder les changements de manière fiable, indiquer l’état de sauvegarde et prévenir la perte de travail. | P0 | Fait | Enregistrement automatique de l'en-tête, contrôle de version (EDIT-06, EDIT-07) |
| **TEACH-09** En un clic, prévisualiser comme élève autorisé ou comme enseignant sans divulguer une classe dont on n’est… | P0 | Fait | Aperçu élève (/studio/[seance]/apercu) |
| **TEACH-10** Après publication, lien direct vers l’emplacement élève exact, nombre de destinataires, date et version… | P0 | Fait | Résultat par cible : effectif et lien vers la séance élève |
| **TEACH-11** Dupliquer une leçon vers un autre enseignement en conservant la provenance, sans écraser la source ni… | P1 | Fait | Dupliquer vers une autre classe : copie brouillon, source intacte |
| **TEACH-12** Partager une ressource avec un autre professeur uniquement via décision explicite d’auteur ou règle… | P1 | Fait | Aucun partage implicite entre professeurs |
| **TEACH-13** Rechercher par titre, chapitre, matière, classe, type de document et état ; tenir compte des permissions… | P1 | Partiel | Recherche globale ; pas de filtres par type et état |
| **TEACH-14** Une salle/activité peut être préparée hors de la classe physique ; ne pas dépendre d’un emploi du temps… | P1 | Fait | Séances sans emploi du temps |
| **TEACH-15** Accepter qu’un professeur enseigne des matières différentes à des classes différentes ; ne pas appliquer… | P1 | Fait | Matières différentes par classe |
| **TEACH-16** Conserver les fonctions existantes devoirs, évaluations, exercices, correction, ateliers et entraide en… | P1 | Fait | Devoirs, évaluations, exercices, ateliers, entraide conservés |
| **TEACH-17** Favoris, brouillons récents et modèles de structure de chapitre, sans génération de contenu automatique. | P2 | Non fait | Pas de favoris ni modèles de chapitre |
| **TEACH-18** Mode présentation/projection distinct du mode édition, avec contraste et zoom adaptés. | P2 | Non fait | Pas de mode projection |

## PDF tel quel

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **PDF-01** Action « Ajouter mon PDF tel quel » clairement distincte de « Transformer en leçon modifiable ». | P0 | Fait | Choix « Garder mon PDF tel quel » / « Le transformer » |
| **PDF-02** Conserver les octets et le fichier original, avec empreinte SHA-256 et métadonnées ; aucune reconstruction… | P0 | Fait | Octets conservés, empreinte SHA-256 (0025) |
| **PDF-03** Lecteur intégré côté élève : pagination, zoom, défilement, plein écran, taille adaptée aux écrans, titre… | P0 | Fait | Lecteur intégré : pages, zoom, plein écran |
| **PDF-04** Téléchargement possible si la politique du cours l’autorise ; accès au fichier vérifié à chaque requête et… | P0 | Fait | Route /documents : droit vérifié à chaque requête, pas d'URL publique |
| **PDF-05** Récapitulatif avant publication : titre, fichier, taille, cible(s), effectif, visibilité, date, chapitre… | P0 | Fait | Récapitulatif avant publication |
| **PDF-06** Refuser proprement un fichier déguisé, vide, trop volumineux, corrompu ou malveillant ; ne pas accorder de… | P0 | Fait | Signature, taille, contenu vérifiés ; tests formats |
| **PDF-07** Un fichier PDF importé n’est visible aux élèves que lorsqu’il est relié à une publication autorisée. La… | P0 | Fait | Visible seulement via une publication autorisée (RLS) |
| **PDF-08** Si le PDF ne peut pas être prévisualisé dans le navigateur : expliquer, proposer téléchargement sûr si… | P1 | Fait | Repli téléchargement si l'aperçu échoue |
| **PDF-09** PDF protégé par mot de passe : état d’erreur clair et procédure d’import alternative ; ne pas tenter de… | P1 | Partiel | Refus d'un PDF illisible ; message spécifique « protégé » non vérifié |
| **PDF-10** Document de 1 page, document long, format paysage, pages mélangées, très grandes dimensions, images… | P1 | Partiel | Taille bornée ; pas de vérification par cas extrême |
| **PDF-11** Supporter navigation clavier, lecteur d’écran (métadonnées et alternatives), impression si autorisée, et… | P1 | Partiel | Lecteur au clavier ; pas d'avertissement d'accessibilité du PDF |
| **PDF-12** Le partage d’un même PDF vers plusieurs enseignements ne crée pas des transferts redondants ; chaque… | P1 | Fait | Une révision, plusieurs publications (0066) |
| **PDF-13** Pouvoir retirer le PDF d’un cours sans le supprimer de la bibliothèque et sans retirer les autres… | P1 | Partiel | Retrait d'une publication ; bibliothèque intacte |
| **PDF-14** Miniatures de pages et signets lorsqu’ils existent ; ne jamais traiter l’absence de signets comme une… | P2 | Non fait | Pas de miniatures ni signets (P2) |

## Conversion

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **CONV-01** Expliquer avant import que la conversion peut modifier la présentation, et qu’une relecture est indispensable. | P0 | Fait | Avertissement avant transformation |
| **CONV-02** Ne pas convertir silencieusement un PDF original si le professeur a choisi le mode A. | P0 | Fait | Mode A jamais converti |
| **CONV-03** Pipeline : déposer → vérifier type/limites → traitement asynchrone durable → rendu éditable → signaler… | P0 | Fait | Worker asynchrone, états, relecture (0010) |
| **CONV-04** Conversion non destructrice : source toujours disponible aux personnes habilitées ; nouvelle version séparée. | P0 | Fait | Source conservée, versions séparées (0071) |
| **CONV-05** Signaler les éléments non convertis : images, tableaux, équations, colonnes, caractères, annexes ; pas de… | P0 | Fait | Écarts signalés, « à vérifier » |
| **CONV-06** PDF image/scanné : erreur honnête « reconnaissance de texte indisponible » ou chemin OCR dédié seulement… | P0 | Fait | Document numérisé refusé honnêtement ; pas d'OCR (produit sans IA) |
| **CONV-07** Unicode (accents, symboles grecs, exposants), équations mathématiques, unités de physique, chimie,… | P1 | Partiel | Formules rendues après conversion si écrites en LaTeX ; pas de jeu de référence |
| **CONV-08** Toute conversion possédant des alertes exige leur consultation avant validation ; le professeur peut… | P1 | Fait | État « à vérifier » avant publication |
| **CONV-09** Traitement en arrière-plan côté serveur sans blocage de la page ; suivi d’état, reprises et timeout, sans… | P1 | Fait | Traitement en arrière-plan, sans double lancement |
| **CONV-10** Word avec images : conserver ou signaler explicitement chaque image absente, avec possibilité de… | P1 | Partiel | Images DOCX signalées ; réinsertion manuelle par bloc image |
| **CONV-11** Assurer que l’interruption réseau pendant le traitement ne détruit ni le fichier ni le résultat ; le… | P1 | Fait | Fichier et résultat persistés, repris depuis la bibliothèque |
| **CONV-12** Export PDF du document modifié seulement si un moteur de rendu fiable est réellement mis en place ;… | P2 | Écarté | Pas d'export PDF : impression navigateur seulement |

## Éditeur

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **EDIT-01** Éditeur clair, rapide, accessible, inspiré d’un document pédagogique : titre, sections, paragraphes,… | P0 | Fait | Titres, listes, encadrés, tableaux, images, liens, formules, exercices, devoirs |
| **EDIT-02** Ajouter/déplacer/supprimer les blocs en gardant le contrôle clavier et une option sans glisser-déposer. | P0 | Fait | Boutons monter/descendre/supprimer, sans glisser-déposer |
| **EDIT-03** Copier/coller depuis Word ou navigateur : nettoyer HTML potentiellement dangereux sans supprimer toutes… | P0 | Fait | Texte brut : rien d'exécutable ne passe au collage |
| **EDIT-04** Formules de maths ou chimie : mode d’affichage stable et accessible ; préserver le texte brut / LaTeX si… | P0 | Fait | LaTeX conservé, MathML natif, sans HTML injecté ; test formules |
| **EDIT-05** Images pédagogiques : télécharger, légender, donner un texte alternatif, remplacer, réordonner et… | P0 | Fait | Images avec légende et texte alternatif ; remplacer = nouveau bloc |
| **EDIT-06** Sauvegarde automatique sécurisée, état « Enregistrement… / Enregistré / Échec » et bouton de reprise. | P0 | Fait | Enregistrement automatique de l'en-tête et des blocs : état, échec, « Réessayer » |
| **EDIT-07** En cas de conflit entre deux onglets : message explicite et récupération/choix de version, pas… | P0 | Fait | Contrôle de version séance et blocs, saisie rendue ; test conflit-versions |
| **EDIT-08** Titre et chapitre éditables sans provoquer de publication automatique. | P0 | Fait | Titre et chapitre modifiables sans publication |
| **EDIT-09** Historique de versions, restauration contrôlée d’un brouillon antérieur et journal de modifications majeures. | P1 | Fait | Historique et restauration (0071) |
| **EDIT-10** Aperçu responsive élève, A4 imprimable et projection ; vérifier typographie, tableau large et image paysage. | P1 | Partiel | Aperçu élève responsive ; pas de mise en page A4 ni projection |
| **EDIT-11** Le lien, les images et les tableaux doivent être correctement restitués aussi dans les exports éventuels. | P1 | Écarté | Pas d'export |
| **EDIT-12** Déplacement d’une leçon d’un chapitre à un autre : modifier le classement sans déplacer d’office la cible… | P1 | Fait | Chapitre modifiable, cible inchangée |
| **EDIT-13** Modèles de leçons : cours complet, fiche de révision, séance TP, leçon avec exercices ; uniquement modèles… | P2 | Non fait | Pas de modèles de leçon (P2) |

## Cours et chapitres

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **COURS-01** Un enseignement rassemble des chapitres ordonnés, des leçons, des documents sources et des activités.… | P0 | Fait | Chapitres, séances, documents, activités ; l'administration ne crée pas de leçon |
| **COURS-02** Créer, renommer, déplacer, archiver les chapitres ; conserver l’ordre voulu par le professeur sur toutes… | P0 | Fait | Créer, renommer, déplacer, archiver/restaurer (0080) ; test FPR-04 |
| **COURS-03** Une leçon peut exister en bibliothèque avant d’être placée dans un chapitre ou publiée ; « sans chapitre »… | P0 | Fait | « Sans chapitre » autorisé |
| **COURS-04** Une publication référence la version exacte du document au moment de publier, afin que les élèves ne… | P0 | Fait | Version figée à la publication |
| **COURS-05** Associer exercices et devoirs à une leçon/séance sans les dupliquer silencieusement dans d’autres classes. | P0 | Fait | Duplication sans devoirs |
| **COURS-06** Statuts cohérents entre Studio import, Studio séances et espace élève : brouillon ≠ prêt ≠ publié ≠… | P0 | Fait | États distincts partout |
| **COURS-07** Conserver les liens de leçons partagés lorsqu’un titre ou chapitre change (identifiants stables). | P0 | Fait | Identifiants stables |
| **COURS-08** Réordonner des leçons, dupliquer des chapitres, copier la structure d’un cours vers une autre classe, avec… | P1 | Partiel | Chapitres réordonnés, séances dupliquées ; pas de copie de structure entière |
| **COURS-09** À la duplication, préciser « copier seulement la structure », « copier les documents non publiés » ou «… | P1 | Partiel | Duplication : brouillon sans devoir ; pas de choix à trois options |
| **COURS-10** Supprimer/archiver un brouillon après confirmation, jamais supprimer physiquement une ressource encore… | P1 | Fait | Suppression de bloc confirmée ; ressources liées conservées |
| **COURS-11** Associer un document de correction à une activité avec visibilité différée explicite, sans divulgation par… | P1 | Fait | Corrigé à visibilité différée (correction_released_at) |
| **COURS-12** Une leçon peut être publiée dans plusieurs cours de la même matière, mais chaque classe/groupe a son suivi… | P1 | Fait | Publication multiple, suivi par cible (0066) |
| **COURS-13** Les commentaires, remises, résultats et réponses des élèves restent attachés à l’enseignement où ils ont… | P1 | Fait | Remises et réponses attachées à leur espace |
| **COURS-14** Garder un texte lisible en cas de formule non rendue, et prévenir le professeur plutôt que perdre le contenu. | P1 | Fait | Formule non reconnue affichée telle qu'écrite |
| **COURS-15** Favoris, modèles de progression annuelle et modèles de chapitre réutilisables entre années après validation. | P2 | Non fait | Pas de modèles de progression (P2) |

## Publication

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **PUB-01** L’écran de publication propose simultanément les classes et groupes auxquels le professeur est affecté,… | P0 | Fait | Classes et groupes du professeur, avec recherche (0066) |
| **PUB-02** Sélection multiple par cases ; aucun destinataire sélectionné par défaut. Un libellé indique clairement «… | P0 | Fait | Cases, rien coché par défaut, compteur |
| **PUB-03** Afficher titre, type/poids, version, chapitres par cible, date de publication, cible et effectif réel ; la… | P0 | Fait | Récapitulatif, effectifs réels, élèves en double signalés |
| **PUB-04** Autorisation vérifiée pour chaque cible au moment de confirmer. Les cibles perdues entre chargement et… | P0 | Fait | Autorisation revérifiée par cible en base |
| **PUB-05** L’enregistrement doit avoir une politique explicite de cohérence : soit tout-ou-rien transactionnel, soit… | P0 | Fait | Succès partiels détaillés par cible |
| **PUB-06** Pas de publication en double en cas de double clic, timeout suivi d’un retry, bouton Retour ou soumission… | P0 | Fait | Clé d'idempotence (0066) ; test publication-multiple |
| **PUB-07** La leçon publiée pointe vers une version figée ; les modifications ultérieures sont privées jusqu’à une… | P0 | Fait | Version figée |
| **PUB-08** L’élève non concerné par l’une des cibles n’a aucun accès au fichier même s’il connaît son URL. | P0 | Fait | RLS fichiers ; tests |
| **PUB-09** Supprimer une cible d’une publication n’enlève pas les autres ; préciser si « retirer de cette classe » ou… | P0 | Fait | Retrait par cible |
| **PUB-10** Programmer une publication date/heure avec fuseau Europe/Paris et interprétation correcte des changements… | P1 | Fait | Programmation Europe/Paris (0070) ; test programmation |
| **PUB-11** Autoriser une republication de version révisée avec diff/résumé ; les anciennes copies et remises restent… | P1 | Partiel | Republication versionnée ; pas de diff affiché |
| **PUB-12** Proposer publication immédiate ou plus tard, annuler programmation avant échéance, visualiser les… | P1 | Fait | Maintenant / plus tard, annulation (0070) |
| **PUB-13** Prévisualisation avec un compte fictif autorisé selon contexte, sans fabriquer des statistiques ni masquer… | P1 | Fait | Aperçu élève |
| **PUB-14** En cas de classe archivée ou groupe clôturé, avertir avant tentative et refuser proprement la cible. | P1 | Fait | Cibles archivées refusées |
| **PUB-15** Un cours déjà publié dans une cible ne doit pas être secrètement remplacé ; demander s’il s’agit d’une… | P1 | Fait | Republication = mise à jour explicite de la même séance |
| **PUB-16** Réutilisation programmée de la même leçon pour plusieurs établissements uniquement si partage… | P2 | Écarté | Pas de partage inter-établissements |

## Espace élève

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **STU-01** L’accueil élève montre tous les cours de sa classe principale et de ses groupes actifs, sans doublons… | P0 | Fait | Cours de la classe et des groupes actifs |
| **STU-02** Une leçon PDF originale est identifiable par une icône et un titre, puis s’ouvre dans un lecteur adapté… | P0 | Fait | Lecteur PDF dans la séance |
| **STU-03** Les leçons native/convertie sont affichées comme des contenus pédagogiques lisibles, pas comme des… | P0 | Fait | Lecture seule mise en forme |
| **STU-04** Une leçon non publiée, programmée dans le futur ou retirée ne doit pas apparaître dans la recherche, les… | P0 | Fait | Non publiée invisible partout ; test ATTAQUE-05 |
| **STU-05** Deux élèves dans deux groupes différents, même classe, ne voient pas les mêmes documents si les groupes… | P0 | Fait | Groupes distincts ; test groupes |
| **STU-06** Les corrections de devoir et réponses d’exercices ne se révèlent qu’au moment autorisé, indépendamment de… | P0 | Fait | Corrigés à l'heure dite |
| **STU-07** Affichage mobile : PDF lisible, zoom contrôlé, possibilité de téléchargement lorsque autorisé, messages en… | P1 | Fait | Lecteur mobile, téléchargement |
| **STU-08** Indiquer clairement l’origine : « Mathématiques · Spé Maths A · Chapitre 3 » et le professeur rattaché. | P1 | Partiel | Matière, classe ou groupe, chapitre ; professeur pas toujours affiché |
| **STU-09** En cas de changement de groupe, actualiser le menu et empêcher l’ouverture de nouvelles ressources non… | P1 | Fait | Droits recalculés à chaque requête |
| **STU-10** L’élève ne peut pas modifier, déposer ou supprimer le fichier source de l’enseignant, ni publier à sa place. | P1 | Fait | RLS : l'élève ne modifie rien |
| **STU-11** Signaler lien externe inactif, ressource archivée, fichier indisponible et document en maintenance avec… | P1 | Partiel | Fichier indisponible signalé ; lien externe non vérifié |
| **STU-12** Progression/état « consulté » uniquement si la collecte de cet indicateur est justifiée, transparente,… | P2 | Écarté | Pas de suivi « consulté » (minimisation) |

## Pédagogie

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **PED-01** Un devoir cible un enseignement exact et ne doit jamais être remis par un élève externe à cet espace. | P0 | Fait | Remise limitée à l'espace ; tests remises |
| **PED-02** L’exercice attaché à une leçon conserve un état de publication propre à la cible ; pas de fuite de… | P0 | Fait | État propre par cible |
| **PED-03** Les rendus passés ne disparaissent pas si un professeur ou un élève change d’affectation ; prévoir droits… | P0 | Fait | Archives : titulaire et co-intervenant, jamais tout le monde (0076) |
| **PED-04** Deux professeurs du même espace partagent ou non les capacités de correction selon leur rôle explicite ;… | P0 | Fait | Rôles testés ; test roles-affectations |
| **PED-05** Une échéance de devoir tient compte des dates, fuseaux, retards, modifications et état de publication ;… | P1 | Fait | Échéances en heure de Paris |
| **PED-06** Publier une nouvelle version de leçon ne modifie pas l’énoncé d’un devoir déjà commencé sans versionnement. | P1 | Fait | Versions figées |
| **PED-07** Prise en charge d’un élève arrivé après publication : déterminer et appliquer la politique « voir les… | P1 | Partiel | Politique appliquée (séances publiées visibles), non documentée à l'écran |
| **PED-08** Messagerie/entraide/salons de groupe : appliquer les mêmes droits que le groupe au niveau lecture et… | P1 | Partiel | Salons de classe et de cours ; salons de groupe non vérifiés |
| **PED-09** Les documents joints aux copies restent distincts des supports de cours et ont des politiques de… | P1 | Fait | Pièces de copie distinctes (0042) |
| **PED-10** Statistiques par classe/groupe agrégées et accessibles uniquement aux enseignants habilités ; jamais… | P2 | Partiel | Agrégats professeur ; pas de tableau par groupe |

## Imports

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **IMP-01** Aucun compte, classe, groupe ou affectation créé lors du simple dépôt ou de l’aperçu. | P0 | Fait | Aperçus sans écriture ; test IMPG-01 |
| **IMP-02** Identifiant externe stable préféré pour les rapprochements ; ne pas fusionner automatiquement deux… | P0 | Fait | INE d'abord ; homonymes « à confirmer » (0080) ; test FPR-03 |
| **IMP-03** Une ligne professeur contenant trois matières et cinq cibles doit produire seulement les couples… | P0 | Fait | Couples matière × classe explicites |
| **IMP-04** Repérer un compte déjà présent sans créer un deuxième compte ; afficher « existant », « mis à jour », «… | P0 | Fait | Nouveau, existant, changement de classe, à confirmer, rejeté (0080) |
| **IMP-05** Import de groupes : nom/type/année, rattachement, élèves, matière, enseignants, dates ; validation séparée… | P0 | Fait | Import de groupes (0079) ; tests import-groupes |
| **IMP-06** Rapport de différences avant application : nombres créés, modifiés, fermés, inchangés et rejetés ;… | P0 | Fait | Rapport avant et après application |
| **IMP-07** Reprise après interruption sans doubles écritures : clés d’idempotence, checkpoints et traçabilité. | P0 | Fait | Rejouable sans doublon (0038, 0079) |
| **IMP-08** Erreur sur une ligne : ne pas cacher les lignes réussies ; la politique atomique choisie est claire et… | P0 | Fait | Ligne par ligne, réussies conservées |
| **IMP-09** Import impossible pour un lycée/année d’un autre contexte, même avec un fichier forgé. | P0 | Fait | Établissement recalculé en base ; test IMPG-04 |
| **IMP-10** Supporter colonnes dans le désordre, accents, espaces, majuscules, formats de dates différents et… | P1 | Fait | Colonnes reconnues et corrigeables (« Vérifier les colonnes ») |
| **IMP-11** Cellules fusionnées, fichier protégé, feuille vide, formules XLSX, noms répétés, lignes vides, doublons… | P1 | Partiel | Lignes vides, doublons internes, fichiers illisibles ; cellules fusionnées non traitées à part |
| **IMP-12** Gérer l’import de 1 000 élèves + groupes + services enseignants, avec pagination serveur et avancement… | P1 | Partiel | 800 élèves par lot, 3 000 lignes de groupes ; au-delà, plusieurs fichiers |
| **IMP-13** Ne pas stocker en clair des fichiers d’import au-delà de la durée prévue ; purge, stockage privé et… | P1 | Fait | Pas de fichier brut conservé ; lignes purgées (purge_after) |
| **IMP-14** Exporter un modèle minimal par type d’import et un fichier d’erreurs contenant les lignes à corriger, sans… | P1 | Fait | Modèles et fichier des lignes à corriger ; tests fichiers-import |
| **IMP-15** Différencier fichier de données incomplet et fichier de synchronisation complet : l’absence d’un prof d’un… | P1 | Fait | Import « ajouter » : jamais de retrait implicite |
| **IMP-16** Le mapping doit survivre à l’actualisation et pouvoir être repris, sans créer de modification silencieuse. | P1 | Fait | Correspondance choisie gardée avec le lot |
| **IMP-17** Suggestion des matières et classes déjà existantes par correspondance transparente, avec choix manuel et… | P2 | Partiel | Classes rapprochées par code normalisé ; pas de suggestion de matière |
| **IMP-18** Import récurrent depuis un système tiers uniquement si autorisation contractuelle, identifiants stables et… | P2 | Écarté | Pas d'import tiers récurrent |

## Années scolaires

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **YR-01** Afficher l’année active partout où elle change le sens d’une donnée ou d’une affectation ; ne jamais… | P0 | Fait | Année en base, affichée |
| **YR-02** Préparer l’année suivante sans modifier les droits de l’année courante tant que la bascule n’est pas validée. | P0 | Fait | Préparation sans effet avant bascule ; test rentree |
| **YR-03** Bascule contrôlée après aperçu : classes cible, élèves sans classe, profs non affectés, groupes à… | P0 | Fait | Aperçu avant bascule |
| **YR-04** Conserver copies, corrections, contenus publiés et traces de création dans l’année d’origine. | P0 | Fait | Rien supprimé ; relevé d'archive (0075) |
| **YR-05** Aucun enseignant ne doit voir en cours actif une classe archivée parce qu’il avait un service l’an dernier. | P0 | Fait | Cours archivé non modifiable en base (0076) ; test ARCP-01 |
| **YR-06** Les groupes et leurs membres ne sont pas reconduits automatiquement : proposer une reconduction avec… | P1 | Fait | Reconduction de groupes révisée (0073) |
| **YR-07** Reconduire une progression pédagogique sans recopier les données nominatives des élèves ni les soumissions. | P1 | Fait | Réutiliser une séance archivée (0076) ; test ARCP-04 |
| **YR-08** Gérer le professeur qui reste, part, est remplacé ou change de matière lors de la bascule. | P1 | Partiel | Affectations reconduites ou terminées ; pas d'écran dédié aux départs |
| **YR-09** Afficher l’historique en lecture seule aux rôles autorisés avec étiquette claire « Année archivée ». | P1 | Fait | Admin (0075) et professeurs (0076), « Année archivée » |
| **YR-10** Empêcher une double bascule concurrente, un changement de fuseau mal interprété ou une bascule vers une… | P1 | Partiel | Bascule contrôlée, classes requises ; verrou concurrent non testé |
| **YR-11** Rapports comparatifs d’effectif et de couverture des enseignements, sans dériver de profilage d’élèves. | P2 | Non fait | Pas de rapport comparatif (P2) |

## Ergonomie

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **UX-01** Toutes les fonctionnalités critiques utilisables sans souris et depuis le clavier ; focus apparent et… | P0 | Fait | Boutons, dialogues natifs, focus visible |
| **UX-02** Les champs ont libellés, erreurs associées, aide et validation serveur ; aucun état seulement identifié… | P0 | Fait | Libellés, erreurs en texte, validation serveur |
| **UX-03** Sur 320–390 px, pas de bouton de validation hors écran, pas de barre horizontale globale ni de popup… | P0 | Fait | Captures 390 px sans débordement |
| **UX-04** Sur tablette, sélecteurs multi-lignes adaptés au tactile ; cibles tactiles suffisantes ; ne pas exiger hover. | P0 | Fait | Cibles 44 px, pas de survol obligatoire |
| **UX-05** Confirmation réelle sur opérations risquées : sortie d’un groupe, publication multiple, archivage,… | P0 | Fait | Confirmations explicites |
| **UX-06** Barre de recherche avec résultats paginés, filtres combinables et liens partageables lorsque approprié. | P1 | Fait | Recherches en GET, partageables |
| **UX-07** Undo local pour les modifications de formulaire, mais aucun « Annuler » mensonger après une écriture… | P1 | Fait | Pas d'« Annuler » mensonger |
| **UX-08** Respect prefers-reduced-motion, contraste, grossissement 200 % et libellés lisibles. | P1 | Fait | prefers-reduced-motion respecté |
| **UX-09** Messages d’erreur : cause, élément impacté, conséquence et prochaine action. Aucun SQL, stack trace ni clé… | P1 | Fait | Messages sans détail technique |
| **UX-10** Indiquer si les données viennent d’un cache et quand elles ont été actualisées, quand cela évite une… | P1 | Fait | Bandeau hors ligne |
| **UX-11** Les dialogues et tiroirs gardent le focus, ferment avec Échap, demandent confirmation en cas de… | P1 | Fait | Dialogues natifs : focus et Échap |
| **UX-12** Barre d’actions contextuelles permettant opérations de groupe sur plusieurs lignes sélectionnées, sans… | P2 | Partiel | Sélections multiples ponctuelles |

## Sécurité

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **SEC-01** Aucun utilisateur du lycée A ne peut lire, modifier, publier ou télécharger une ressource du lycée B, y… | P0 | Fait | Tests isolation, attaques, sonde sans compte |
| **SEC-02** Vérification du rôle et du second facteur requis côté serveur sur les actions administratives ; ne pas… | P0 | Fait | Rôle et second facteur revérifiés côté serveur |
| **SEC-03** Les fonctions privilégiées utilisent une autorisation explicite, un search_path maîtrisé, permissions SQL… | P0 | Fait | Registre des privilèges vérifié à chaque livraison |
| **SEC-04** service_role et clés secrètes jamais envoyés au navigateur, au HTML ou aux logs ; l’accès privilégié est… | P0 | Fait | service_role côté serveur seulement |
| **SEC-05** Autorisations de lecture de fichiers évaluées avant génération de lien et lors du téléchargement ; buckets… | P0 | Fait | Route de fichiers vérifiée à chaque requête |
| **SEC-06** Les documents étudiants (copies, corrections individuelles, notes) ont des règles différentes des leçons… | P0 | Fait | Règles distinctes copies / leçons |
| **SEC-07** Revalidations de permissions lors des actions asynchrones : le professeur peut perdre son affectation… | P0 | Fait | Publication programmée revérifiée à l'heure dite (0081) ; tests PUBR-02, PUBR-03 |
| **SEC-08** Les comptes suspendus, compromis, désactivés ou sans appartenance valide perdent immédiatement les actions… | P0 | Fait | Comptes suspendus coupés (0043) |
| **SEC-09** API idempotentes et contrôles contre CSRF, XSS, injection SQL, traversal de chemins, SSRF, IDOR, déni de… | P0 | Fait | CSRF, idempotence, aucune injection HTML |
| **SEC-10** Valider le vrai type des fichiers par signature/contenu, la taille, le nombre de pages si applicable, la… | P0 | Fait | Signature, taille, 50 pages au plus ; antivirus « si disponible » : aucun disponible |
| **SEC-11** La prévisualisation PDF ne doit pas exécuter de JavaScript embarqué ni transformer le document en origine… | P0 | Fait | Rendu canevas, CSP sandbox |
| **SEC-12** Un ancien lien vers une leçon retirée ne doit pas contourner la nouvelle autorisation. | P0 | Fait | Autorisation à chaque lecture |
| **SEC-13** Journaux structurés sans noms, mots de passe, texte intégral des cours, données élèves ou secrets ;… | P1 | Fait | Journaux JSON sans données personnelles |
| **SEC-14** Historique d’audit : qui a créé, modifié, retiré une affectation, ajouté un groupe, publié une leçon,… | P1 | Fait | audit_events sur chaque écriture |
| **SEC-15** Mesures de protection contre les abus de stockage, spam de fichiers et multiplication de groupes : quotas… | P1 | Partiel | Plafonds ponctuels ; pas de quotas configurables |
| **SEC-16** Sauvegardes et restauration testées : récupérer la relation entre fichiers, versions et publications, pas… | P1 | Fait | Restauration testée sur une vraie sauvegarde ; test v7-sauvegarde-restauration |
| **SEC-17** Toute assistance de l’exploitant nécessitant lecture de données pédagogiques privées doit passer par un… | P1 | Fait | Exploitation séparée et tracée |
| **SEC-18** Gestion des données après départ, fin de contrat, clôture d’établissement, demande RGPD, incident de… | P1 | Partiel | Conservation du journal (0064), export personnel ; arbitrage juridique à faire |
| **SEC-19** Les exports nominatifs nécessitent rôle autorisé, périmètre restreint, traçabilité et protection adaptée ;… | P1 | Fait | Exports : rôle, no-store, rien de secret |
| **SEC-20** Contrôles d’anomalies sur affectations massives, exports inhabituels et nombreuses erreurs d’accès, sans… | P2 | Non fait | Pas de détection d'anomalies (P2) |

## Données

| Exigence | Priorité | Statut | Preuve ou manque |
|---|---|---|---|
| **DATA-01** Chaque mutation reçoit un identifiant d’idempotence ou emploie une clé métier unique ; un timeout ne doit… | P0 | Fait | Clés métier et idempotence |
| **DATA-02** Les mises à jour de groupes et affectations sont sécurisées contre deux administrateurs agissant… | P0 | Fait | Index uniques (appartenances, affectations), écritures idempotentes, verrou sur le professeur principal ; séances : version optimiste |
| **DATA-03** Si un lot crée un compte puis échoue à l’ajout des affectations, renvoyer un état de reprise détaillé ; ne… | P0 | Fait | Application ligne par ligne, état de reprise |
| **DATA-04** Les appartenances/affectations historisées ont dates valides, unicité des périodes incompatibles et… | P0 | Fait | Dates historisées, lecture au jour |
| **DATA-05** Les clés étrangères composites comprenant organization_id sont conservées lorsque prévues ; migration… | P0 | Fait | FK composites ; tests inter-établissements |
| **DATA-06** Pour toute publication, valider l’existence de la version, la propriété ou le droit de partage, le rôle… | P0 | Fait | Publication validée en base |
| **DATA-07** Un fichier ne peut pas devenir « prêt » si son upload/validation a échoué ; mécanisme de nettoyage des… | P0 | Fait | Fichier « prêt » après vérification ; orphelins nettoyés |
| **DATA-08** Transaction de groupe : une appartenance ne pointe pas vers un élève d’un autre établissement, vers un… | P0 | Fait | Contrôles d'appartenance de groupe |
| **DATA-09** Assurer une pagination stable, des index adaptés et des limites raisonnables de requêtes ; pas de… | P1 | Fait | Pagination serveur (0072) ; plafonds journalisés |
| **DATA-10** Pour les états de traitement, exposer un statut fiable, nombre de tentatives, erreur exploitable et… | P1 | Fait | États de traitement exposés |
| **DATA-11** Définir politique de réutilisation de PDF original entre publications avec stockage dédupliqué éventuel,… | P1 | Partiel | Une révision partagée entre publications ; pas de déduplication par empreinte |
| **DATA-12** Toute migration doit fournir test avant/après, SQL de vérification, sauvegarde, plan de… | P1 | Fait | Chaque migration : tests, retour arrière, sauvegarde vérifiée |
| **DATA-13** Traces d’audit et timestamps en UTC, affichage en heure locale ; dates de début/fin en convention documentée. | P1 | Fait | UTC en base, Paris à l'écran |
| **DATA-14** Conserver l’origine du contenu (manuel, PDF original, DOCX/PDF converti), l’auteur, l’état, la version… | P1 | Fait | Origine, auteur, version, cibles conservés |
| **DATA-15** Rechercher la leçon via un index autorisé, mis à jour après publication/archivage sans divulguer les… | P2 | Fait | Recherche sous droits (0049) |

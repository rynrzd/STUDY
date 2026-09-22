# 04 — Modèle de menace

*Qui voudrait quoi, avec quels moyens, et ce que le système oppose. Un modèle de
menace qui liste des attaquants abstraits ne sert à rien : celui-ci part de ce
qui arrive réellement dans un lycée.*

## Ce qu'il y a à prendre

Par ordre de valeur pour un attaquant, et d'impact pour un élève :

1. **Le contenu d'une copie et son appréciation.** Ce n'est pas une donnée
   sensible au sens du RGPD, mais c'est ce qui humilie un adolescent si ça
   circule dans un groupe de classe.
2. **Les identifiants d'un compte**, surtout d'un professeur ou d'un
   administrateur — ils ouvrent les copies des autres.
3. **Les listes nominatives** : qui est dans quelle classe.
4. **La disponibilité** elle-même : empêcher une remise la veille d'une
   échéance.

## Les attaquants réalistes

### A — L'élève curieux ou malveillant

**De loin le plus probable.** Il est déjà authentifié, il connaît les noms de
ses camarades, il a du temps, et il n'a pas besoin de compétences : il suffit
souvent de changer un identifiant dans une adresse.

**Ce qu'il tentera** : ouvrir la copie d'un autre, lire un devoir avant
publication, voir une correction avant sa diffusion, deviner la référence
d'accusé d'un camarade, usurper un compte laissé ouvert.

**Ce qui l'arrête** : l'autorisation vit dans la base, pas dans l'écran. Changer
un identifiant dans une adresse ne sert à rien : la politique de ligne ne rend
pas la ligne. 202 tests le vérifient sur du vrai PostgreSQL.

**Ce que l'audit a trouvé sur cet axe** : F-01 — la référence d'accusé de remise
était calculable par un appel anonyme. Il fallait encore connaître
l'identifiant de version, que RLS protège, mais la promesse « non devinable »
était affaiblie. Corrigé.

### B — Le camarade avec un accès physique au poste

Un poste du CDI, une session laissée ouverte, un téléphone non verrouillé.

**Ce qui l'arrête** : la session « poste partagé » expire beaucoup plus vite ;
le cookie est `HttpOnly` et opaque, donc ni lisible par un script ni exploitable
ailleurs ; un compte administratif prend toujours la fenêtre la plus courte,
même sur un appareil personnel.

**Ce qui manque** : un utilisateur ne peut pas révoquer lui-même ses autres
sessions. Relevé par l'exercice sur table n° 1.

### C — L'attaquant opportuniste depuis Internet

Il ne vise pas AvecStudy en particulier. Il balaie, il essaie des mots de passe
courants, il cherche une API ouverte.

**Ce qui l'arrête** : aucune fonction de base exécutable sans compte (depuis la
correction de F-01) ; la limitation de tentatives ; l'absence d'énumération de
comptes ; les en-têtes de sécurité ; la barrière d'origine sur toute mutation.

**Ce que l'audit a trouvé** : F-07 — le balayage d'établissement passait sous
tous les compteurs. C'est **le** scénario de cet attaquant dans un lycée, où les
mots de passe sont distribués à la rentrée et se ressemblent. Corrigé.

### D — Le professeur ou l'administrateur dont le compte est compromis

**Ce qui limite** : sans second facteur, un administrateur **ne fait rien** de
privilégié — il verrait ses écrans, il ne pourrait ni créer, ni suspendre, ni
réinitialiser, ni modérer. Vérifié par les tests T16 et T16b.

**Ce que l'audit a trouvé** : F-02 — un compte suspendu gardait ses rôles tant
que sa session vivait. Le risque était déjà fermé par la révocation des
sessions, mais reposait sur une habitude. Rendu structurel.

### E — L'éditeur lui-même

Il faut le nommer, parce qu'un modèle de menace qui omet l'exploitant est
incomplet.

**Ce qui limite, côté applicatif** : le travail des élèves est fermé à
l'exploitant — quatre tests de la batterie le vérifient, en lecture comme en
écriture. Tout contournement de RLS passe par `clientExploitation(motif)`, dont
le paramètre est un **type fermé** de huit motifs, chacun commenté et relisible
dans un diff.

**Ce qui ne limite pas** : celui qui exploite une base peut la lire. Aucune
architecture ne peut prétendre le contraire, et ce dossier ne le prétend pas.
Ce qui existe en face, c'est la traçabilité des actes applicatifs et le fait que
cette limite soit écrite ici plutôt que tue.

### F — Le fournisseur d'hébergement

Vercel et Supabase peuvent techniquement accéder à l'infrastructure qu'ils
opèrent. C'est le sens même de la sous-traitance, et cela se traite par le
contrat, pas par le code.

**Ce que l'audit a trouvé sur cet axe** : F-08 — le rendu serveur s'exécutait
aux États-Unis, sans que rien ne le déclare. Corrigé. Ce qui reste : la
localisation contractuelle des sauvegardes, des journaux et des accès du
support, **NON VÉRIFIÉE** (R-02).

## Ce qui est hors du modèle

Ce que ce dossier ne prétend pas couvrir, et qu'il ne faut donc pas croire
couvert :

- **Un poste d'élève ou de professeur déjà compromis.** Si un logiciel espion
  est installé sur la machine, AvecStudy n'y peut rien — il verra ce que la
  personne voit.
- **Un attaquant étatique ou une chaîne d'approvisionnement compromise.** Hors
  de portée d'une structure de cette taille, et le prétendre serait faux.
- **Le réseau de l'établissement**, l'ENT, Pronote, EduConnect. Hors périmètre,
  et le mandat interdisait de les toucher.
- **Le déni de service.** Aucune protection spécifique au-delà de ce que
  l'hébergeur applique par défaut.

## La menace qui n'est pas un attaquant

Elle mérite sa propre section, parce que c'est celle qui s'est réalisée le plus
souvent dans l'histoire de ce produit : **l'erreur silencieuse**.

Trois exemples réels, tous trouvés par des contrôles et aucun par un attaquant :

- une politique de sécurité du contenu qui empêchait **tous** les scripts de se
  charger en production — sans la moindre erreur côté serveur ;
- deux variables de couleur qui n'existaient pas : ni la compilation, ni le
  typage, ni les tests ne le voient — seulement l'écran ;
- une fonction de sécurité couverte par sept tests verts, que **personne
  n'appelait**.

C'est pourquoi les contrôles de ce dossier lisent **ce qui est servi**, et non
ce qui est écrit. Et pourquoi chacun doit avoir été vu rouge avant d'être cru
vert.

# Hébergeurs : contrats et plans nécessaires avant de vendre

> Relevé le 8 octobre 2026 sur les pages officielles de Vercel et de Supabase
> (liens ci-dessous). Ce document ne résume pas les contrats : il dit **où** ils
> se trouvent et **quelle condition** ils posent. Le plan actuel des comptes
> Vercel et Supabase de Study n'a **pas** pu être vérifié (pas d'accès aux
> consoles) : c'est la première chose à regarder.

## Vercel (application, Paris `cdg1`)

| Point | Ce que dit Vercel | Conséquence pour Study |
|---|---|---|
| Accord de traitement (DPA) | « This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans. » ([vercel.com/dpa](https://vercel.com/dpa)) | **Sur le plan gratuit (Hobby), aucun DPA ne couvre le traitement.** L'annexe de sous-traitance de Study ne peut alors pas citer Vercel comme sous-traitant ultérieur encadré. |
| Usage commercial | Le plan Hobby est réservé à un usage personnel non commercial ; tout usage commercial demande Pro ou Enterprise ([docs Hobby](https://vercel.com/docs/plans/hobby), [Fair use](https://vercel.com/docs/limits/fair-use-guidelines), [conditions](https://vercel.com/legal/terms)). | Vendre des licences à des établissements est un usage commercial : **le projet doit être sur Pro** avant le premier contrat. |
| Sous-traitants de Vercel | Registre tenu sur [security.vercel.com](https://security.vercel.com) ; notification des nouveaux sous-traitants sur demande à privacy@vercel.com. | À joindre au dossier ; s'abonner aux notifications. |
| Transferts | Clauses contractuelles types 2021 (modules 1, 2, 3), droit irlandais. | À citer dans le chapitre 08 une fois le DPA accepté. |

Indice, non une preuve : le code s'aligne sur la durée d'exécution la plus
basse (10 s) et sur la limite de corps de requête de 4,5 Mo, ce qui est
compatible avec un plan gratuit. **À vérifier dans la console.**

## Supabase (base, authentification, fichiers ; Irlande `eu-west-1`)

| Point | Ce que dit Supabase | Conséquence pour Study |
|---|---|---|
| Accord de traitement (DPA) | DPA publié sur [supabase.com/legal/dpa](https://supabase.com/legal/dpa) ; il complète les conditions du service, et l'acceptation du contrat vaut signature des clauses contractuelles types (modules 2 et 3, droit irlandais). | Le télécharger, le dater et le joindre à l'annexe de sous-traitance. |
| Sous-traitants de Supabase | Liste datée publiée ([liste du 1er juin 2026](https://supabase.com/legal/subprocessor-list/June-1-2026.pdf), [index](https://supabase.com/legal/subprocessor-list/)). | À joindre ; elle comprend notamment des hébergeurs et un service de suivi d'erreurs. |
| Sauvegardes | Plan gratuit : sauvegardes non téléchargeables, projets mis en pause après une semaine d'inactivité. Pro : sauvegarde quotidienne, 7 jours accessibles ; restauration à la seconde (PITR) en option payante ([sauvegardes](https://supabase.com/docs/guides/platform/backups), [tarifs](https://supabase.com/pricing)). | **Une base de production sur le plan gratuit n'a pas de sauvegarde restaurable par l'hébergeur et peut être mise en pause.** Le projet de production doit être sur Pro au minimum. |
| Mise en production | Liste de contrôle officielle ([going into prod](https://supabase.com/docs/guides/deployment/going-into-prod)). | À dérouler avec `docs/securite/annexe-controles-manuels.md`. |

## Ce qu'il faut faire, dans l'ordre

1. Ouvrir les consoles et noter le plan des deux projets de production.
2. Si l'un est sur le plan gratuit : passer en **Pro** (Vercel et Supabase)
   avant tout contrat ou pilote.
3. Accepter et télécharger les deux DPA ; télécharger les deux listes de
   sous-traitants ; les dater et les ranger dans `docs/securite/`.
4. Compléter le chapitre 08 (transferts) et l'annexe de sous-traitance, puis
   régénérer le dossier (`npm run securite:dossier -- --pdf`).
5. Supabase Pro : vérifier la sauvegarde quotidienne, puis jouer la
   restauration dans un projet séparé (`npm run restauration:test`).

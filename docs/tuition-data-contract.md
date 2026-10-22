# Contrat des sources de suivi des frais de scolarité

## État des fichiers inspectés

Le fichier de synthèse agrégée (Source C) est présent dans `Downloads` et a été lu localement en lecture seule. Ses en-têtes sont précédés de lignes de présentation, le séparateur détecté est le point-virgule et le parseur identifie un tableau mensuel ainsi qu'un tableau par filière. Les lignes de total général sont exclues des lignes de détail. Les sommes affichées dans ces deux tableaux ne concordent pas toutes; elles restent séparées et le tableau de bord signale que le rapprochement est à confirmer.

Les fichiers étudiants (A), échéancier (B) et référentiels (D) décrits par le propriétaire ne sont pas actuellement disponibles sous forme de CSV identifiable dans le dossier de téléchargements. Leurs valeurs réelles, leurs statuts et leurs formats ne sont donc pas présumés. Les imports locaux indépendants sont prêts à les recevoir.

## Rôle des sources

| Source | Contenu | Usage | Règle de périmètre |
|---|---|---|---|
| A | Étudiants et situation financière individuelle | Étudiants, soldes, prochaines échéances, formation/campus/année | Le nombre d'étudiants est calculé sur les identifiants distincts. Des identifiants dupliqués rendent les sommes individuelles indisponibles jusqu'au contrôle des doublons. |
| B | Échéancier et versements par échéance | Détail, échéances, statuts bruts, prévu/payé/restant, retards | L'identifiant d'échéance est requis pour compter des échéances distinctes. Les doublons suspendent les sommes afin d'éviter leur répétition. |
| C | Synthèse agrégée mensuelle et par filière | Contrôle et lecture des agrégats fournis | Les deux tableaux sont indépendants; leurs détails et totaux ne sont jamais additionnés entre eux ni avec A/B. |
| D | Listes de référence | Valeurs de filtre et référentiels | `Modes de paiement` et `Modes règlement` restent deux listes séparées. |

## Parsing, mapping et confidentialité

Chaque CSV peut être importé/remplacé indépendamment. Le parseur financier commun détecte le séparateur, retire le BOM, prend en charge UTF-8, Windows-1252 et UTF-16 avec BOM, ignore les préambules avant la ligne d'en-têtes, et parse les nombres français ainsi que les dates ISO/françaises. Les en-têtes reconnus sont mappés automatiquement; l'accordéon de mapping permet de corriger les associations. Les dates/nombres invalides restent `null` et font monter l'état de qualité à `incomplet`.

Les fichiers sont lus dans le navigateur et conservés uniquement dans la mémoire React. Aucun contenu de CSV n'est stocké dans `localStorage`, envoyé à un serveur, inclus dans les fixtures ou copié vers `public/`. La seule valeur persistée est la préférence claire/sombre.

## Règles de calcul

- Nombre d'étudiants = nombre d'`ID Étudiant` distincts, avec `Matricule` comme repli lorsque l'identifiant étudiant est absent.
- Les lignes A ne sont pas assimilées à des inscriptions distinctes.
- `Reste étudiant` est calculé comme Total à payer − Total payé lorsque ces deux montants sont valides. La valeur source de reste est conservée pour repérer une divergence; si un opérande manque, seul un reste source valide peut être utilisé.
- `Reste échéance` est calculé comme Montant prévu − Montant payé lorsque ces deux montants sont valides; la valeur source est retenue à défaut et ses écarts sont signalés.
- Une échéance distincte est comptée seulement si `ID Échéance` est mappé. Sans ID, le nombre d'échéances distinctes est indisponible même si les lignes restent consultables.
- Les sommes Source B utilisent les montants de B seuls et sont suspendues en présence d'IDs d'échéance dupliqués.
- Les statuts A/B sont affichés selon les valeurs source; aucune normalisation métier n'est codée sans confirmation.
- Le rapprochement étudiant/échéancier utilise le matricule normalisé. Il sert à mesurer les lignes reliées; il ne joint ni ne multiplie les montants.
- Les graphiques planifié/collecté par mois utilisent respectivement la date d'échéance et la date de paiement lorsque ces dates existent.
- La Source C exclut les totaux généraux. Les écarts entre tableaux mensuels et par filière sont signalés, pas corrigés. L'application ne suppose pas que des indicateurs homonymes partagent le même périmètre.
- Aucun montant Source A, B ou C n'est additionné avec une autre source.

## Pages

- **Vue d'ensemble** ajoute une section de scolarité séparée lorsque des sources A/B sont chargées; la vue commerciale et son filtre de date restent inchangés.
- **Étudiants & inscriptions** fournit recherche matricule/nom/prénom, filtres de formation, campus, année et statut, un tableau et une fiche locale.
- **Échéancier** expose les statuts source, les montants et dates disponibles, les filtres de statut/formation/mode règlement, la tendance mensuelle et le détail.
- **Revenus & encaissements** garde les métriques A, B et C dans des blocs indépendants.
- **Analyse par formation** montre les données détaillées A/B et les agrégats C dans des tables séparées.
- **Référentiels & paramètres** montre l'état des sources et les listes disponibles.

Le filtre de date en haut utilise une période financière distincte des filtres commerciaux. Dans les vues A/B, elle s'applique à la prochaine échéance pour A et à la date d'échéance pour B. La table Source C n'a pas de date complète et utilise ses contrôles propres par mois/filière.

## Limites avant validation métier

1. Importer les fichiers A, B et D réels localement dans l'application et vérifier en-têtes, mappings, types, identifiants, doublons, lignes vides/totaux et valeurs statutaires.
2. Confirmer si une ligne A correspond toujours à un étudiant et comment une inscription distincte est identifiée.
3. Confirmer la définition des montants et statuts, notamment partiels, paiements, échéances à venir et retards.
4. Définir un périmètre temporel et métier commun avant toute réconciliation A/B/C. Les sommes incohérentes de C ne sont pas réparées par le code.
5. Les fichiers A/B/D n'étant pas disponibles, la validation actuelle repose sur des fixtures synthétiques; la compatibilité réelle reste à vérifier.

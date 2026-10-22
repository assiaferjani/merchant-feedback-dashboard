# Schéma et dictionnaire des données

## Statut des informations

- **Confirmé**: nom de colonne observé dans la description du schéma et présence apparente de la donnée annoncée.
- **Supposé**: choix fait uniquement pour rendre le jeu synthétique testable; ne décrit pas nécessairement la source réelle.
- **Inconnu**: sens métier à confirmer auprès du propriétaire des données.
- **Futur**: extension possible après confirmation; absente du schéma courant.

Le CSV synthétique conserve exactement les 16 colonnes connues, dans leur ordre. Il n'ajoute pas d'identifiant ni de note numérique.

| Champ | Type dans le CSV synthétique | Interprétation actuelle | Confiance |
|---|---|---|---|
| `IDENTITE_LEAD` | Texte | Identifiant d'entité fictive; rôle réel non établi | Inconnu — sens à confirmer par le propriétaire des données |
| `ANNEE_LEAD` | Entier | Année dérivée de la date dans le jeu fictif; sens réel du champ non établi | Inconnu — sens à confirmer par le propriétaire des données |
| `MOIS_LEAD` | Entier | Mois dérivé de la date dans le jeu fictif; sens réel du champ non établi | Inconnu — sens à confirmer par le propriétaire des données |
| `LIB_AVIS` | Texte/catégorie | Libellé de retour/avis; aucune correspondance avec une note n'est établie | Inconnu — sens à confirmer par le propriétaire des données |
| `DATE_AVIS` | Date/heure ISO 8601 | Date et heure du retour | Élevée |
| `IdxJours` | Entier | Index de jour synthétique pour tester la structure; calcul réel inconnu | Inconnu — sens à confirmer par le propriétaire des données |
| `ANNEE_MOIS` | Entier `AAAAMM` | Clé année-mois synthétique calculée depuis `DATE_AVIS` | Moyenne pour le rôle dans le jeu; sens source à confirmer |
| `ANNEE_AVIS` | Entier | Année de `DATE_AVIS` | Élevée |
| `MOIS_AVIS` | Entier 1–12 | Mois de `DATE_AVIS` | Élevée |
| `RESPONSABLE` | Texte | Nom fictif; rôle métier réel inconnu | Inconnu — sens à confirmer par le propriétaire des données |
| `LIB_SOURCE_LEAD` | Texte/catégorie | Libellé de source fictif; sens réel inconnu | Inconnu — sens à confirmer par le propriétaire des données |
| `COMMENTAIRE_LEAD_AVIS` | Texte, parfois vide | Commentaire associé au retour | Élevée |
| `EST_CLASSER` | Texte/catégorie | Valeur de classe fictive; ni statut ni signification supposés | Inconnu — sens à confirmer par le propriétaire des données |
| `LIB_ETABLISSEMENT` | Texte/catégorie | Nom d'établissement fictif; candidat possible pour l'établissement/commerçant | Faible — sens à confirmer par le propriétaire des données |
| `SEMAINE_AVIS` | Entier 1–53 | Numéro de semaine ISO de `DATE_AVIS` dans le jeu synthétique | Moyenne pour le jeu; convention source à confirmer |
| `LIB_REGION` | Texte/catégorie | Région fictive pour les comparaisons | Faible — rôle plausible, valeurs réelles non utilisées |

### Sémantique non résolue

Le sens de `LIB_AVIS`, `IDENTITE_LEAD`, `LIB_ETABLISSEMENT`, `RESPONSABLE`, `LIB_SOURCE_LEAD` et `EST_CLASSER` **requiert confirmation du propriétaire des données**. Les noms de colonnes seuls ne prouvent pas leur définition. Dans le jeu synthétique, leurs valeurs servent uniquement à tester des catégories et filtres.

La structure connue ne confirme aucun champ de note numérique. Une note moyenne ne peut pas être calculée de manière fiable. Si le propriétaire confirme une note, l'extension future proposée est `RATING_AVIS`, numérique, plage attendue 1–5; elle ne fait pas partie du schéma actuel et aucune conversion de `LIB_AVIS` n'est présumée.

### Types recommandés dans Google Sheets / Looker Studio

- `DATE_AVIS`: Date et heure (format ISO 8601 dans le CSV: `AAAA-MM-JJ HH:MM:SS`).
- `ANNEE_LEAD`, `MOIS_LEAD`, `IdxJours`, `ANNEE_MOIS`, `ANNEE_AVIS`, `MOIS_AVIS`, `SEMAINE_AVIS`: nombres entiers.
- Autres colonnes: texte.
- `COMMENTAIRE_LEAD_AVIS`: texte nullable; les cellules vides sont permises.

Les colonnes `ANNEE_LEAD`, `MOIS_LEAD` et `IdxJours` sont remplies selon des règles de démonstration documentées dans le générateur. Ne supposez pas que les règles synthétiques décrivent la source réelle.

## Profil structurel de l'extrait local réel

Cette section consigne uniquement des métadonnées agrégées observées lors d'une inspection locale autorisée. Le CSV réel n'a pas été copié dans le projet; aucun nom, commentaire, libellé de catégorie ou enregistrement n'est reproduit ici. Ces statistiques décrivent un extrait local, pas nécessairement le fichier complet qui continue d'évoluer sur l'ordinateur du responsable.

- Lignes de données: 2 065; 16 colonnes; aucune ligne entièrement vide ni ligne de largeur incohérente.
- Encodage détecté: Windows-1252; séparateur: point-virgule (`;`). Le fichier synthétique reste distinct: UTF-8 avec BOM et séparateur virgule.
- `DATE_AVIS`: 2 065/2 065 valeurs analysées au format ISO date/heure avec fraction de seconde; période observée de 2025-07-15 à 2026-09-14.
- Champs numériques observés: `ANNEE_LEAD`, `MOIS_LEAD`, `IdxJours`, `ANNEE_MOIS`, `ANNEE_AVIS`, `MOIS_AVIS`, `SEMAINE_AVIS` sont des entiers dans l'extrait.
- Autres champs: valeurs textuelles; `COMMENTAIRE_LEAD_AVIS` contient quatre champs vides et une valeur dont la forme ressemble à un entier. Il doit rester typé Texte.
- Aucun champ n'est vide dans l'extrait, hormis les quatre commentaires manquants.
- Les composants année, mois et semaine de `DATE_AVIS` correspondent respectivement à `ANNEE_AVIS`, `MOIS_AVIS` et au numéro de semaine ISO sur 2 065/2 065 lignes.
- `ANNEE_LEAD` et `MOIS_LEAD` ne correspondent pas systématiquement à l'année et au mois de `DATE_AVIS` (33 et 754 lignes diffèrent respectivement). Ne les utilisez pas comme composantes de la date du retour; leur sens reste inconnu.
- `ANNEE_MOIS` ne correspond pas à un `AAAAMM` calculé depuis `DATE_AVIS` sur 2 065/2 065 lignes. Son sens reste inconnu; ne l'utilisez pas comme dimension mensuelle du retour sans confirmation.

Cardinalités observées (nombres de valeurs non vides distinctes; aucune valeur elle-même n'est reproduite):

| Champ | Valeurs distinctes dans l'extrait | Conséquence pour l'analyse |
|---|---:|---|
| `IDENTITE_LEAD` | 754 | Forte cardinalité, mais son sens et son rôle d'identifiant restent inconnus. Ne pas le substituer au commerçant. |
| `LIB_AVIS` | 11 | Catégories textuelles; aucune échelle numérique n'est établie. |
| `RESPONSABLE` | 6 | Texte; rôle métier à confirmer. |
| `LIB_SOURCE_LEAD` | 15 | Texte; sens à confirmer. |
| `EST_CLASSER` | 1 | Aucune comparaison de distribution n'est possible sur cet extrait. Sens à confirmer. |
| `LIB_ETABLISSEMENT` | 1 | L'extrait ne permet pas de valider une comparaison entre établissements. Le champ ne prouve pas à lui seul l'identité du commerçant. |
| `LIB_REGION` | 19 | Plusieurs valeurs sont présentes, mais le rôle métier reste à confirmer. |

Ces observations valident les types et les limites du modèle, pas les définitions métier. Elles ne démontrent pas que l'extrait local couvre tous les commerçants ni que le CSV est une source continuellement actualisée.

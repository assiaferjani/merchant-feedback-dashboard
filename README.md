# Solen Digital · Pilotage de l’activité et des finances

Tableau de bord React/Vite en français pour analyser les avis commerciaux, les dossiers étudiants, les échéances et les synthèses financières. Les espaces sont séparés pour éviter de confondre les comptages ou d’additionner des montants qui ne couvrent pas le même périmètre.

L’application fonctionne localement dans le navigateur. Elle ne possède ni comptes utilisateurs, ni base partagée entre appareils. La publication du site statique ne publie pas les fichiers que vous importez.

## Démarrer

Node.js 22.12 ou version ultérieure compatible avec Vite est requis.

```bash
npm ci
npm run dev
```

Ouvrir l’adresse locale affichée par Vite. Pour vérifier la version de production :

```bash
npm run build
npm run preview
```

## Connecter ses données

1. Cliquer sur **Connecter un fichier** et laisser la détection automatique ou choisir son contenu : avis, dossiers étudiants, échéancier, synthèse financière ou listes de référence.
2. Sélectionner un fichier **CSV, TSV, TXT délimité, Excel (.xlsx/.xls) ou LibreOffice (.ods)** depuis Windows, macOS ou Ubuntu. Les fichiers texte acceptent les séparateurs virgule, point-virgule et tabulation, en UTF-8, Windows-1252 ou UTF-16 avec BOM. Pour un classeur, la première feuille visible contenant des données est importée et son nom est affiché dans les sources. Placez la feuille souhaitée en premier ou exportez-la séparément. Les formules ne sont pas exécutées : le classeur doit contenir leurs résultats enregistrés. Les erreurs de calcul et formules sans résultat sont signalées. Depuis Numbers, exporter en Excel ou CSV. PDF, images et documents non structurés ne sont pas pris en charge. Limites : **20 Mo et 100 000 lignes**, et 512 colonnes par feuille de classeur.
3. Vérifier les colonnes reconnues et les contrôles de qualité dans la rubrique correspondante. Un fichier financier générique nécessite de définir ses correspondances avant de calculer des montants.
4. Dans **Sources & paramètres**, confirmer la devise des fichiers financiers et rapprocher les totaux avec les exports d’origine. Le choix d’une devise ajoute une unité ; il ne convertit aucun montant.

Les imports sont analysés dans un Web Worker, indépendamment du fil d’affichage. Le tableau de bord indique les étapes de lecture et de validation. Un import échoué conserve la source précédente.

**Sources & paramètres** rassemble les cinq sources, leurs noms, dates d’import, nombres de lignes et correspondances. Les sources ne sont jamais fusionnées automatiquement. Les critères de paiement encaissé restent à confirmer explicitement à partir des statuts observés dans le fichier.

## Exports annuels de scolarité et détection des sources

- La détection automatique reconnaît les exports d’avis, les dossiers étudiants et les synthèses financières à partir de leurs colonnes. Un choix manuel incompatible avec le contenu reconnu affiche une explication.
- Lorsque « ID Étudiant » contient les niveaux L1, L2, L3, MP1 ou MP2, le niveau est conservé séparément et le matricule identifie le dossier.
- Les lignes de modèle sans étudiant et les synthèses ajoutées après « Total à encaisser » ou « SYNTHÈSE DES ÉCHÉANCES » sont exclues des dossiers. Le nombre de lignes exclues reste visible.
- Les imports d’une seule année universitaire s’ajoutent aux autres années. Réimporter la même année la remplace, même si le nom du fichier ou le séparateur de l’année change. Sans année unique identifiée, l’import remplace la source étudiante. Le filtre d’année permet de consulter une promotion ; les montants correspondent aux dossiers identifiés par référence ou matricule et année.
- Les pourcentages sont reconnus. Les écarts entre le reste déclaré et « à payer moins payé » restent signalés ; les fichiers d’origine ne sont pas modifiés.
- Deux versions d’un export d’avis se remplacent : elles ne sont pas additionnées.

## Stockage et restauration

- Les imports et leurs correspondances sont enregistrés dans **IndexedDB**, sur cet appareil et dans ce profil de navigateur.
- Ils sont restaurés après rechargement. Les périodes, principaux filtres et préférences d’affichage sont enregistrés séparément dans le stockage local.
- Effacer les données du navigateur efface aussi les imports. Conserver les fichiers d’origine comme sauvegarde ; les réimporter permet de restaurer l’espace.
- Le bouton **Effacer les imports enregistrés** exige une confirmation explicite. Le message de réussite apparaît après la suppression locale.
- Une source financière liée à un fichier peut être relue lorsque le navigateur autorise cette fonctionnalité. L’import de fichier normal reste disponible sans cette autorisation.
- Si le stockage est bloqué ou saturé, l’interface le signale. Ne pas supposer que les derniers imports sont sauvegardés tant que cette erreur persiste.

Aucun fichier de production ne doit être ajouté au dépôt. Seul `data/merchant_feedback_synthetic.csv`, entièrement fictif, est inclus pour la démonstration.

## Lire les résultats

Les lignes d’avis, candidats distincts, étudiants distincts et échéances sont des mesures différentes. Les catégories d’avis ne sont pas interprétées comme un sentiment, une note ou un statut candidat confirmé.

Les identifiants répétés et les valeurs financières manquantes peuvent suspendre des sommes plutôt que produire un total trompeur. Les agrégats mensuels et les agrégats par formation restent indépendants ; les écarts sont signalés et ne sont jamais corrigés silencieusement.

La devise n’est pas déduite du pays ou du symbole d’une icône. Sans confirmation, les montants sont explicitement marqués **devise non confirmée**. Une source commerciale distante configurée conserve sa propre devise validée.

Le filtre de période commerciale est indépendant du filtre financier. Les dates et les filtres de plusieurs rubriques sont conservés après rechargement. Les valeurs inconnues restent indisponibles ; elles ne sont pas remplacées par des zéros inventés.

Les cases de validation métier dans les paramètres sont une déclaration de l’utilisateur sur cet appareil. Elles ne remplacent ni la vérification du responsable des données ni un audit financier.

## Explorer et exporter

Les tableaux détaillés proposent recherche, tri et pagination. Les contrôles indiquent le nombre de résultats et l’intervalle affiché. Les exports précisent leur périmètre : derniers commentaires, ensemble des commentaires filtrés ou avis du rapport.

Les exports CSV citent chaque cellule, échappent les guillemets et préfixent les textes pouvant être interprétés comme des formules de tableur. Les nombres calculés restent numériques. Ces CSV sont destinés à une consultation humaine ; un tableur peut modifier leur représentation lors d’un nouvel enregistrement. Ne pas utiliser ces exports comme sauvegarde des fichiers d’origine.

## Vérifier les changements

```bash
npm run lint
npm test
npm run test:e2e
```

Lors de la première exécution des tests de navigateur :

```bash
npx playwright install chromium
```

Pour employer un Chrome déjà installé sous Linux :

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

Les tests couvrent les règles de calcul et de qualité, les exports, les limites d’import, les préférences, les imports via Worker, la restauration, la navigation, les dialogues clavier, les tableaux et l’accessibilité des écrans vides et remplis. Les contrôles responsive utilisent notamment 320, 390, 768 et 1440 pixels. Un CSV fictif de 20 000 lignes vérifie aussi le parcours de chargement et de restauration.

Les workflows GitHub exécutent les contrôles sur les pull requests et les branches de travail. Le déploiement GitHub Pages sur `main`/`master` est conditionné aux contrôles et aux tests navigateur. Les traces d’échec sont conservées comme artefacts de CI.

## Organisation du code

| Emplacement                             | Rôle                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| `src/Dashboard.jsx`                     | État partagé, navigation, imports et orchestration des pages       |
| `src/pages/`                            | Espaces avis, commercial, financier et gestion des sources         |
| `src/components/`                       | Navigation, dialogues, tableaux, graphiques et contrôles communs   |
| `src/dashboard-config.js`               | Libellés, formats et palette des graphiques                        |
| `src/import-service.js`, `src/workers/` | Lecture et analyse des fichiers tabulaires hors du fil d’affichage |
| `src/import-limits.js`                  | Limites de taille et de lignes                                     |
| `src/*-data.js`, `src/*-csv.js`         | Adaptateurs, validation et calculs métier                          |
| `src/local-source-storage.js`           | Stockage local ; écritures et suppressions sérialisées             |
| `src/view-preferences.js`               | Préférences restaurées avec validation                             |
| `src/styles.css`                        | Styles, composants, thèmes et règles responsive consolidés         |
| `tests/`, `e2e/`                        | Tests unitaires et tests navigateur                                |

Les pages et graphiques sont chargés à la demande. Le centre de sources ne charge pas la bibliothèque de graphiques. Les palettes sont adaptées aux thèmes clair et sombre ; les animations des séries sont désactivées pour des mises à jour immédiates et stables.

## Marque et documentation des sources

Le logo transparent est conservé dans `src/assets/solen-digital-transparent.png`. L’original et les notes d’édition sont conservés à côté. Le site utilise une version WebP sans perte ; `npm run assets:logo` la régénère et vérifie que les pixels et la transparence sont identiques au PNG. Pour une version vectorielle officielle, utiliser un fichier fourni ou approuvé par Solen Digital ; ne pas considérer une vectorisation automatique comme un original de marque approuvé.

La police Manrope est hébergée localement en WOFF2 ; sa licence est incluse dans `src/assets/Manrope-LICENSE.txt`.

Les contrats de données détaillés sont dans :

- [Contrat commercial](docs/commercial-data-contract.md)
- [Contrat étudiants et échéances](docs/tuition-data-contract.md)
- [Dictionnaire des données de démonstration](docs/data-dictionary.md)
- [Publication GitHub Pages et données locales](docs/github-pages-and-local-data.md)

Les guides Looker Studio présents dans `docs/` documentent le prototype historique ; ils ne décrivent pas un connecteur cloud actif dans cette application.

Les classeurs sont lus localement avec [SheetJS CE](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), chargé uniquement à l’import d’un classeur dans le Worker. Aucun fichier n’est envoyé à un serveur.

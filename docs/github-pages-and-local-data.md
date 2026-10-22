# Hébergement GitHub Pages et conservation des imports

## Import de la synthèse dans « Relances à traiter »

Le bouton de cette page importe la synthèse financière agrégée (Source C), et non un CSV d’avis commerciaux. Le fichier `Dashboard_Suivi_Paiements_Scolarite_LU_2026_2027_filieres 2(DASHBOARD).csv` est reconnu par l’import financier existant : séparateur point-virgule, préambule avant les tableaux, synthèse des statuts, détail mensuel et détail par filière.

La page affiche le comptage de statut fourni par le fichier et les restes par filière. Elle ne peut pas créer une liste de personnes à relancer : cette synthèse ne contient pas de dossiers individuels. Pour les actions nominatives et échéances détaillées, charger aussi Source A (étudiants) et Source B (échéancier) sur « Référentiels & paramètres ». Les sources agrégées et détaillées restent séparées; aucun montant n’est additionné entre elles.

Les périodes Source C ne contiennent pas de dates complètes. Le filtre de dates commerciales ne modifie donc pas les agrégats mensuels ou par filière.

## Conservation des imports

Après sélection locale, l’application conserve les données parsées de ces sources dans IndexedDB : avis commerciaux, synthèse financière et fichiers tuition A, B et D. Le navigateur restaure les sources au prochain chargement et après fermeture/réouverture, dans le même profil de navigateur et sur la même origine du site. Les remplacements restent indépendants. Les identités et contenus de fichiers ne sont pas stockés dans `localStorage`, ajoutés au build ou envoyés au serveur.

Pour relire automatiquement les modifications du CSV financier Source C, utilisez **Lier un CSV pour actualisation auto** sur la page Relances. Dans Chrome ou Edge sur HTTPS (y compris GitHub Pages), choisissez le fichier et autorisez l’accès en lecture. Le dashboard contrôle le fichier toutes les 30 secondes lorsque l’onglet est actif, ainsi qu’au retour sur l’onglet. À chaque ouverture, il tente de relire le fichier mémorisé; si le navigateur redemande l’autorisation, cliquez sur **Réautoriser le fichier lié**. Les contrôles détectent les changements de taille ou d’heure de modification. L’import classique reste disponible pour les navigateurs non compatibles, mais lui ne surveille pas les changements.

Un fichier présent dans un dossier synchronisé par **Google Drive pour ordinateur** peut être lié de la même façon; l’application lira les modifications une fois que Drive les aura synchronisées sur cet appareil. Un CSV qui existe uniquement dans le Drive Web privé n’est pas encore connecté directement : cela demande une authentification Google OAuth configurée pour le domaine GitHub Pages et l’autorisation du responsable commercial. Ne rendez pas le fichier public ou publiquement téléchargeable pour contourner cette configuration.

Cette conservation est locale à l’appareil et au profil de navigateur : elle ne synchronise pas les fichiers vers un autre ordinateur ou navigateur. IndexedDB n’est pas chiffré par l’application. Sur un ordinateur partagé, protégez votre session utilisateur et utilisez « Référentiels & paramètres » → « Effacer les imports enregistrés » avant de quitter le poste. Effacer les données du site dans le navigateur supprimera aussi les imports sauvegardés.

## Publication GitHub Pages

Le build utilise des chemins d’assets relatifs afin de fonctionner sur une adresse GitHub Pages de projet. Le workflow `.github/workflows/pages.yml` lance les tests et le build à chaque push vers `main` ou `master`, puis publie `dist/` via GitHub Actions.

1. Vérifier avant le commit que seuls les fichiers de code, documentation et le CSV synthétique fictif sont suivis. Les exports CSV sont exclus par `.gitignore` à l’exception de `data/merchant_feedback_synthetic.csv`.
2. Pousser le dépôt vers GitHub sur `main` ou `master`.
3. Dans **Settings → Pages**, choisir **GitHub Actions** comme source de déploiement.
4. Attendre la réussite du workflow **Build and deploy dashboard to GitHub Pages** et ouvrir l’URL fournie par GitHub.
5. Importer le fichier financier depuis l’ordinateur du responsable commercial dans la page « Relances à traiter ».
6. Recharger la page et vérifier que le badge financier, le comptage agrégé et le tableau par filière sont toujours présents.

GitHub Pages héberge uniquement le code compilé et les données fictives de développement. Les fichiers sélectionnés localement restent dans IndexedDB du navigateur de chaque utilisateur. Ne jamais ajouter un CSV réel à GitHub : tout fichier commité dans un dépôt ou un site Pages peut devenir accessible publiquement.

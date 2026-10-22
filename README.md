# Tableau de bord des retours commerÃ§ants

Base de dÃ©veloppement indÃ©pendante pour prÃ©parer un tableau de bord Looker Studio Ã  partir d'une feuille Google Sheets. Le dÃ©pÃ´t contient uniquement le jeu synthÃ©tique. Un profil structurel en lecture seule du CSV local confidentiel a Ã©tÃ© effectuÃ© Ã  la demande du propriÃ©taire; le fichier et ses enregistrements restent hors du dÃ©pÃ´t, ne sont pas utilisÃ©s comme donnÃ©es d'application et ne sont pas envoyÃ©s Ã  un service externe.

## Architecture cible

```text
Google Sheets (jeu fictif en dÃ©veloppement, feuille privÃ©e du responsable en production)
                         â†“
                   Looker Studio
                         â†“
             Tableau de bord des retours
```

Looker Studio calculera les indicateurs et graphiques Ã  partir de la source tabulaire. Google Sheets/Looker Studio fournit une actualisation selon les paramÃ¨tres de fraÃ®cheur et de cache du connecteur; ce n'est pas un flux en temps rÃ©el seconde par seconde.

## Contenu du projet

- `data/merchant_feedback_synthetic.csv`: 720 lignes gÃ©nÃ©rÃ©es indÃ©pendamment, avec les 16 en-tÃªtes connus.
- `scripts/generate_synthetic_data.py`: gÃ©nÃ©ration reproductible de donnÃ©es fictives, sans dÃ©pendance externe.
- `scripts/validate_synthetic_data.py`: validation de la structure, des dates, des champs dÃ©rivÃ©s et du caractÃ¨re synthÃ©tique.
- `scripts/profile_synthetic_data.py`: rapport agrÃ©gÃ© sur les seules donnÃ©es fictives (aucun commentaire ou nom individuel affichÃ©).
- `scripts/profile_local_source.py`: outil local optionnel qui examine un CSV fourni explicitement et n'imprime que les en-tÃªtes et statistiques agrÃ©gÃ©es; il ne copie ni ne modifie le fichier.
- `docs/data-dictionary.md`: types, interprÃ©tations, confiance et champs non rÃ©solus.
- `docs/dashboard-spec.md`: KPI, graphiques et filtres proposÃ©s.
- `docs/google-sheets-looker-studio.md`: import, configuration de la source et transfert au responsable commercial.
- `docs/looker-studio-build-guide.md`: procÃ©dure manuelle complÃ¨te pour crÃ©er la feuille et le prototype Looker Studio avec le jeu fictif.

## GÃ©nÃ©rer et valider

Python 3.10+ est requis; aucune installation de paquet n'est nÃ©cessaire.

```powershell
python scripts/generate_synthetic_data.py
python scripts/validate_synthetic_data.py
python scripts/profile_synthetic_data.py
```

Pour gÃ©nÃ©rer un autre volume reproductible dans la plage prÃ©vue:

```powershell
python scripts/generate_synthetic_data.py --rows 850 --seed 20261008
```

Le gÃ©nÃ©rateur synthÃ©tique n'ouvre aucun fichier d'entrÃ©e. Il construit chaque ligne Ã  partir de listes et de rÃ¨gles fictives codÃ©es dans le script. Le profil local exige un argument `--source`, ne s'exÃ©cute pas automatiquement et n'Ã©crit aucun rÃ©sultat dans le dÃ©pÃ´t.

Profil structurel facultatif sur une copie locale autorisÃ©e (sortie limitÃ©e aux en-tÃªtes et agrÃ©gats, jamais aux valeurs):

```powershell
python scripts/profile_local_source.py --source "<chemin-local-du-CSV>"
```

Le CSV utilise UTF-8 avec BOM et une virgule comme sÃ©parateur. Il peut Ãªtre importÃ© dans Google Sheets via **Fichier â†’ Importer**; choisir la virgule ou vÃ©rifier la dÃ©tection automatique du sÃ©parateur. Les dates utilisent `AAAA-MM-JJ HH:MM:SS`; les colonnes entiÃ¨res restent numÃ©riques et les commentaires absents sont des cellules vides. Voir `docs/google-sheets-looker-studio.md` pour la configuration.

## ConfidentialitÃ©

- N'ajoutez jamais un export confidentiel Ã  ce projet, Ã  Git, Ã  une capture d'Ã©cran ou Ã  un outil externe.
- Le CSV rÃ©el reste sur l'ordinateur autorisÃ©; seuls son schÃ©ma et des agrÃ©gats non identifiants ont Ã©tÃ© inspectÃ©s localement. Aucun commentaire, nom ou enregistrement rÃ©el n'est conservÃ© dans le projet.
- En production, le responsable commercial garde le contrÃ´le de sa feuille et de son rapport privÃ©s. Le dÃ©veloppeur ne reÃ§oit pas la source rÃ©elle.
- Les noms, commentaires, rÃ©gions, catÃ©gories et responsables du CSV de dÃ©veloppement sont fictifs.
- Les champs dont le sens n'est pas confirmÃ© restent explicitement non interprÃ©tÃ©s; `LIB_AVIS` n'est pas traitÃ© comme une note numÃ©rique.

## Ã‰tat et limites

Le schÃ©ma de la source est connu, mais pas la signification mÃ©tier de plusieurs colonnes. Aucun champ de note numÃ©rique n'a Ã©tÃ© identifiÃ©. **La note moyenne ne peut donc pas Ãªtre implÃ©mentÃ©e de faÃ§on fiable** avant confirmation du propriÃ©taire des donnÃ©es. Voir les documents de `docs/` avant de configurer Looker Studio.

## Local dashboard

The project includes a local React/Vite application. The **Retours commerçants** page reads `data/merchant_feedback_synthetic.csv` and retains its KPIs, trends, comparisons, filters, and recent-comments table. The commercial pages (overview, candidate pipeline, revenue/enrollments, follow-ups, and report) are implemented, but the current 16-column source lacks the required commercial data. Those KPIs display as unavailable, not zero or sample results.

Node.js 20.19+ or 22.12+ is required. From the project root:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`). Reload the development page after changing the synthetic CSV. No remote-source refresh is configured.

### Import a local commercial CSV

Use **Importer mon CSV** in the dashboard header to select a `.csv` file from the computer. The browser reads it locally with PapaParse, using a semicolon delimiter and Windows-1252 decoding. Required headers are `IDENTITE_LEAD`, `DATE_AVIS`, `LIB_AVIS`, `RESPONSABLE`, `LIB_SOURCE_LEAD`, `EST_CLASSER`, `LIB_ETABLISSEMENT`, and `LIB_REGION`. `ANNEE_LEAD`, `MOIS_LEAD`, and `COMMENTAIRE_LEAD_AVIS` are mapped when present; other columns are ignored. Dates in ISO (`YYYY-MM-DD[ HH:mm:ss]`) or French (`DD/MM/YYYY[ HH:mm:ss]`) form are recognized; invalid dates are counted and omitted from date-based charts. Confirm the resulting totals/date range against the source before relying on the report.

An imported file replaces the synthetic source in the overview and feedback pages and restores after a refresh from this browser profile. The parsed CSV remains local and is not sent to an external service or bundled in the site. `IDENTITE_LEAD` is used only to count distinct nonblank candidate references; it is not rendered or included in exports. `LIB_AVIS` remains a raw value and is counted by CSV row, not interpreted as a rating or confirmed candidate status. Revenues, payments, targets, enrollments, and overdue follow-ups remain unavailable because the imported schema does not establish those metrics.

### Import a separate financial CSV

The **Revenus & inscriptions** page has its own **Importer le fichier financier** action. No financial schema is assumed. The page first discovers the selected CSV headers, then lets the user map optional columns to amount, payment date/status/reference, enrollment id/date/status, payment method, establishment, and region. The preview shows only header names and aggregate counts of populated/blank cells; it does not display sample rows or personal/banking values. The file is parsed locally with semicolon delimiters and Windows-1252 decoding and is stored locally in this browser profile.

The mapped **Montant total enregistré** is the sum across valid CSV rows and includes all mapped payment statuses; it is not labeled as collected revenue and repeated rows/references are not silently deduplicated. **Revenus encaissés confirmés** remains unavailable until both amount and payment status are mapped and the user explicitly checks the status values confirmed by the data owner as collected. Currency is not inferred, so amounts are displayed without a currency symbol and marked as needing confirmation. Distinct payment count requires a mapped payment reference. Distinct enrollment count requires a mapped enrollment identifier. No targets, revenue forecasts, or synthetic finance rows are created. Unmapped and invalid values remain unavailable and are reported as aggregate quality counts.

The financial CSV reader supports UTF-8, Windows-1252, and BOM-marked UTF-16 CSVs with semicolon delimiters. Dates accept ISO and French day/month/year forms; the dashboard validates calendar dates and numeric amounts before aggregating. The financial and commercial imports have independent in-memory rows, filename metadata, errors, and source indicators. Importing or replacing one does not reset the other or change the selected page. Both datasets are kept in IndexedDB on this device and browser profile and restored after a full page refresh. They are not synchronized to other devices or sent to a server. A selected global date period filters financial metrics by the mapped payment date; if that field is absent, metrics are withheld rather than shown unfiltered. Missing/invalid payment dates are excluded from a bounded period. The Source C summary file has now been structurally parsed locally: semicolon delimiter, 10 preamble rows, 11 monthly details, 10 program details, and one excluded general-total row in each table. No student-level or payment-ledger records are inferred from this aggregate file.

The UI uses a responsive navy navigation rail, light neutral workspace, refined KPI cards, accessible focus states, and responsive chart/table panels. The overview and report continue to consume commercial data; financial results remain on the independent Revenus & inscriptions page and are never combined with commercial feedback counts.

Run application checks and build a static bundle with:

```powershell
npm test
npm run build
npm run preview
```

The Python data checks remain available against the same fictional CSV:

```powershell
python scripts/validate_synthetic_data.py
python scripts/profile_synthetic_data.py
```

`dist/` and npm dependencies are local build artifacts ignored by Git. See `docs/looker-studio-build-guide.md` for the synthetic cloud prototype and future handoff steps.

## Commercial data and metric limits

## Local tuition and enrollment sources

The financial area supports four independent local sources described in [`docs/tuition-data-contract.md`](docs/tuition-data-contract.md): A (students), B (installment schedule), C (aggregate financial summary, through the existing financial CSV import), and D (reference lists). Import them separately from the financial navigation or the **Référentiels & paramètres** page. Imported rows are persisted locally in IndexedDB for this device and browser profile; they are not synchronized or sent to a server.

The student and schedule pages auto-map the documented French headers and allow manual column mapping. Source A counts distinct student IDs, falling back to matricule; it never treats input rows as distinct enrollments. Source B requires an installment ID for a distinct-installment KPI. Repeated student/installment IDs suspend affected monetary sums instead of double-counting them. Source D supplies the Formation, Campus, academic-year, payment-method and installment-status filters; **Modes de paiement** and **Modes règlement** are separate fields.

The financial period is independent from the commercial feedback period. In student views it filters the next-due date; in schedule views it filters the due date. Missing/invalid dates are excluded from a bounded period. The aggregate Source C report has month labels but no complete dates, so it uses the existing month/program filters. Monthly and program totals remain independent; detected differences are shown for review and are never auto-adjusted. `Total à payer - Total payé` and `Montant prévu - Montant payé` are used for student/installment remaining balances only when both operands are valid; source remaining amounts are retained for discrepancy checks.

The aggregate CSV is the only tuition-related CSV currently identifiable in Downloads. The described A, B and D files were not present, so their real schemas, values, statuses and data quality still require local validation by selecting the owner's files in the browser. Tests use fictional fixtures only. See the data contract for interpretation limits and reconciliation steps.

The application does not infer candidate, enrollment, payment, or follow-up meaning from `IDENTITE_LEAD`, `RESPONSABLE`, `EST_CLASSER`, `LIB_AVIS`, or any other feedback column. The required future normalized tables and field definitions are documented in [`docs/commercial-data-contract.md`](docs/commercial-data-contract.md). Source status values require an explicit approved display mapping; no mappings are included because no commercial statuses are present in the synthetic feedback source.

An authorized adapter may provide a normalized JSON bundle at `VITE_COMMERCIAL_BUNDLE_URL` when starting/building the app. The app fetches this bundle once when the page loads, validates its schema, and uses no embedded credentials. This is a connection hook only; the project currently contains no commercial endpoint, refresh schedule, or production integration. Configure it only after authorization. Revenue requires distinct payment IDs, an explicit collected-status list, numeric amounts, and one confirmed currency. Tunisian dinar formatting appears only when `TND` is configured. Full-month targets are compared only for months fully included in the selected date range.

## Supported metrics today

- **Supported with the existing synthetic source:** feedback count, distinct establishment and region values, feedback with comments, comment coverage, daily/monthly feedback volume, and distributions by raw feedback category, establishment, and region.
- **Implemented in the commercial adapter, awaiting source fields:** distinct commercial activities, confirmed enrollment count, collected revenue, objective achievement/remaining target, monthly revenue and enrollment trends, specialty/study-level breakdowns, conversion between configured historical stages, post-enrollment activity count, and overdue follow-up files.
- **Unavailable until connected data is supplied:** every commercial KPI above. There are no actual business values in the current dashboard.

The printable report uses the browser print dialog; no PDF generation service is added. CSV export is available for supported feedback comments and, when commercial data is configured, the applicable normalized tables. See the contract document for deduplication, partial-payment, period, and overdue definitions.



## GitHub Pages et persistance locale

La page **Relances à traiter** propose l'import de la synthèse financière agrégée Source C. Elle affiche le comptage source des statuts et les restes par filière, mais ne peut pas produire de dossiers individuels à relancer sans Sources A (étudiants) et B (échéancier). Les montants C restent séparés des données détaillées.

Les sources importées sont conservées dans IndexedDB et restaurées sur le même appareil, dans le même profil de navigateur et sur la même origine du site. Ce stockage n'est pas chiffré par l'application. La page **Référentiels & paramètres** contient l'action **Effacer les imports enregistrés**. Ne pas utiliser cette conservation comme synchronisation entre appareils.

Le site est prêt pour GitHub Pages avec des chemins de build relatifs et le workflow .github/workflows/pages.yml. Dans **Settings → Pages**, sélectionner **GitHub Actions**. Seul le code et le jeu synthétique doivent être poussés; les CSV commerciaux/financiers réels sont exclus du dépôt et restent dans le navigateur après import.

### Actualisation automatique locale

Sur Chrome/Edge en contexte HTTPS, **Lier un CSV pour actualisation auto** sur « Relances à traiter » mémorise un accès en lecture au CSV Source C dans IndexedDB. Le dashboard vérifie le fichier lié toutes les 30 secondes tant que l’onglet est actif, et le relit à la réouverture. Si le navigateur redemande l’autorisation, cliquez sur **Réautoriser le fichier lié**. Un CSV dans un dossier Google Drive pour ordinateur synchronisé fonctionne après la synchronisation locale. Un fichier Drive Web privé n’est pas lu directement : cela demande une intégration OAuth Google configurée pour le domaine Pages. L’import classique n’actualise pas les changements.

La surveillance locale ne fonctionne pas lorsque le navigateur ou l’ordinateur est fermé; le dashboard reprend alors le fichier courant à la prochaine ouverture. Elle ne synchronise pas les sources vers d’autres appareils. IndexedDB n’est pas chiffré par l’application. GitHub Pages sert uniquement les fichiers du build, sans envoyer les imports au serveur.

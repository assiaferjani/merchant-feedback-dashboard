# Contrat de données commerciales

## Source actuelle et limites

Le CSV fictif existant possède 16 champs consacrés aux retours commerçants: dates, `LIB_AVIS`, commentaire, établissement candidat, région et champs temporels. `IDENTITE_LEAD`, `RESPONSABLE`, `EST_CLASSER`, `LIB_AVIS` et `LIB_ETABLISSEMENT` restent de sens non confirmé. Le fichier n’a pas été remplacé ou enrichi.

Il n’existe dans ce schéma aucun champ confirmé pour les activités commerciales, les statuts candidats, les rendez-vous, les inscriptions, les paiements, les objectifs, les spécialités, les niveaux d’étude, les échéances ou la clôture des relances. Les pages commerciales affichent ces mesures comme indisponibles; aucun chiffre fictif n’est présenté comme résultat métier. La page « Retours commerçants » continue d’utiliser uniquement le CSV synthétique.

## Contrat d’intégration futur

L’adaptateur attend un bundle JSON normalisé contenant chacune des tables ci-dessous sous forme de tableau, même quand une table ne comporte aucune ligne. Ces colonnes sont des exigences d’intégration à mapper au logiciel commercial après confirmation du propriétaire; elles ne sont pas présentes dans la source actuelle.

| Table | Champs attendus | Règle |
|---|---|---|
| `candidates` | `candidate_id`, `created_at`, `current_status`, `specialty`, `study_level`, `salesperson` | Une ligne par dossier; identifiant pseudonymisé stable. Le statut courant n’est pas un événement. |
| `activities` | `activity_id`, `candidate_id`, `activity_date`, `activity_type` | Un identifiant unique par activité. Ne pas additionner les états candidats comme des activités. |
| `pipeline_events` | `event_id`, `candidate_id`, `event_date`, `status` | Historique horodaté des changements; nécessaire aux taux de conversion. |
| `appointments` | `appointment_id`, `candidate_id`, `appointment_date`, `appointment_status`, `salesperson`, `completed_at` | Les valeurs considérées comme « en attente » nécessitent une configuration explicite. |
| `enrollments` | `enrollment_id`, `candidate_id`, `enrollment_date`, `enrollment_status`, `specialty`, `study_level` | Une ligne par inscription; statut confirmé configuré explicitement. |
| `payments` | `payment_id`, `candidate_id`, `payment_date`, `amount`, `payment_status`, `currency`, `specialty`, `study_level` | Une ligne par transaction ou versement; chaque versement partiel a son propre identifiant. |
| `contracts` | `contract_id`, `candidate_id`, `contract_date`, `contract_amount`, `contract_status`, `currency`, `specialty`, `study_level` | Source séparée des encaissements, statut contractuel configuré. |
| `forecasts` | `forecast_id`, `candidate_id`, `forecast_date`, `amount`, `forecast_status`, `currency`, `specialty`, `study_level` | Prévisions distinctes des contrats et paiements, statut configuré. |
| `targets` | `target_month`, `revenue_target`, `enrollment_target` | Une ligne par mois `AAAA-MM`; objectif revenu dans la devise configurée. |
| `followups` | `task_id`, `candidate_id`, `specialty`, `study_level`, `current_status`, `last_activity_at`, `next_action`, `due_date`, `salesperson`, `completed_at` | Une ligne par tâche; échéance explicite, fin vide si ouverte. |

Dates: ISO 8601 (`AAAA-MM-JJ` ou date/heure ISO). Montants: nombres non formatés. `candidate_id`: référence pseudonymisée, jamais un nom ou une donnée personnelle. Les commentaires libres ne sont pas nécessaires aux mesures commerciales et sont exclus de ce contrat.

Forme attendue, vide et sans données d’exemple:

```json
{
  "config": {
    "currency": "",
    "status_labels": {},
    "collected_payment_statuses": [],
    "contracted_revenue_statuses": [],
    "forecast_revenue_statuses": [],
    "confirmed_enrollment_statuses": [],
    "pending_appointment_statuses": [],
    "conversion_stages": []
  },
  "candidates": [],
  "activities": [],
  "pipeline_events": [],
  "appointments": [],
  "enrollments": [],
  "payments": [],
  "contracts": [],
  "forecasts": [],
  "targets": [],
  "followups": []
}
```

## Configuration métier obligatoire

- `config.status_labels`: correspondance explicite entre valeur brute du logiciel et libellé français. Aucun statut n’est prérempli, car le jeu existant ne contient aucun statut commercial.
- `collected_payment_statuses`, `contracted_revenue_statuses`, `forecast_revenue_statuses`, `confirmed_enrollment_statuses` et `pending_appointment_statuses`: listes non vides des valeurs source confirmées par le propriétaire. Une liste absente ou vide rend la mesure correspondante indisponible; elle ne devient pas zéro.
- `conversion_stages`: paires `{ "from": "<statut confirmé>", "to": "<statut confirmé>" }`. Les taux utilisent des transitions historiques, pas la seule photographie des statuts actuels.
- `currency`: code ISO 4217 confirmé et homogène. Le format DT s’affiche uniquement lorsque `TND` est confirmé. Les paiements, contrats, prévisions et objectifs ne sont jamais additionnés dans un total ambigu.
- Les libellés de `specialty`, `study_level`, `salesperson`, `activity_type` et `next_action` restent des dimensions brutes, sans regroupement inventé.

## Définitions calculées

- **Activités commerciales**: nombre d’`activity_id` distincts datés dans la période.
- **Revenus encaissés**: somme des transactions uniques dont le statut figure dans `collected_payment_statuses`. Les versements partiels distincts s’additionnent; un identifiant dupliqué ne compte qu’une fois. Les paiements en attente sont exclus.
- **Revenus contractés et prévisionnels**: calculés séparément depuis `contracts` et `forecasts` uniquement après configuration des statuts correspondants.
- **Inscriptions confirmées**: nombre d’`enrollment_id` distincts dont le statut source est configuré comme confirmé.
- **Objectif atteint et restant**: comparaison avec les objectifs des mois complets compris dans la période; une sélection partielle de mois n’est pas comparée à l’objectif mensuel complet.
- **Conversions**: candidats distincts entrés dans l’étape initiale pendant la période et ayant atteint l’étape cible ensuite, selon l’historique disponible.
- **Activités après inscription**: activités datées après la date d’inscription confirmée du candidat. Une classification de suivi post-inscription plus précise nécessitera un type d’activité confirmé.
- **Dossier en retard**: tâche dont `due_date` précède la date d’analyse et qui n’est pas terminée à cette date. Une tâche terminée après la date d’analyse était encore ouverte au moment du rapport.

Les doublons d’identifiants, dates invalides et montants non numériques produisent des avertissements; les identifiants dupliqués sont comptés une seule fois, et les lignes invalides sont exclues des calculs concernés. Vérifier les avertissements avant tout usage commercial.

## Connexion future et confidentialité

Après autorisation, un convertisseur du logiciel commercial ou de ses CSV peut produire ce bundle normalisé. L’application peut charger une URL JSON configurée par `VITE_COMMERCIAL_BUNDLE_URL`; elle la lit au chargement de la page et n’intègre aucun identifiant ou secret. Aucun endpoint ni rafraîchissement périodique n’est configuré dans le projet. Toute connexion future doit être vérifiée avec des données synthétiques avant l’utilisation par le responsable commercial. Le développeur ne doit pas recevoir la source privée sans autorisation distincte.

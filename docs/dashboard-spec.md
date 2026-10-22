# Looker Studio Dashboard Specification

This specification describes a synthetic-data prototype. The available schema confirms no numeric rating field. Keep unresolved source fields as raw dimensions and do not infer sentiment or satisfaction from them.

## Header

**Title:** Merchant Feedback Dashboard  
**Subtitle:** Synthetic development environment — production source not connected

The prototype should use a clean, restrained business layout with readable labels and consistent spacing. Include the subtitle while the report uses synthetic data; remove or replace it only in the commercial manager's private copy after the data source is changed.

## Business questions

The dashboard should answer:

- How much feedback is being received?
- How does feedback volume change over time?
- Which establishments receive the most feedback? (`LIB_ETABLISSEMENT` meaning remains to be confirmed.)
- How is feedback distributed across raw `LIB_AVIS` values?
- Which regions have the most recorded feedback?
- How many feedback records contain comments, and what share is that?
- What are the most recent written comments?

It cannot yet answer:

- What is the average rating?
- Which merchant has the best or worst rating?
- What is the average satisfaction score?

Those questions require a confirmed numeric rating/satisfaction field and documented interpretation.

## Filter bar

Place these controls directly below the header and apply them consistently to relevant charts and KPIs:

1. **Establishment (`LIB_ETABLISSEMENT`)** — raw establishment candidate; meaning to be confirmed.
2. **Region (`LIB_REGION`)** — use as a raw region dimension.
3. **Feedback category (`LIB_AVIS`)** — raw text/category; not a rating scale.
4. **Date range (`DATE_AVIS`)** — date/time range control.

## KPI row

Use five scorecards. Show integer counts except coverage, which is a percentage.

| KPI label | Looker Studio calculation | Field |
|---|---|---|
| Total Feedback | Record Count | Record count |
| Distinct Establishments | Count Distinct | `LIB_ETABLISSEMENT` |
| Distinct Regions | Count Distinct | `LIB_REGION` |
| Feedback With Comments | Count rows with nonblank comment | `COMMENTAIRE_LEAD_AVIS` |
| Comment Coverage % | Feedback With Comments / Total Feedback | Calculated from the preceding counts |

Treat blanks in comments as missing text, not as missing feedback. If the filtered total is zero, show a blank or no-data state for the percentage rather than dividing by zero. Establishment/region counts are based on those fields as currently named; confirm their business meaning before production use.

**Do not add Average Rating.** No numeric rating field has been confirmed.

## Main visualizations

| Chart | Dimension | Metric | Configuration and purpose |
|---|---|---|---|
| Feedback Volume Over Time | `DATE_AVIS` | Record Count | Time series at daily granularity; chronological ascending axis. Shows short-term volume change. |
| Feedback by Establishment | `LIB_ETABLISSEMENT` | Record Count | Horizontal bar chart, descending count; show a manageable number of establishments and retain filtering/search for larger sources. Field meaning to be confirmed. |
| Feedback by Category | `LIB_AVIS` | Record Count | Bar chart, descending count; label the dimension as raw feedback category. Do not imply score or sentiment. |
| Feedback by Region | `LIB_REGION` | Record Count | Bar chart, descending count. |
| Monthly Feedback Trend | `DATE_AVIS` at Year Month granularity | Record Count | Chronological monthly trend. Use the date's built-in month granularity. Do not use source `ANNEE_MOIS` as a fallback until its meaning is confirmed; in the inspected local extract it does not match `DATE_AVIS` formatted as `AAAAMM`. |

The daily and monthly time series serve different time scales. Keep the daily chart visually compact if the monthly trend is the primary management view.

## Recent feedback table

Include these fields in this order:

1. `DATE_AVIS`
2. `LIB_ETABLISSEMENT`
3. `LIB_AVIS`
4. `COMMENTAIRE_LEAD_AVIS`

Sort by `DATE_AVIS` descending. Add a chart-level filter excluding blank `COMMENTAIRE_LEAD_AVIS` so every displayed row contains written text. Use a readable date/time format and allow the comment column to wrap. Do not add sentiment analysis or sentiment scores.

## Optional raw classification

If `EST_CLASSER` is shown, use the exact title **Classification (meaning to be confirmed)**. Show counts by raw value only. Do not label it sentiment, priority, severity, or another interpretation until the data owner confirms the field definition.

## Empty states, interaction, and freshness

- Use a clear no-data message when the selected filters return no rows.
- Verify all four filters against the scorecards, charts, and table.
- Keep dates in chronological order and establishment/category/region bars in descending record count.
- Configure freshness according to the Google Sheets connector and state the expected refresh behavior. This setup is not second-by-second streaming.
- Test the report with the synthetic sheet before any private copy is connected.

## Future Rating Integration

A numeric rating field has not been identified. If the data owner confirms that `LIB_AVIS` represents a rating category, document the exact category-to-number mapping and its evidence before implementing an average. If the real source contains a separate rating field, use that confirmed field instead.

Potential future extension (not part of the current 16-column synthetic schema):

- Field: `RATING_AVIS`
- Type: Number
- Expected range: 1–5

Do not add this field to the current synthetic dataset or infer it from category labels.

## Local extract validation notes

The current local extract was profiled in place and was not copied into the project. It contains 2,065 structurally valid rows and has no numeric rating field. `LIB_AVIS` is text with 11 distinct values; keep it as a raw text dimension/filter. `DATE_AVIS`, `ANNEE_AVIS`, `MOIS_AVIS`, and `SEMAINE_AVIS` agree for year, month, and ISO week across the extract. Prefer `DATE_AVIS` for both daily and monthly time series.

The extract has one distinct `LIB_ETABLISSEMENT` value, so it cannot validate an establishment comparison chart. The synthetic dataset retains 12 fictional establishments to exercise that visualization. `EST_CLASSER` has one distinct value in this extract, so omit the optional classification breakdown unless a broader source and confirmed definition make it useful. The local extract has 19 distinct `LIB_REGION` values. These are aggregate counts only; no field values are reproduced here.

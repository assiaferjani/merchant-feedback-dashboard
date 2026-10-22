# Google Sheets and Looker Studio Handoff

## Local CSV extract versus synthetic test source

The local real CSV extract was used only for a read-only schema and aggregate-structure check. It is outside this project and is not the dashboard's application data. The local extract is Windows-1252 and semicolon-delimited; the development CSV is fictional, UTF-8 with BOM, and comma-delimited. Keep using the synthetic CSV for repeatable dashboard tests. Do not copy the real extract into the project or send it to the developer or an external service.

The local extract is a snapshot. A local CSV file changing on the commercial manager's PC does not by itself update a Google Sheet or Looker Studio report. For a future continuously updated source, the manager must either maintain the private Google Sheet directly or configure an approved process in their own environment to refresh it from the authoritative source. Looker Studio then reads that Sheet according to the connector's configured freshness. No such refresh process is configured or tested in this project.

If the commercial manager privately imports a future export with the same observed file format, select semicolon as the delimiter and preserve/decode Windows-1252 correctly. Verify the format of each new export rather than assuming it remains identical. This project does not convert or stage the real file.

## Synthetic Google Sheet import

The recommended development source is `data/merchant_feedback_synthetic.csv`. It is a UTF-8 CSV with a byte-order mark, a comma delimiter, one header row, 16 columns, and one feedback record per following row. CSV quoting preserves commas or other punctuation inside text fields. There are no title/decorative rows, merged cells, subtotals, or manual totals.

In Google Sheets, create a blank test spreadsheet and use **File → Import → Upload** to import the CSV into a new sheet named `Retours`. Select comma as the separator (or automatic separator detection and verify it chose comma). Use the first row as headers. Confirm that `DATE_AVIS` parses as date/time, integer helper columns remain numeric, and blank comments remain empty cells. The source dates use `YYYY-MM-DD HH:MM:SS`.

Do not convert the CSV to semicolon-delimited form. Comma is the standard delimiter emitted by the generator; embedded punctuation is quoted according to CSV rules.

Exact source-compatible headers:

`IDENTITE_LEAD`, `ANNEE_LEAD`, `MOIS_LEAD`, `LIB_AVIS`, `DATE_AVIS`, `IdxJours`, `ANNEE_MOIS`, `ANNEE_AVIS`, `MOIS_AVIS`, `RESPONSABLE`, `LIB_SOURCE_LEAD`, `COMMENTAIRE_LEAD_AVIS`, `EST_CLASSER`, `LIB_ETABLISSEMENT`, `SEMAINE_AVIS`, `LIB_REGION`.

## Looker Studio Field Configuration

Connect the Google Sheets `Retours` worksheet and verify the detected types. Use record count as the metric for the table and charts. Text dimensions and filters have no aggregation; count distinct is applied by the relevant scorecards.

| Google Sheets column | Looker Studio field name | Data type | Aggregation | Intended use |
|---|---|---|---|---|
| `DATE_AVIS` | `DATE_AVIS` | Date & Time | None (dimension); Record Count in charts | Date-range control, daily time series, monthly time series, recent table sort |
| `LIB_ETABLISSEMENT` | `LIB_ETABLISSEMENT` | Text | None (dimension/filter); Count Distinct in KPI | Establishment candidate filter and chart; confirm meaning |
| `LIB_REGION` | `LIB_REGION` | Text | None (dimension/filter); Count Distinct in KPI | Region filter and volume chart |
| `LIB_AVIS` | `LIB_AVIS` | Text | None (dimension/filter) | Raw feedback-category filter and distribution; not a rating |
| `COMMENTAIRE_LEAD_AVIS` | `COMMENTAIRE_LEAD_AVIS` | Text | None; use nonblank condition for count/table filter | Comment count, coverage calculation, recent-feedback table |
| `ANNEE_MOIS` | `ANNEE_MOIS` | Number (integer) | None (dimension) | Do not use for date grouping until its source meaning is confirmed; it did not match `DATE_AVIS` as `AAAAMM` in the inspected local extract |
| `ANNEE_AVIS` | `ANNEE_AVIS` | Number (integer) | None | Not required by the proposed dashboard; prefer `DATE_AVIS` for date filters/trends |
| `MOIS_AVIS` | `MOIS_AVIS` | Number (integer) | None | Not required; using alone loses year context. Prefer `DATE_AVIS` month granularity |
| `SEMAINE_AVIS` | `SEMAINE_AVIS` | Number (integer) | None | Not required by the initial dashboard; week alone can combine different years |
| `EST_CLASSER` | `EST_CLASSER` | Text | None (dimension) | Optional raw-value breakdown only, titled “Classification (meaning to be confirmed)” |

The other six columns remain in the source to preserve the 16-field structure but are not needed in the initial report. Their meanings are documented in `data-dictionary.md`; do not add them to charts until they have a defined business use.

For **Feedback With Comments**, count rows where `COMMENTAIRE_LEAD_AVIS` is not null/blank. For **Comment Coverage %**, divide that count by Record Count and format as a percentage; handle a zero denominator. Do not aggregate text as a sum or average.

## Build the synthetic report

1. Create a blank Looker Studio report and connect the `Retours` worksheet through the Google Sheets connector.
2. Apply the field configuration above and inspect the detected date/time and integer types.
3. Implement `dashboard-spec.md`: title/subtitle, four filters, five KPIs, five charts, and recent-feedback table.
4. Exclude blank comments only from the recent-feedback table; keep those feedback records in total counts.
5. Test date sorting, filter interactions, blank comments, zero-result states, and a narrow/mobile viewport using only synthetic data.
6. Set freshness expectations based on the connector configuration. Google Sheets/Looker Studio refresh is not second-by-second streaming.

## Handoff and private production source

Workflow:

```text
Developer
  ↓
Synthetic Google Sheet
  ↓
Looker Studio prototype
  ↓
Validated dashboard template
  ↓
Commercial manager makes their own copy
  ↓
Commercial manager connects their private Google Sheet
  ↓
Dashboard operates on private data
```

The developer should not receive access to the production Google Sheet, its records, credentials, or tokens. The commercial manager makes a copy of the validated report under their own account and reconnects that copy to their private source. They should preserve compatible column names or adapt the fields within their private report. Confirm unresolved field semantics and any rating mapping directly with the data owner without sending the private data to the developer.

Keep the development report connected only to the synthetic sheet. Check spreadsheet/report sharing permissions before use. Data freshness follows the connector's configured refresh behavior, not a real-time streaming guarantee.

## Current limitations

- The Looker Studio report and Google Sheet have not yet been created.
- `LIB_AVIS`, `IDENTITE_LEAD`, `LIB_ETABLISSEMENT`, `RESPONSABLE`, `LIB_SOURCE_LEAD`, and `EST_CLASSER` require data-owner confirmation.
- No numeric rating field has been identified; average rating and satisfaction comparisons are not available.
- The synthetic schema is intentionally 16 columns and contains no future `RATING_AVIS` field.

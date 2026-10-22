# Synthetic Google Sheets and Looker Studio Build Guide

This guide builds a test prototype from the fictional CSV only. No Google Sheet or Looker Studio report has been created or connected as part of this project. Do not select or connect a production/private source while following the prototype steps.

The real-data CSV extract is a local snapshot, not the commercial manager's continuously updated source. It remains outside the project and must not be uploaded or copied to a Google service without separate explicit confirmation. Its structural profile is documented in `docs/data-dictionary.md` without raw cell values. The extract is semicolon-delimited and Windows-1252 encoded; this differs from the synthetic test CSV.

## 1. Create the synthetic Google Sheet

1. Open Google Sheets while signed in to the account that will own the test artifact.
2. Create a blank spreadsheet named **Merchant Feedback — Synthetic Test**.
3. Choose **File → Import → Upload** and select `data/merchant_feedback_synthetic.csv` from this project.
4. Import into the blank spreadsheet. Select **Comma** as the separator (or detect automatically and confirm it selected comma). The synthetic CSV is UTF-8 with BOM, has one header row, and uses standard CSV quoting.
5. Name the imported worksheet/tab **Retours**.
6. Confirm row 1 contains the headers and rows 2 onward contain records. There should be 721 total sheet rows: 1 header + 720 synthetic records. Do not add a totals row.
7. Keep the 16 columns and cell values as imported. Do not insert title rows, formulas, totals, subtotals, merged cells, or decorative rows.

Expected headers, in order:

`IDENTITE_LEAD`, `ANNEE_LEAD`, `MOIS_LEAD`, `LIB_AVIS`, `DATE_AVIS`, `IdxJours`, `ANNEE_MOIS`, `ANNEE_AVIS`, `MOIS_AVIS`, `RESPONSABLE`, `LIB_SOURCE_LEAD`, `COMMENTAIRE_LEAD_AVIS`, `EST_CLASSER`, `LIB_ETABLISSEMENT`, `SEMAINE_AVIS`, `LIB_REGION`.

## 2. Expected Google Sheets / Looker Studio types

After import, check the date column formatting in Sheets. In Looker Studio, verify or correct the detected source field types as follows:

| Field | Expected type | Notes |
|---|---|---|
| `IDENTITE_LEAD` | Text | Meaning requires data-owner confirmation |
| `ANNEE_LEAD` | Number | Synthetic temporal placeholder; source meaning unresolved |
| `MOIS_LEAD` | Number | Synthetic temporal placeholder; source meaning unresolved |
| `LIB_AVIS` | Text | Raw category; do not convert to a rating |
| `DATE_AVIS` | Date & Time | Synthetic CSV uses `YYYY-MM-DD HH:MM:SS`; verify Google Sheets and Looker Studio recognize it as a date/time field |
| `IdxJours` | Number | Synthetic day index; source meaning unresolved |
| `ANNEE_MOIS` | Number | In the synthetic file it is an integer key; do not assume the real-source field is `YYYYMM` or use it for grouping until its meaning is confirmed |
| `ANNEE_AVIS` | Number | Prefer `DATE_AVIS` for filtering and trends |
| `MOIS_AVIS` | Number | Prefer `DATE_AVIS`; month alone has no year context |
| `RESPONSABLE` | Text | Meaning requires data-owner confirmation |
| `LIB_SOURCE_LEAD` | Text | Meaning requires data-owner confirmation |
| `COMMENTAIRE_LEAD_AVIS` | Text | Keep as text, including empty cells; do not infer numeric type from a number-shaped comment |
| `EST_CLASSER` | Text | Meaning requires data-owner confirmation |
| `LIB_ETABLISSEMENT` | Text | Establishment candidate; meaning requires confirmation |
| `SEMAINE_AVIS` | Number | Prefer date granularity if a weekly view is later needed |
| `LIB_REGION` | Text | Region dimension in this synthetic example |

All names, comments, and categories in this test source are fictional. Type choices do not resolve the underlying business meaning of an ambiguous column.

### Real extract format: reference only

The locally inspected real-data extract uses a semicolon delimiter (`;`), Windows-1252 encoding, and `DATE_AVIS` timestamps with fractional seconds (`YYYY-MM-DD HH:MM:SS.fffffff`). If the commercial manager later chooses to import a current private export, they must select/verify the semicolon delimiter, preserve the encoding correctly, check date/time parsing, and force `COMMENTAIRE_LEAD_AVIS` to Text. Google Sheets may infer a different type, so verify every field after import. **Do not upload the local extract during this development phase.** The manager's full live source may have a different export format; verify that file privately before building the production connection.

### Establishment comparison limitation

The currently profiled real-data extract has exactly **one distinct `LIB_ETABLISSEMENT` value**. It therefore cannot validate establishment comparisons or a multi-establishment breakdown. Use the synthetic test sheet, which has 12 fictional establishments, to test the chart, distinct-establishment KPI, and establishment filter. The real extract's one-value observation does not prove the complete manager dataset has only one establishment.

## 3. Create the Looker Studio data source

1. Open Looker Studio and create a new report named **Merchant Feedback Dashboard — Synthetic Prototype**.
2. In the add-data panel, choose the **Google Sheets** connector.
3. Select spreadsheet **Merchant Feedback — Synthetic Test** and worksheet **Retours**.
4. Enable **Use first row as headers**. Use the whole worksheet; do not select a manually calculated totals range.
5. Connect and inspect the field list. Set `DATE_AVIS` to **Date & Time**, the helper columns to **Number**, and the remaining fields to **Text** as listed above.
6. Set the report subtitle to **Synthetic development environment — production source not connected**.

Google's documented connector flow selects the spreadsheet and worksheet and uses the first row as headers; field types and aggregations can then be adjusted in the data source. See [Create a Google Sheets data source](https://cloud.google.com/looker/docs/studio/tutorial-create-a-google-sheets-data-source) and [Model your data](https://cloud.google.com/looker/docs/studio/model-your-data).

## 4. Create calculated fields

Create `Comment_Flag` as a data-source calculated field. It is a row-level numeric field: 1 when a comment exists, otherwise 0. Set its default aggregation to **Sum** when used as a metric.

**Field name:** `Comment_Flag`  
**Formula:**

```text
CASE
  WHEN COMMENTAIRE_LEAD_AVIS IS NULL OR COMMENTAIRE_LEAD_AVIS = "" THEN 0
  ELSE 1
END
```

**Purpose:** Count feedback rows with written comments while retaining rows with blank comments in total feedback.

Create `Comment_Coverage` as an aggregated calculated metric.

**Field name:** `Comment_Coverage`  
**Formula:**

```text
CASE
  WHEN COUNT(DATE_AVIS) = 0 THEN 0
  ELSE SUM(Comment_Flag) / COUNT(DATE_AVIS)
END
```

**Purpose:** Share of dated feedback rows with comments. Set the result display type/format to **Percent**. For this validated source, every record has a valid date, so `COUNT(DATE_AVIS)` is the row denominator. If production data later permits missing dates, confirm the intended denominator with the data owner before use.

Google documents `CASE` calculated fields and aggregation functions in calculated metrics; `IS NULL` detects a null or empty field, while `= ""` handles an empty string. Its formula editor validates field names and types when saving. See [Create calculated fields](https://cloud.google.com/looker/docs/studio/tutorial-create-calculated-fields-in-looker-studio), [About calculated fields](https://cloud.google.com/looker/docs/studio/about-calculated-fields), [Operators](https://cloud.google.com/looker/docs/studio/operators), and [Add, edit, and troubleshoot calculated fields](https://cloud.google.com/looker/docs/studio/add-edit-and-troubleshoot-calculated-fields).

## 5. Page 1 — Overview

Use a restrained business layout with clear spacing, readable typography, and no decorative graphics. Add the title and subtitle at the top.

### Filters

Add these controls below the header and confirm they affect the appropriate charts, scorecards, and table:

- Establishment: `LIB_ETABLISSEMENT`
- Region: `LIB_REGION`
- Feedback category: `LIB_AVIS`
- Date range: `DATE_AVIS`

Keep the raw field name visible in the category label; `LIB_AVIS` is not a confirmed rating.

### KPI scorecards

| Label | Metric/configuration |
|---|---|
| Total Feedback | Built-in **Record Count** |
| Distinct Establishments | `LIB_ETABLISSEMENT` with **Count Distinct** aggregation |
| Distinct Regions | `LIB_REGION` with **Count Distinct** aggregation |
| Feedback With Comments | `Comment_Flag` with **Sum** aggregation |
| Comment Coverage % | `Comment_Coverage`, formatted as Percent |

Do not add Average Rating.

### Charts

| Title | Chart type | Dimension | Metric | Sort |
|---|---|---|---|---|
| Feedback Volume Over Time | Time series | `DATE_AVIS`, day granularity | Record Count | Date ascending |
| Feedback by Establishment | Horizontal bar | `LIB_ETABLISSEMENT` | Record Count | Record Count descending |
| Feedback by Category | Bar or column | `LIB_AVIS` | Record Count | Record Count descending |
| Feedback by Region | Bar | `LIB_REGION` | Record Count | Record Count descending |
| Monthly Feedback Trend | Time series or column | `DATE_AVIS`, Year Month granularity | Record Count | Date ascending |

Prefer the built-in Year Month granularity of `DATE_AVIS`. Do not reconstruct month dates from `ANNEE_MOIS`: in the current real extract it does not equal a `YYYYMM` key derived from `DATE_AVIS`, and its meaning is unresolved.

### Recent Feedback table

Add a table titled **Recent Feedback** with these columns in order:

1. `DATE_AVIS`
2. `LIB_ETABLISSEMENT`
3. `LIB_AVIS`
4. `COMMENTAIRE_LEAD_AVIS`

Sort by `DATE_AVIS` descending. Add a chart-level filter to include only non-null and non-empty `COMMENTAIRE_LEAD_AVIS`. Keep blank-comment rows in the KPI and other charts. Use a reasonable row limit (for example, 20) and wrap the comment column. Do not add sentiment or rating fields.

## 6. Page 2 — Feedback Explorer

If using multiple report pages, add **Feedback Explorer** for reading and filtering written feedback:

- Repeat the establishment, region, category, and date controls.
- Add a table with `DATE_AVIS`, `LIB_ETABLISSEMENT`, `LIB_REGION`, `LIB_AVIS`, and `COMMENTAIRE_LEAD_AVIS`.
- Sort newest first and exclude blank comments from this table only.
- Make the comment column wide enough to read; keep the page focused on exploration rather than repeating all Overview KPIs.

## 7. Page 3 — Data Definitions

Optionally add **Data Definitions** with a simple two-column table of field and current interpretation, based on `docs/data-dictionary.md`. Explicitly mark `LIB_AVIS`, `LIB_ETABLISSEMENT`, `IDENTITE_LEAD`, `RESPONSABLE`, `LIB_SOURCE_LEAD`, and `EST_CLASSER` as **Meaning requires confirmation from data owner**. State that `DATE_AVIS` is treated as the feedback date/time and `COMMENTAIRE_LEAD_AVIS` as comment text. Do not imply the remaining field semantics are confirmed.

## 8. Test the report against the synthetic source

With no filters selected, expected values are:

| Check | Expected |
|---|---:|
| Total Feedback | 720 |
| Distinct Establishments | 12 |
| Distinct Regions | 6 |
| Feedback With Comments | 694 |
| Comment Coverage | 96.4% (approximately) |

Then verify:

1. All time-series and category/establishment/region charts display data.
2. Date range, establishment, region, and `LIB_AVIS` controls change the relevant charts and scorecards.
3. The Recent Feedback table is newest first and contains no blank comments.
4. Blank comments remain included in Total Feedback.
5. A filter combination with no matching data displays an understandable empty state.
6. The Overview and Explorer pages remain readable at a narrow viewport.

Investigate any mismatch against the Python output before accepting the prototype. Common causes include wrong separator, first row not used as headers, a date parsed as text, different filter scope, or comments with an unhandled empty-string/null representation.

### Manual verification checklist

After importing the synthetic CSV:

1. **Rows and columns:** verify exactly 16 headers and 720 data rows (721 sheet rows including the header); check no extra title, blank, or total row was introduced.
2. **Date parsing:** verify `DATE_AVIS` is Date & Time, not Text. Sort a temporary view ascending and descending and confirm timestamps change chronologically. Do not save a helper sort column into the source data.
3. **Blank comments:** confirm empty source cells remain empty and `COMMENTAIRE_LEAD_AVIS` is Text. The synthetic profile expects 26 blank comments; blank comments still count toward Total Feedback.
4. **KPI totals:** with no filters, compare the five scorecards to the expected-value table above.
5. **Chart totals:** with no filters, confirm each establishment/category/region breakdown sums to 720, and the time series covers all 720 records. Avoid chart row limits while checking totals.
6. **Filters:** select one synthetic date range, establishment, region, and feedback category in turn. Confirm affected scorecards/charts/table update and reset each filter before testing the next. Also test a combined selection and a no-results state.
7. **Recent Feedback sort:** verify descending `DATE_AVIS`; compare the first visible timestamps, without copying or exporting any comments. Confirm the table filter removes blank comments only from the table, not from other totals.

The local real-data extract is not connected to this report. Its aggregate profile is only useful for validating field types and known constraints: four comments are blank; `DATE_AVIS`, `ANNEE_AVIS`, `MOIS_AVIS`, and `SEMAINE_AVIS` agree in the inspected extract; `LIB_ETABLISSEMENT` has one distinct value. Do not use that extract to test report interactions unless the data owner separately authorizes an appropriate private connection.

## 9. Production handoff

1. The developer validates the prototype using only the synthetic test sheet.
2. The developer provides the report template/copy and build documentation.
3. The commercial manager makes a copy under their own account.
4. The commercial manager creates or selects their private Google Sheet and imports the real source privately.
5. The commercial manager reconnects their report copy to that private sheet and verifies field mappings.
6. The developer does not receive access to the production sheet, records, credentials, or tokens unless separately and explicitly authorized later.

No production connection is part of this phase. Keep the development prototype connected only to the synthetic source.

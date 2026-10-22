#!/usr/bin/env python3
"""Print aggregate quality statistics for the synthetic dataset only."""

from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "merchant_feedback_synthetic.csv"
sys.path.insert(0, str(ROOT / "scripts"))
from generate_synthetic_data import (  # noqa: E402
    ALL_COMMENTS,
    AVIS_CATEGORIES,
    CLASSES,
    ENTITIES,
    ESTABLISHMENTS,
    REGIONS,
    RESPONSIBLES,
    SOURCES,
)

EXPECTED_HEADERS = [
    "IDENTITE_LEAD", "ANNEE_LEAD", "MOIS_LEAD", "LIB_AVIS", "DATE_AVIS",
    "IdxJours", "ANNEE_MOIS", "ANNEE_AVIS", "MOIS_AVIS", "RESPONSABLE",
    "LIB_SOURCE_LEAD", "COMMENTAIRE_LEAD_AVIS", "EST_CLASSER",
    "LIB_ETABLISSEMENT", "SEMAINE_AVIS", "LIB_REGION",
]


def main() -> None:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != EXPECTED_HEADERS:
            raise SystemExit("Profile stopped: synthetic CSV does not match the expected 16-column schema.")
        rows = list(reader)
    if not rows:
        raise SystemExit("Profile stopped: synthetic CSV contains no records.")

    dates: list[datetime] = []
    monthly_counts: Counter[str] = Counter()
    establishments: set[str] = set()
    regions: set[str] = set()
    categories: set[str] = set()
    classes: set[str] = set()
    comments = 0
    allowed_values = {
        "IDENTITE_LEAD": ENTITIES,
        "LIB_AVIS": AVIS_CATEGORIES,
        "RESPONSABLE": RESPONSIBLES,
        "LIB_SOURCE_LEAD": SOURCES,
        "EST_CLASSER": CLASSES,
        "LIB_ETABLISSEMENT": ESTABLISHMENTS,
        "LIB_REGION": REGIONS,
    }
    for row in rows:
        try:
            date = datetime.strptime(row["DATE_AVIS"], "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError) as exc:
            raise SystemExit("Profile stopped: DATE_AVIS contains an invalid synthetic timestamp.") from exc
        dates.append(date)
        monthly_counts[date.strftime("%Y-%m")] += 1
        establishments.add(row["LIB_ETABLISSEMENT"])
        regions.add(row["LIB_REGION"])
        categories.add(row["LIB_AVIS"])
        classes.add(row["EST_CLASSER"])
        comments += bool(row["COMMENTAIRE_LEAD_AVIS"].strip())
        if any(row[field] not in allowed for field, allowed in allowed_values.items()):
            raise SystemExit("Profile stopped: a categorical value is outside the fictional allowlist.")
        if row["COMMENTAIRE_LEAD_AVIS"] not in ALL_COMMENTS and row["COMMENTAIRE_LEAD_AVIS"] != "":
            raise SystemExit("Profile stopped: a comment is outside the fictional phrase set.")

    print("Synthetic dataset quality profile")
    print(f"Rows: {len(rows)}")
    print(f"Columns: {len(EXPECTED_HEADERS)}")
    print(f"Date range: {min(dates):%Y-%m-%d %H:%M:%S} to {max(dates):%Y-%m-%d %H:%M:%S}")
    print(f"Distinct establishments: {len(establishments)}")
    print(f"Distinct regions: {len(regions)}")
    print(f"Distinct feedback categories: {len(categories)}")
    print(f"Records with comments: {comments}")
    print(f"Comment coverage: {comments / len(rows):.1%}")
    print(f"Blank comments: {len(rows) - comments}")
    print(f"Distinct values in EST_CLASSER: {len(classes)}")
    print("Monthly record counts:")
    for month, count in sorted(monthly_counts.items()):
        print(f"  {month}: {count}")


if __name__ == "__main__":
    main()

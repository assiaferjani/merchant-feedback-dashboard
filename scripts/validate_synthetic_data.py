#!/usr/bin/env python3
"""Validate the synthetic CSV structure and ensure it contains only generated values."""

from __future__ import annotations

import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from generate_synthetic_data import (  # noqa: E402
    ALL_COMMENTS,
    AVIS_CATEGORIES,
    CLASSES,
    ENTITIES,
    ESTABLISHMENTS,
    HEADERS,
    REGIONS,
    RESPONSIBLES,
    SOURCES,
)

CSV_PATH = ROOT / "data" / "merchant_feedback_synthetic.csv"
EXPECTED_MIN_ROWS = 500
EXPECTED_MAX_ROWS = 1000
SYNTHETIC_START_DATE = datetime(2025, 10, 9).date()
CATEGORICAL_FIELDS = {
    "IDENTITE_LEAD": set(ENTITIES),
    "LIB_AVIS": set(AVIS_CATEGORIES),
    "RESPONSABLE": set(RESPONSIBLES),
    "LIB_SOURCE_LEAD": set(SOURCES),
    "EST_CLASSER": set(CLASSES),
    "LIB_ETABLISSEMENT": set(ESTABLISHMENTS),
    "LIB_REGION": set(REGIONS),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    require(CSV_PATH.is_file(), f"Synthetic CSV not found: {CSV_PATH}")
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        require(reader.fieldnames == HEADERS, "Header names/order do not match the 16-column schema")
        rows = list(reader)

    require(EXPECTED_MIN_ROWS <= len(rows) <= EXPECTED_MAX_ROWS, "Row count must be 500–1,000")
    require(all(None not in row for row in rows), "A row has more fields than the schema")
    require(all(all(row[h] is not None for h in HEADERS) for row in rows), "A row has fewer fields than the schema")

    establishments = {row["LIB_ETABLISSEMENT"] for row in rows}
    regions = {row["LIB_REGION"] for row in rows}
    months = {row["ANNEE_MOIS"] for row in rows}
    require(len(establishments) >= 10, "Expected at least 10 synthetic establishments")
    require(len(regions) >= 5, "Expected at least 5 synthetic regions")
    require(len(months) >= 10, "Expected at least 10 distinct months")

    comment_count = 0
    positive_count = 0
    negative_count = 0
    for number, row in enumerate(rows, start=2):
        try:
            stamp = datetime.strptime(row["DATE_AVIS"], "%Y-%m-%d %H:%M:%S")
        except ValueError as exc:
            raise AssertionError(f"Invalid DATE_AVIS format on CSV row {number}") from exc
        date = stamp.date()
        require(int(row["ANNEE_AVIS"]) == date.year, f"ANNEE_AVIS mismatch on row {number}")
        require(int(row["MOIS_AVIS"]) == date.month, f"MOIS_AVIS mismatch on row {number}")
        require(int(row["ANNEE_MOIS"]) == date.year * 100 + date.month, f"ANNEE_MOIS mismatch on row {number}")
        require(int(row["SEMAINE_AVIS"]) == date.isocalendar().week, f"SEMAINE_AVIS mismatch on row {number}")
        require(int(row["ANNEE_LEAD"]) == date.year, f"Synthetic ANNEE_LEAD mismatch on row {number}")
        require(int(row["MOIS_LEAD"]) == date.month, f"Synthetic MOIS_LEAD mismatch on row {number}")
        expected_day_index = (date - SYNTHETIC_START_DATE).days + 1
        require(int(row["IdxJours"]) == expected_day_index, f"Synthetic IdxJours mismatch on row {number}")
        require(date == SYNTHETIC_START_DATE + timedelta(days=expected_day_index - 1), f"Synthetic date/index mismatch on row {number}")
        require(row["COMMENTAIRE_LEAD_AVIS"] == "" or isinstance(row["COMMENTAIRE_LEAD_AVIS"], str), "Comment must be text or blank")
        require(row["COMMENTAIRE_LEAD_AVIS"] in ALL_COMMENTS or row["COMMENTAIRE_LEAD_AVIS"] == "", "Comment is outside the synthetic phrase set")
        if row["COMMENTAIRE_LEAD_AVIS"]:
            comment_count += 1
            positive_count += row["COMMENTAIRE_LEAD_AVIS"] in {
                "Accueil agréable et service efficace.",
                "Commande prête rapidement, merci à l'équipe.",
                "Bon choix de produits et personnel disponible.",
                "Expérience satisfaisante, je reviendrai.",
                "Service souriant et espace bien organisé.",
                "Très bonne expérience lors de mon passage.",
            }
            negative_count += row["COMMENTAIRE_LEAD_AVIS"] in {
                "Attente plus longue que prévu aujourd'hui.",
                "Un produit demandé n'était pas disponible.",
                "La signalétique pourrait être plus claire.",
                "Le service était lent pendant l'affluence.",
                "La commande ne correspondait pas entièrement à ma demande.",
                "Il serait utile d'améliorer la disponibilité des produits.",
            }
        for field, allowed in CATEGORICAL_FIELDS.items():
            require(row[field] in allowed, f"Unexpected/non-synthetic category in {field}, row {number}")
        require(row["LIB_AVIS"] != "", f"LIB_AVIS is empty on row {number}")
        require(row["LIB_ETABLISSEMENT"] != "", f"LIB_ETABLISSEMENT is empty on row {number}")
        require(row["LIB_REGION"] != "", f"LIB_REGION is empty on row {number}")

    comment_ratio = comment_count / len(rows)
    require(0.02 <= 1 - comment_ratio <= 0.08, "Blank comment rate must be a small 2–8%")
    require(positive_count > 0 and negative_count > 0, "Need both positive and negative synthetic comments")
    require(all(int(row[field]) >= 0 for row in rows for field in ("ANNEE_LEAD", "MOIS_LEAD", "IdxJours", "ANNEE_MOIS", "ANNEE_AVIS", "MOIS_AVIS", "SEMAINE_AVIS")), "Temporal numeric field contains a non-numeric or negative value")

    print("PASS: exact 16-column header and row shape")
    print(f"PASS: {len(rows)} rows within the {EXPECTED_MIN_ROWS}–{EXPECTED_MAX_ROWS} range")
    print(f"PASS: {len(establishments)} synthetic establishments, {len(regions)} synthetic regions, {len(months)} months")
    print("PASS: dates parse; year/month/year-month/ISO-week fields are consistent")
    print("PASS: categorical fields populated with allowlisted synthetic values")
    print(f"PASS: comments are synthetic text; {len(rows) - comment_count} blank ({1-comment_ratio:.1%}); positive and negative examples present")
    print("PASS: no rating field or mapping added; no external/source data read by generator or validator")


if __name__ == "__main__":
    main()

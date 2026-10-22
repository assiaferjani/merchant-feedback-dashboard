#!/usr/bin/env python3
"""Read-only, privacy-safe structural profile of a user-supplied local CSV.

This tool prints headers and aggregate counts only. It never prints cell values,
comments, names, or records and never writes a copy of the input.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import re
import secrets
from collections import Counter
from datetime import datetime
from pathlib import Path

EXPECTED_HEADERS = [
    "IDENTITE_LEAD", "ANNEE_LEAD", "MOIS_LEAD", "LIB_AVIS", "DATE_AVIS",
    "IdxJours", "ANNEE_MOIS", "ANNEE_AVIS", "MOIS_AVIS", "RESPONSABLE",
    "LIB_SOURCE_LEAD", "COMMENTAIRE_LEAD_AVIS", "EST_CLASSER",
    "LIB_ETABLISSEMENT", "SEMAINE_AVIS", "LIB_REGION",
]
DATE_TIME_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?")
INTEGER_PATTERN = re.compile(r"[+-]?\d+")
DECIMAL_PATTERN = re.compile(r"[+-]?(?:\d+[.,]\d*|\d*[.,]\d+)")


def parse_datetime(value: str) -> datetime | None:
    if not DATE_TIME_PATTERN.fullmatch(value):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, required=True,
        help="Local CSV to inspect. The script never modifies or copies this file.",
    )
    args = parser.parse_args()
    source = args.source.expanduser().resolve(strict=True)
    if not source.is_file():
        parser.error("--source must point to a local file")

    raw = source.read_bytes()
    try:
        content = raw.decode("utf-8-sig")
        encoding = "UTF-8" if raw.startswith(b"\xef\xbb\xbf") else "UTF-8 (no BOM)"
    except UnicodeDecodeError:
        content = raw.decode("cp1252")
        encoding = "Windows-1252"
    try:
        dialect = csv.Sniffer().sniff(content[:65536], delimiters=",;\t|")
    except csv.Error:
        parser.error("Could not safely identify a CSV delimiter")

    reader = csv.reader(content.splitlines(), dialect)
    try:
        headers = [header.strip() for header in next(reader)]
    except StopIteration:
        parser.error("CSV is empty")
    if len(set(headers)) != len(headers):
        parser.error("CSV has duplicate column headers")

    rows = 0
    blank_rows = 0
    malformed_rows = 0
    missing: Counter[str] = Counter()
    type_counts: dict[str, Counter[str]] = {header: Counter() for header in headers}
    distinct_hashes: dict[str, set[str]] = {header: set() for header in headers}
    timestamps: list[datetime] = []
    consistency = Counter()

    digest_key = secrets.token_bytes(32)

    for row in reader:
        if not row or all(not cell.strip() for cell in row):
            blank_rows += 1
            continue
        rows += 1
        if len(row) != len(headers):
            malformed_rows += 1
        values = {header: row[i].strip() if i < len(row) else "" for i, header in enumerate(headers)}
        row_date = None
        for header, value in values.items():
            if not value:
                missing[header] += 1
                continue
            # Keep only salted-in-process digests for uniqueness counts; never
            # retain a reportable list of identifiers or comments.
            distinct_hashes[header].add(hmac.new(digest_key, value.encode("utf-8"), hashlib.sha256).hexdigest())
            if header == "DATE_AVIS":
                parsed = parse_datetime(value)
                if parsed is not None:
                    type_counts[header]["datetime"] += 1
                    timestamps.append(parsed)
                    row_date = parsed.date()
                else:
                    type_counts[header]["text_or_invalid_datetime"] += 1
            elif INTEGER_PATTERN.fullmatch(value):
                type_counts[header]["integer"] += 1
            elif DECIMAL_PATTERN.fullmatch(value):
                type_counts[header]["decimal"] += 1
            else:
                type_counts[header]["text"] += 1

        if row_date is not None:
            # Track temporal agreement without emitting any source value.
            derived = {
                "ANNEE_AVIS": row_date.year,
                "MOIS_AVIS": row_date.month,
                "SEMAINE_AVIS": row_date.isocalendar().week,
            }
            for field, expected in derived.items():
                if field in values and values[field] and values[field] == str(expected):
                    consistency[field + "_match"] += 1
                elif field in values:
                    consistency[field + "_mismatch"] += 1
            lead_components = {
                "ANNEE_LEAD": row_date.year,
                "MOIS_LEAD": row_date.month,
            }
            for field, expected in lead_components.items():
                if field in values and values[field] and values[field] == str(expected):
                    consistency[field + "_matches_DATE_AVIS"] += 1
                elif field in values:
                    consistency[field + "_differs_from_DATE_AVIS"] += 1
            if "ANNEE_MOIS" in values and values["ANNEE_MOIS"]:
                if values["ANNEE_MOIS"] == str(row_date.year * 100 + row_date.month):
                    consistency["ANNEE_MOIS_equals_DATE_AVIS_YYYYMM"] += 1
                else:
                    consistency["ANNEE_MOIS_not_DATE_AVIS_YYYYMM"] += 1

    print("Local CSV structural profile (aggregate metadata only)")
    print(f"Encoding: {encoding}")
    print(f"Delimiter: {repr(dialect.delimiter)}")
    print(f"Columns: {len(headers)}")
    print(f"Headers: {', '.join(headers)}")
    print(f"Data rows: {rows}")
    print(f"Blank rows: {blank_rows}")
    print(f"Rows with unexpected column count: {malformed_rows}")
    if timestamps:
        print(f"DATE_AVIS format: ISO date/time with fractional seconds; parsed {len(timestamps)} values")
        print(f"DATE_AVIS range: {min(timestamps):%Y-%m-%d} to {max(timestamps):%Y-%m-%d}")
    if consistency:
        print("Temporal helper agreement counts:")
        for name in sorted(consistency):
            print(f"  {name}: {consistency[name]}")
    print("Field structure (no values):")
    for header in headers:
        counts = type_counts[header]
        inferred = counts.most_common(1)[0][0] if counts else "all_missing"
        print(
            f"  {header}: dominant_shape={inferred}; missing={missing[header]}; "
            f"distinct_nonblank={len(distinct_hashes[header])}; type_counts={dict(counts)}"
        )
    if headers == EXPECTED_HEADERS:
        print("Schema match: exact 16-column expected order")
    else:
        print("Schema match: headers differ from expected 16-column schema")


if __name__ == "__main__":
    main()

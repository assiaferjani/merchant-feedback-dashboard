#!/usr/bin/env python3
"""Generate a fictional merchant feedback CSV without reading any source data."""

from __future__ import annotations

import argparse
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "merchant_feedback_synthetic.csv"
HEADERS = [
    "IDENTITE_LEAD", "ANNEE_LEAD", "MOIS_LEAD", "LIB_AVIS", "DATE_AVIS",
    "IdxJours", "ANNEE_MOIS", "ANNEE_AVIS", "MOIS_AVIS", "RESPONSABLE",
    "LIB_SOURCE_LEAD", "COMMENTAIRE_LEAD_AVIS", "EST_CLASSER",
    "LIB_ETABLISSEMENT", "SEMAINE_AVIS", "LIB_REGION",
]

ESTABLISHMENTS = [f"Établissement fictif {i:02d}" for i in range(1, 13)]
ENTITIES = [f"Entité fictive {i:02d}" for i in range(1, 13)]
REGIONS = [f"Région fictive {letter}" for letter in "ABCDEF"]
RESPONSIBLES = [
    "Camille Exemple", "Noa Démo", "Lou Test", "Sacha Fictif",
    "Alex Échantillon", "Charlie Modèle",
]
AVIS_CATEGORIES = [
    "Catégorie fictive A", "Catégorie fictive B",
    "Catégorie fictive C", "Catégorie fictive D",
]
SOURCES = ["Source fictive A", "Source fictive B", "Source fictive C"]
CLASSES = ["Classe fictive A", "Classe fictive B", "Classe fictive C"]

# Deliberately synthetic French examples. Their tone is not a classification rule.
POSITIVE_COMMENTS = [
    "Accueil agréable et service efficace.",
    "Commande prête rapidement, merci à l'équipe.",
    "Bon choix de produits et personnel disponible.",
    "Expérience satisfaisante, je reviendrai.",
    "Service souriant et espace bien organisé.",
    "Très bonne expérience lors de mon passage.",
]
NEGATIVE_COMMENTS = [
    "Attente plus longue que prévu aujourd'hui.",
    "Un produit demandé n'était pas disponible.",
    "La signalétique pourrait être plus claire.",
    "Le service était lent pendant l'affluence.",
    "La commande ne correspondait pas entièrement à ma demande.",
    "Il serait utile d'améliorer la disponibilité des produits.",
]
NEUTRAL_COMMENTS = [
    "Passage rapide, expérience correcte.",
    "Offre habituelle, sans remarque particulière.",
    "Le service correspondait à mes attentes.",
    "Quelques améliorations seraient possibles sur l'information.",
]
ALL_COMMENTS = set(POSITIVE_COMMENTS + NEGATIVE_COMMENTS + NEUTRAL_COMMENTS)


def build_rows(count: int, seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed)
    start = datetime(2025, 10, 9, 0, 0, 0)
    rows: list[dict[str, object]] = []
    for index in range(count):
        # Stratified day selection gives coverage across the full period, with
        # jittered times and categories/establishments chosen independently.
        fraction = index / max(count - 1, 1)
        day_offset = min(364, int(fraction * 365))
        timestamp = start + timedelta(
            days=day_offset,
            seconds=rng.randrange(0, 24 * 60 * 60),
        )
        date = timestamp.date()
        tone = rng.choices(["positive", "negative", "neutral"], [0.55, 0.28, 0.17])[0]
        pool = {
            "positive": POSITIVE_COMMENTS,
            "negative": NEGATIVE_COMMENTS,
            "neutral": NEUTRAL_COMMENTS,
        }[tone]
        comment = "" if rng.random() < 0.045 else rng.choice(pool)
        iso_week = date.isocalendar().week
        rows.append(
            {
                "IDENTITE_LEAD": rng.choice(ENTITIES),
                # Synthetic placeholders only; real semantics remain unknown.
                "ANNEE_LEAD": date.year,
                "MOIS_LEAD": date.month,
                "LIB_AVIS": rng.choice(AVIS_CATEGORIES),
                "DATE_AVIS": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "IdxJours": (date - start.date()).days + 1,
                "ANNEE_MOIS": date.year * 100 + date.month,
                "ANNEE_AVIS": date.year,
                "MOIS_AVIS": date.month,
                "RESPONSABLE": rng.choice(RESPONSIBLES),
                "LIB_SOURCE_LEAD": rng.choice(SOURCES),
                "COMMENTAIRE_LEAD_AVIS": comment,
                "EST_CLASSER": rng.choice(CLASSES),
                "LIB_ETABLISSEMENT": rng.choice(ESTABLISHMENTS),
                "SEMAINE_AVIS": iso_week,
                "LIB_REGION": rng.choice(REGIONS),
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=720, help="Synthetic rows (500–1,000).")
    parser.add_argument("--seed", type=int, default=20261008, help="Reproducible random seed.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="CSV output path.")
    args = parser.parse_args()
    if not 500 <= args.rows <= 1000:
        parser.error("--rows must be between 500 and 1,000")
    output = args.output.resolve()
    if ROOT not in output.parents:
        parser.error("--output must remain inside this project directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    rows = build_rows(args.rows, args.seed)
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Generated {len(rows)} synthetic rows, {len(HEADERS)} columns: {output}")


if __name__ == "__main__":
    main()

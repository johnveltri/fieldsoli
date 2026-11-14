"""Evaluate the frozen protocol on locally obtained JLC report pages. Standard library only."""
import argparse
import csv
from html.parser import HTMLParser
from pathlib import Path
from statistics import mean, median

REGIONS = ("new-england", "mountain", "south-atlantic", "east-north-central")
PROJECTS = (
    "Minor Kitchen Remodel | Midrange", "Major Kitchen Remodel | Midrange",
    "Major Kitchen Remodel | Upscale", "Bath Remodel | Midrange", "Bath Remodel | Upscale",
)


class CostTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.costs = {}

    def handle_starttag(self, tag, attrs):
        row = dict(attrs)
        if tag == "tr" and row.get("data-project") in PROJECTS:
            self.costs[row["data-project"]] = int(row["data-job-cost"])


def read_table(folder, year, region):
    table = CostTable()
    path = folder / f"jlc-remodel-{year}-{region}.html"
    table.feed(path.read_text())
    if set(table.costs) != set(PROJECTS):
        raise ValueError(f"Prototype missing or renamed in {path}; check source.")
    return table.costs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--errors", required=True, type=Path)
    args = parser.parse_args()
    tables = {(year, region): read_table(args.folder, year, region)
              for year in (2024, 2025) for region in ("national", *REGIONS)}
    records = []
    metrics = {"national": [], "regional": []}
    for region in REGIONS:
        for project in PROJECTS:
            baseline = tables[2025, "national"][project]
            estimate = baseline * tables[2024, region][project] / tables[2024, "national"][project]
            target = tables[2025, region][project]
            row = {"region": region, "project": project}
            for model, cost in (("national", baseline), ("regional", estimate)):
                signed_pct = 100 * (cost - target) / target
                metrics[model].append((abs(cost - target), abs(signed_pct)))
                row[f"{model}_signed_pct_error"] = round(signed_pct, 3)
            records.append(row)
    with args.errors.open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    for model, errors in metrics.items():
        dollars, percent = zip(*errors)
        print(f"{model}: n={len(errors)}, MAE=${mean(dollars):,.0f}, MAPE={mean(percent):.2f}%, "
              f"median APE={median(percent):.2f}%, max APE={max(percent):.2f}%, "
              f"within 10%={sum(p <= 10 for p in percent)}/{len(percent)}")
    print("Regional improves", sum(a[0] > b[0] for a, b in zip(*metrics.values())), "cells")


if __name__ == "__main__":
    main()

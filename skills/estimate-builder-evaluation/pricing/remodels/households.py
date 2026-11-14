"""Score 2023 national AHS kitchen/bath expenditure estimates on unseen households."""
import argparse
import csv
import hashlib
import io
from collections import defaultdict
from itertools import chain
from statistics import mean, median, quantiles
import zipfile


def benchmark(values):
    cuts = quantiles(values, n=10, method="inclusive")
    return cuts[0], median(values), cuts[-1]


def score(cases, estimates):
    errors, percentages, contained = [], [], []
    for key, spent in cases:
        low, point, high = estimates[key]
        errors.append(abs(point - spent))
        percentages.append(100 * errors[-1] / spent)
        contained.append(low <= spent <= high)
    print(f"MAE=${mean(errors):,.0f}, median APE={median(percentages):.1f}%, "
          f"within 25%={100*mean(p <= 25 for p in percentages):.1f}%, "
          f"interval coverage={100*mean(contained):.1f}%")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path")
    args = parser.parse_args()
    training = defaultdict(list)
    cases, test_ids = [], set()
    with zipfile.ZipFile(args.zip_path) as archive, archive.open("project.csv") as file:
        for row in csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig")):
            key = tuple(row[col].strip("'") for col in ("JOBTYPE", "JOBDIY"))
            if key[0] not in ("12", "13") or key[1] not in ("1", "2"):
                continue
            try:
                spent = float(row["JOBCOST"].strip("'"))
            except ValueError:
                continue
            if spent <= 0:
                continue
            household = row["CONTROL"].strip("'")
            bucket = int(hashlib.sha256(household.encode()).hexdigest()[:8], 16) % 5
            if bucket == 0:
                test_ids.add(household)
                cases.append((key, spent))
            else:
                training[key].append(spent)
    pooled = benchmark(list(chain.from_iterable(training.values())))
    grouped = {key: benchmark(values) for key, values in training.items()}
    print(f"test projects={len(cases)} across {len(test_ids)} households, training projects={sum(map(len, training.values()))}")
    for key in sorted(grouped):
        print(key, len(training[key]), grouped[key])
    print("Pooled:", pooled)
    score(cases, dict.fromkeys(grouped, pooled))
    print("Room and DIY:")
    score(cases, grouped)


if __name__ == "__main__":
    main()

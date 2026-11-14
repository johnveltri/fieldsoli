"""Replay the frozen holdout test using published US-dollar mowing rates."""
import csv
from pathlib import Path
from statistics import mean, median


def main():
    with Path(__file__).with_name("mowing.csv").open() as source:
        rows = list(csv.DictReader(source))
    train = sorted(
        (int(row["upper_sqft"]), float(row["base_low_usd"]))
        for row in rows
        if row["set"] == "train"
    )
    flat = median(rate for _, rate in train)
    for split in ("original", "supplement"):
        errors = []
        for row in rows:
            if row["set"] != split:
                continue
            area = int(row["upper_sqft"])
            if area > train[-1][0]:
                continue
            prediction = next(rate for upper, rate in train if area <= upper)
            target = float(row["base_low_usd"]) * float(row["weekly_factor"])
            errors.append((prediction - target, flat - target))
            print(f"{row['provider']} {area} sq ft: target {target:.2f}, "
                  f"tier {prediction:.2f}, flat {flat:.2f}, "
                  f"absolute errors {abs(prediction-target):.2f}/{abs(flat-target):.2f}")
        for name, values in zip(("tier", "flat"), zip(*errors)):
            print(f"{split} {name}: n={len(values)}, "
                  f"MAE={mean(map(abs, values)):.2f}, bias={mean(values):.2f}")


if __name__ == "__main__":
    main()

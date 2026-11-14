"""Compare bidder rates under the frozen fence protocol, dollars per installed foot."""
import csv
from pathlib import Path
from statistics import mean, median

with Path(__file__).with_name("fencing.csv").open() as source:
    rows = list(csv.DictReader(source))
flat = median(float(row["EB Fence"]) for row in rows)
errors = []
for bidder in ("South State", "Accent Fence"):
    for row in rows:
        tier = float(row["EB Fence"])
        actual = float(row[bidder])
        errors.append((tier - actual, flat - actual))
        print(f"{bidder} {row['height_ft']} ft: actual={actual:.2f} "
              f"tier={tier:.2f} flat={flat:.3f} signed={tier-actual:.3f}/{flat-actual:.3f} "
              f"absolute={abs(tier-actual):.3f}/{abs(flat-actual):.3f}")
for name, values in zip(("height", "flat"), zip(*errors)):
    print(f"{name}: n={len(values)}, MAE={mean(map(abs, values)):.2f}, "
          f"bias={mean(values):.2f}")

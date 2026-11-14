"""Same observed targets and coverage for both methods; no parameter fitting."""
import csv
from decimal import Decimal as D
from pathlib import Path
from statistics import median

root = Path(__file__).resolve().parent
with (root / "fictional_proxies.csv").open() as f:
    targets = list(csv.DictReader(f))
assert len(targets) == len({(r["provider"], r["fictional_case"]) for r in targets}) == 15
rows = []
for r in targets:
    # Input contains only known haul packages for 26/31 and excludes
    # Appliance Installation Inc's automatically bundled haul for 38.
    peers = [s for s in targets if s["provider"] != r["provider"] and s["fictional_case"] == r["fictional_case"]]
    assert len(peers) == 4
    if r["fictional_case"] == "38":
        assert all(s["provider"] != "Appliance Installation Inc" for s in [r, *peers])
    actual = D(r["target_with_applicable_haul"])
    original = D(r["prediction"])
    prediction = median([D(s["target_with_applicable_haul"]) for s in peers])
    e0, e1 = abs(original-actual), abs(prediction-actual)
    rows.append(dict(provider=r["provider"], case=r["fictional_case"], actual=actual, original=original, research=prediction,
                     original_error=e0, research_error=e1, original_within20=e0 <= actual/5, research_within20=e1 <= actual/5,
                     closer="research" if e1 < e0 else "original" if e0 < e1 else "tie", donors=" | ".join(s["provider"] for s in peers)))
with (root / "paired.csv").open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0])
    writer.writeheader()
    writer.writerows(rows)
for group in ["26","31","38","all"]:
    sample = [r for r in rows if group == "all" or r["case"] == group]
    print(group, "n", len(sample))
    for method in ["original","research"]:
        error = sum(r[method+"_error"] for r in sample)
        print(method, f"MAE {error/len(sample):.2f}", f"WAPE {100*error/sum(r['actual'] for r in sample):.2f}%",
              "within20", sum(r[method+"_within20"] for r in sample), "closer", sum(r["closer"]==method for r in sample))

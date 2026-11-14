"""Reproduce scores from transcribed US provider cards; Python 3 standard library."""
import csv
import json
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parent
cards = json.loads((ROOT / "cards.json").read_text())
rows = [(c["provider"], r) for c in cards for r in c["rates"]]
fixed = [r for _, r in rows if r["kind"] == "fixed"]

def write_table(filename, data):
    with (ROOT / filename).open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

def score(actual, predicted):
    if predicted is None:
        return {"prediction": None, "abs_error": None, "within20": None}
    error = abs(actual - predicted)
    return {"prediction": round(predicted, 3), "abs_error": round(error, 3), "within20": error <= 0.2 * actual}

def summarize(name, records):
    scored = [r for r in records if r["abs_error"] is not None]
    print(f'{name}: n={len(scored)}, MAE {mean(r["abs_error"] for r in scored):.2f}, within 20% {sum(r["within20"] for r in scored)}/{len(scored)}, abstentions {len(records)-len(scored)}')

results = []
for provider, row in rows:
    others = [r for p, r in rows if p != provider and r["kind"] == row["kind"] and (r["service"] == "hour") == (row["service"] == "hour")]
    for method in ["service", "pooled"]:
        prices = [r["usd"] for r in others if method == "pooled" or r["service"] == row["service"]]
        results.append({"provider": provider, "service": row["service"], "kind": row["kind"], "method": method, "actual": row["usd"], **score(row["usd"], median(prices) if prices else None)})
write_table("holdouts.csv", results)
for method in ["service", "pooled"]:
    summarize(method, [r for r in results if r["method"] == method and r["kind"] == "fixed"])
for service in ["dishwasher","otr","tv","disposal","hour"]:
    prices = [r["usd"] for r in fixed if r["service"] == service]
    print(service, "n", len(prices), "full-card median", median(prices), "observed", min(prices), max(prices))
# Fictional reply prices are proxy predictions only. Compare with haul when available.
proxy = []
for provider, r in rows:
    if r["kind"] != "fixed":
        continue
    service = r["service"]
    if service in ("dishwasher","otr") and "haul" in r:
        case, estimate = (26, 260) if service == "dishwasher" else (31, 240)
        target = r["usd"] + r["haul"]
    elif service == "disposal" and provider != "Appliance Installation Inc":
        case, estimate, target = 38, 180, r["usd"]
    else:
        continue
    proxy.append({"provider":provider, "fictional_case":case, "target_with_applicable_haul":target, **score(target, estimate)})
write_table("fictional_proxies.csv", proxy)
summarize("fictional proxy",proxy)

forecasts = {service: median(r["usd"] for r in fixed if r["service"] == service) for service in {r["service"] for r in fixed}}
for service in ("dishwasher", "otr"):
    forecasts[service + "_with_haul"] = median(r["usd"] + r["haul"] for r in fixed if r["service"] == service and "haul" in r)
challenge = []
with (ROOT / "challenge.csv").open() as f:
    for row in csv.DictReader(f):
        amount = row["target"]
        metrics = score(float(amount), forecasts[row["service"]]) if amount else score(0, None)
        challenge.append({**row, **metrics})
write_table("challenge_results.csv",challenge)
summarize("prospective, base prices", [r for r in challenge if "with_haul" not in r["service"]])
summarize("prospective, packages", [r for r in challenge if "with_haul" in r["service"]])
for method in ["service", "pooled"]:
    for unit in ("project", "hour"):
        summarize(method + " " + unit, [r for r in results if r["method"] == method and r["kind"] == "fixed" and (r["service"] == "hour") == (unit == "hour")])

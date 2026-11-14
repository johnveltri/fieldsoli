"""Evaluate completed MA residential heat pump project costs without exporting addresses."""
import argparse
from collections import Counter, defaultdict
from datetime import date, timedelta
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import mean, median
from typing import NamedTuple
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
START = date(2014, 11, 1)
END = date(2026, 11, 13)
CHECKSUM = "e6e6ede0030baec616014a33271871f1845edc97c33c877e8de525bae5837529"
FIELDS = {"X", "Y", "AI", "AM", "AO", "AP", "AQ", "AR"}


class Project(NamedTuple):
    installed: date
    paid: date
    site: tuple
    outdoor: int
    indoor: int
    cost: float


def numbers(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def valid_date(value):
    serial = numbers(value)
    if not 1 <= serial <= (END - date(1899, 12, 30)).days:
        return None
    result = date(1899, 12, 30) + timedelta(days=int(serial))
    return result if START <= result <= END else None


def count_units(value):
    n = numbers(value)
    return int(n) if math.isfinite(n) and n > 0 and n.is_integer() else 0


def rows(path):
    with ZipFile(path) as book:
        strings = ["".join(entry.itertext()) for entry in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        for _, row in ET.iterparse(book.open("xl/worksheets/sheet1.xml"), events=("end",)):
            if row.tag != NS + "row" or row.get("r") == "1":
                continue
            values = {}
            for cell in row.findall(NS + "c"):
                column = re.sub(r"[0-9]+", "", cell.get("r"))
                if column in FIELDS:
                    value = cell.findtext(NS + "v")
                    if value is not None:
                        values[column] = strings[int(value)] if cell.get("t") == "s" else value
            row.clear()
            yield values


def read_projects(path):
    groups = defaultdict(list)
    counts = Counter()
    for row in rows(path):
        counts["sheet rows after header"] += 1
        if row.get("AR", "").strip().casefold() not in ("ma", "massachusetts"):
            counts["no MA project state, including summary/empty rows"] += 1
            continue
        installed, paid = valid_date(row.get("AM")), valid_date(row.get("AO"))
        if installed is None or paid is None or paid < installed:
            counts["invalid or missing installation/payment date or payment before install"] += 1
            continue
        outdoor = count_units(row.get("X"))
        cost = numbers(row.get("Y"))
        if not outdoor or not math.isfinite(cost) or cost <= 0:
            counts["invalid positive cost or exterior count"] += 1
            continue
        site = tuple(re.sub(r"[^a-z0-9]+", " ", row.get(c, "").lower()).strip()
                     for c in ("AP", "AQ"))
        if any(s in ("", "0", "na", "n a", "unknown", "none") for s in site):
            counts["missing usable site"] += 1
            continue
        groups[(site, installed)].append(Project(installed, paid, site, outdoor,
                                                count_units(row.get("AI")), cost))
    projects = []
    for group in groups.values():
        if len({(r.outdoor, r.indoor, r.cost) for r in group}) > 1:
            counts["ambiguous same site/date rows"] += len(group)
        else:
            projects.append(min(group, key=lambda r: r.paid))
            counts["duplicate same site/date/input/cost rows"] += len(group) - 1
    return sorted(projects, key=lambda p: p.installed), counts


def quantile(sorted_samples, fraction):
    index = fraction * (len(sorted_samples) - 1)
    base = int(index)
    return sorted_samples[base] + (index - base) * (
        sorted_samples[math.ceil(index)] - sorted_samples[base])


def key(project):
    return (min(project.outdoor, 3), min(project.indoor, 4))


def metrics(pairs):
    residuals = [limits[1] - p.cost for p, limits in pairs]
    return {
        "mae": round(mean(map(abs, residuals)), 2),
        "median_abs_error": round(median(map(abs, residuals)), 2),
        "bias": round(mean(residuals), 2),
        "within_25_pct_fraction": round(mean(abs(e) <= 0.25 * p.cost
                                             for e, (p, _) in zip(residuals, pairs)), 4),
        "central80_coverage_fraction": round(mean(lo <= p.cost <= hi
                                                 for p, (lo, _, hi) in pairs), 4),
        "mean_interval_width": round(mean(hi - lo for _, (lo, _, hi) in pairs), 2),
    }


def summarize(records):
    return {"n": len(records), "first_install": str(min(p.installed for p in records)),
            "last_install": str(max(p.installed for p in records)),
            "last_rebate_date": str(max(p.paid for p in records)),
            "actual_median": round(median(p.cost for p in records), 2)}


def evaluate(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != CHECKSUM:
        raise ValueError("Workbook differs from the frozen snapshot.")
    projects, counts = read_projects(path)
    boundary = projects[len(projects)*4//5].installed
    early = [p for p in projects if p.installed < boundary]
    train = [p for p in early if p.paid < boundary]
    train_sites = {p.site for p in train}
    later = [p for p in projects if p.installed >= boundary]
    hold = [p for p in later if p.site not in train_sites]
    groups = defaultdict(list)
    for p in train:
        outdoor, indoor = key(p)
        for g in [(), (outdoor,)] + ([(outdoor, indoor)] if indoor else []):
            groups[g].append(p.cost)
    limits = {}
    for g, values in groups.items():
        if len(values) >= 20:
            ordered = sorted(values)
            limits[g] = tuple(quantile(ordered, q) for q in (.1, .5, .9))
    predictions = defaultdict(list)
    used = Counter()
    for p in hold:
        outdoor, indoor = key(p)
        one = (outdoor,) if (outdoor,) in limits else ()
        both = (outdoor, indoor) if (outdoor, indoor) in limits else one
        used["indoor/outdoor specific rows" if len(both) == 2 else "fallback rows"] += 1
        for label, g in [("flat", ()), ("outdoor", one), ("outdoor_and_indoor", both)]:
            predictions[label].append((p, limits[g]))
    return {
        "checksum": CHECKSUM, "filters": dict(counts), "eligible": len(projects),
        "train": summarize(train), "cutoff": str(boundary),
        "late_payment_training_exclusions": len(early)-len(train),
        "holdout": summarize(hold), "cross_split_site_exclusions": len(later)-len(hold),
        "holdout_indoor_model_coverage": dict(used),
        "results": {name: metrics(pairs) for name, pairs in predictions.items()},
        "outdoor_group_results": {
            str(n): {"train_n": len(groups[(n,)]), "train_median_cost": limits[(n,)][1],
                     "holdout": summarize([p for p in hold if key(p)[0] == n]),
                     "model_mae": {label: metrics([(p, iv) for p, iv in pairs if key(p)[0] == n])["mae"]
                                   for label, pairs in predictions.items()}}
            for n in (1, 2, 3)
        }
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx", type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(args.xlsx), indent=2))

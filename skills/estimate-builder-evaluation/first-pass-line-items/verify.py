"""Verify corpus identity, recorded replay coverage, and agreed-price boundaries."""
import csv
import json
import re
from pathlib import Path

folder = Path(__file__).resolve().parent


def read_cases(path):
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert [row["id"] for row in rows] == list(range(1, 101)), path
    return rows


original = read_cases(folder.parent / "baseline.jsonl")
initial = read_cases(folder / "initial.jsonl")
second = read_cases(folder / "second-run.jsonl")
final = read_cases(folder / "final.jsonl")
with (folder / "scorecard.csv").open() as stream:
    scores = list(csv.DictReader(stream))
assert len(scores) == len(final)

for case, before, after, score in zip(original, initial, final, scores):
    case_id = case["id"]
    assert case_id == int(score["id"])
    assert case["request"] == after["request"] == score["request"]
    assert before["response"].strip()
    reply = after["response"]
    if case_id == 90:
        data = json.loads(reply.strip().strip("`").removeprefix("json").strip())
        customer = data["customer"]
        assert customer["items"] and "TBD" in json.dumps(customer)
    else:
        data_rows = [line for line in reply.splitlines() if line.strip().startswith("|")]
        assert any(re.search(r'\|\s*\**(?:TBD|\$[\d,]+)', row, re.I) for row in data_rows), case_id
        if case_id in (32, 85):
            budget = {32: "200", 85: "300"}[case_id]
            assert not any(re.search(r'\|\s*\**\$' + budget + r'\b', row) for row in data_rows)
        if case_id in (76, 77):
            assert any(("$280" if case_id == 76 else "$400") in row for row in data_rows)
            assert any("TBD" in row for row in data_rows)
    assert int(score["final_amount_rows"]) > 0
    if score["last_replayed"] == "full second run":
        assert after == second[case_id - 1]
print("Verified 100 original prompts, both replay sets, item amounts and the two bids and budgets.")

"""Export the Al-Ikhlas error dataset's spreadsheet as rows.json beside it.

Node reads no xlsx, so `build-ikhlas-fixtures.mjs` reads this instead: one
object per row, with the experts' error types, words and notes split into
lists in matching order. An empty cell is written as an empty list, never
null, which the builder relies on.

Needs openpyxl (`pip install openpyxl`).

usage: python scripts/tasmee/extract-ikhlas.py "<unpacked Dataset and Sounds dir>"
"""
import json
import sys

import openpyxl

raw = sys.argv[1]
sheet = openpyxl.load_workbook(
    f"{raw}/Dataset.xlsx", read_only=True, data_only=True
).worksheets[0]
rows = list(sheet.iter_rows(values_only=True))
keys = [
    "id", "surah", "ayah", "file", "hasError",
    "errorTypes", "errorWords", "errorNotes", "errorCode",
]
out = []
for values in rows[1:]:
    row = dict(zip(keys, values))
    for key in ("errorTypes", "errorWords", "errorNotes"):
        # Several mistakes share a cell, separated by Latin or Arabic commas.
        cell = row[key]
        row[key] = (
            []
            if cell in (0, None)
            else [p.strip() for p in str(cell).replace("،", ",").split(",") if p.strip()]
        )
    out.append(row)

with open(f"{raw}/rows.json", "w", encoding="utf-8") as handle:
    json.dump(out, handle, ensure_ascii=False, indent=1)
print(len(out), "rows")

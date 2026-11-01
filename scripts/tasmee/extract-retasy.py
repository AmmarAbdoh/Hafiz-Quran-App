"""Unpack the labelled RetaSy clips: audio bytes to files, everything else to rows.json.

Reads the parquet files of RetaSy/quranic_audio_dataset as downloaded from
Hugging Face and keeps only the clips with a final label (`correct` or
`in_correct`), which is what `build-retasy-fixtures.mjs --raw <out dir>`
reads.

Needs pyarrow (`pip install pyarrow`).

usage: python -I scripts/tasmee/extract-retasy.py <raw dir with *.parquet> <out dir>
"""
import json
import os
import sys

import pyarrow.parquet as pq

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "audio"), exist_ok=True)

KEEP = {"correct", "in_correct"}
rows = []
seen = {"all": 0, "labels": {}}
for name in sorted(f for f in os.listdir(raw) if f.endswith(".parquet")):
    table = pq.read_table(os.path.join(raw, name))
    for record in table.to_pylist():
        seen["all"] += 1
        label = record.get("final_label")
        seen["labels"][str(label)] = seen["labels"].get(str(label), 0) + 1
        if label not in KEEP:
            continue
        audio = record["audio"] or {}
        data = audio.get("bytes")
        if not data:
            continue
        source = audio.get("path") or ""
        ext = os.path.splitext(source)[1] or ".bin"
        file = f"audio/{len(rows):05d}{ext}"
        with open(os.path.join(out, file), "wb") as handle:
            handle.write(data)
        meta = {k: v for k, v in record.items() if k != "audio"}
        meta["source_path"] = source
        meta["file"] = file
        rows.append(meta)

with open(os.path.join(out, "rows.json"), "w", encoding="utf-8") as handle:
    json.dump(rows, handle, ensure_ascii=False, indent=1, default=str)
print(json.dumps(seen, ensure_ascii=False))
print(len(rows), "labelled clips written")

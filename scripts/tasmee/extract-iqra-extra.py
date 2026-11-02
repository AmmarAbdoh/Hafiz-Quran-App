"""Unpack IqraEval/Iqra_Extra_IS26: one audio file per clip, and the labels.

Reads the dataset as downloaded from Hugging Face - `data/train-*.parquet`,
gated, access requested by the user - and writes `<id>.<ext>` for each clip
and `rows.json` (id, sentence, phoneme_ref, phoneme_mis) into the output
folder, which is what `build-iqra-fixtures.mjs --raw <out dir>` reads. The
split is named "train"; here it is test-only, never training data.

Needs pyarrow (`pip install pyarrow`).

usage: python -I scripts/tasmee/extract-iqra-extra.py <downloaded dataset dir> <out dir>
"""
import glob
import json
import os
import sys

import pyarrow.parquet as pq

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rows = []
for name in sorted(glob.glob(os.path.join(raw, "data", "*.parquet"))):
    for record in pq.read_table(name).to_pylist():
        audio = record.pop("audio") or {}
        data = audio.get("bytes")
        if not data:
            print(record["id"], "has no audio, skipped", file=sys.stderr)
            continue
        ext = os.path.splitext(audio.get("path") or "")[1] or ".wav"
        with open(os.path.join(out, f"{record['id']}{ext}"), "wb") as handle:
            handle.write(data)
        rows.append({**record, "audio": f"{record['id']}{ext}"})
with open(os.path.join(out, "rows.json"), "w", encoding="utf-8") as handle:
    json.dump(rows, handle, ensure_ascii=False, indent=1)
print(len(rows), "clips")

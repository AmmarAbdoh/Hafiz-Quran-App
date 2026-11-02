"""Unpack the Quran Recitation Alignment Benchmark: one MP3 and one JSON per recording.

Reads QUD-Technologies/quran-alignment-benchmark (CC BY 4.0) as downloaded
from Hugging Face - `v1/test-*.parquet` - and writes `<id>.mp3` and
`<id>.json` (everything but the audio: the reviewed word timings, segments,
repeat count, style) into the output folder, which is what
`build-qud-fixtures.mjs --raw <out dir>` reads.

Needs pyarrow (`pip install pyarrow`).

usage: python -I scripts/tasmee/extract-qud.py <downloaded dataset dir> <out dir>
"""
import glob
import json
import os
import sys

import pyarrow.parquet as pq

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(glob.glob(os.path.join(raw, "v1", "*.parquet"))):
    for record in pq.read_table(name).to_pylist():
        audio = record.pop("audio") or {}
        with open(os.path.join(out, f"{record['id']}.mp3"), "wb") as handle:
            handle.write(audio["bytes"])
        with open(os.path.join(out, f"{record['id']}.json"), "w", encoding="utf-8") as handle:
            json.dump(record, handle, ensure_ascii=False, default=str)
        print(record["id"], record["duration_s"], "s")

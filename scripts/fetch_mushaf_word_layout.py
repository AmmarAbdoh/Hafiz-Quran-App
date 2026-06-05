#!/usr/bin/env python3
"""
Fetch word-by-word mushaf layout (page + line + position) from Quran.com's public API.

This is the same data behind https://quran.com/ar/page/N — e.g. data-word-location="2:249:1"
and Page41-Line1 — but as structured JSON instead of scraping HTML.

API docs: https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/
Public endpoint (no auth): https://api.quran.com/api/v4/verses/by_page/{page}

Usage:
  python scripts/fetch_mushaf_word_layout.py --page 41
  python scripts/fetch_mushaf_word_layout.py --all
  python scripts/fetch_mushaf_word_layout.py --all --mushaf 1 --output public/data/quran/mushaf_words_qcf_v2.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://api.quran.com/api/v4"
DEFAULT_MUSHAF = 19  # QCF Tajweed V4 (matches Quran.com reading mode)
DEFAULT_PAGES = 604
DEFAULT_OUTPUT = Path("public/data/quran/mushaf_word_layout_v4.json")


def fetch_page(
    page_number: int,
    *,
    mushaf: int,
    retries: int = 3,
    delay_sec: float = 0.35,
) -> dict[str, Any]:
    params = urllib.parse.urlencode(
        {
            "mushaf": mushaf,
            "words": "true",
            "word_fields": "code_v2,line_number,page_number,position,char_type_name,audio_url",
            "per_page": 50,
        }
    )
    url = f"{API_BASE}/verses/by_page/{page_number}?{params}"

    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "User-Agent": "Hafiz-Quran-App/1.0"},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries:
                raise RuntimeError(f"Failed to fetch page {page_number}: {exc}") from exc
            time.sleep(delay_sec * attempt)

    raise RuntimeError(f"Unreachable: page {page_number}")


def parse_verse_key(verse_key: str) -> tuple[int, int]:
    sura, aya = verse_key.split(":")
    return int(sura), int(aya)


def build_page_layout(api_response: dict[str, Any], page_number: int) -> dict[str, Any]:
    """Group all words on a page by line_number (mushaf line)."""
    lines: dict[int, list[dict[str, Any]]] = {}

    for verse in api_response.get("verses", []):
        verse_key = verse["verse_key"]
        sura, aya = parse_verse_key(verse_key)

        for word in verse.get("words", []):
            line_num = word.get("line_number")
            if line_num is None:
                continue

            entry = {
                "verse_key": verse_key,
                "sura": sura,
                "aya": aya,
                "word": word.get("position"),
                "location": f"{sura}:{aya}:{word.get('position')}",
                "line": line_num,
                "page": word.get("page_number", page_number),
                "code_v2": word.get("code_v2") or word.get("text", ""),
                "char_type": word.get("char_type_name", "word"),
            }
            if word.get("audio_url"):
                entry["audio_url"] = word["audio_url"]

            lines.setdefault(line_num, []).append(entry)

    sorted_lines = [
        {"line": line_num, "words": lines[line_num]}
        for line_num in sorted(lines.keys())
    ]

    return {"page": page_number, "lines": sorted_lines}


def fetch_all_pages(
    *,
    mushaf: int,
    start: int,
    end: int,
    delay_sec: float,
) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []

    for page_num in range(start, end + 1):
        print(f"Fetching page {page_num}/{end}...", file=sys.stderr)
        data = fetch_page(page_num, mushaf=mushaf)
        pages.append(build_page_layout(data, page_num))
        if delay_sec > 0:
            time.sleep(delay_sec)

    return pages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--page", type=int, help="Fetch a single page (e.g. 41)")
    parser.add_argument("--all", action="store_true", help="Fetch all mushaf pages (1-604)")
    parser.add_argument("--start", type=int, default=1, help="Start page (with --all)")
    parser.add_argument("--end", type=int, default=DEFAULT_PAGES, help="End page (with --all)")
    parser.add_argument(
        "--mushaf",
        type=int,
        default=DEFAULT_MUSHAF,
        help="Mushaf ID (19=Tajweed V4, 1=QCF V2). See Quran Foundation page layout docs.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--delay", type=float, default=0.35, help="Seconds between requests")
    args = parser.parse_args()

    if not args.page and not args.all:
        parser.error("Specify --page N or --all")

    if args.page:
        data = fetch_page(args.page, mushaf=args.mushaf)
        result = {
            "meta": {
                "mushaf": args.mushaf,
                "source": API_BASE,
                "page_count": 1,
            },
            "pages": [build_page_layout(data, args.page)],
        }
    else:
        pages = fetch_all_pages(
            mushaf=args.mushaf,
            start=args.start,
            end=args.end,
            delay_sec=args.delay,
        )
        result = {
            "meta": {
                "mushaf": args.mushaf,
                "source": API_BASE,
                "page_count": len(pages),
                "start": args.start,
                "end": args.end,
            },
            "pages": pages,
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

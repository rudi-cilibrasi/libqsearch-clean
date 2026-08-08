#!/usr/bin/env python3
"""Build the small, reproducible GRS 1915+105 workbench corpus.

The source archive is the CC BY 4.0 hand-annotated RXTE light-curve
collection published as Figshare article 4220409.  This script deliberately
uses an objective selection rule; it does not search for intervals that give
a preferred clustering result.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import tempfile
import urllib.request
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zipfile import ZipFile


ARCHIVE_URL = "https://ndownloader.figshare.com/files/6886539"
ARCHIVE_MD5 = "72f3ca22510b26a8c59d839185102982"
ARCHIVE_MAX_BYTES = 200 * 1024 * 1024
TARGET_CLASSES = ("delta", "gamma", "phi", "theta")
RECORDS_PER_CLASS = 4
SAMPLE_COUNT = 480
CADENCE_SECONDS = Decimal("0.125")
CADENCE_TOLERANCE_SECONDS = Decimal("0.00001")
CLASS_NAMES = {
    "delta": "Delta",
    "gamma": "Gamma",
    "phi": "Phi",
    "theta": "Theta",
}
SOURCE_FILE_PATTERN = re.compile(r"^classified_lcs/grs1915_lc(?P<index>\d+)\.txt$")
CLASS_HEADER_PATTERN = re.compile(r"^#\s*class\s*:\s*(?P<class>[a-z0-9]+)\s*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--archive",
        type=Path,
        help="Use an existing classified_lcs.zip instead of downloading it.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/corpora/astronomy/grs1915-rxte-v1"),
    )
    return parser.parse_args()


def md5_file(path: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download_archive(destination: Path) -> None:
    request = urllib.request.Request(
        ARCHIVE_URL,
        headers={"User-Agent": "CompLearn astronomy corpus builder/1.0"},
    )
    total = 0
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > ARCHIVE_MAX_BYTES:
                raise ValueError("Astronomy source archive exceeds the 200 MiB safety limit")
            output.write(chunk)


def quantize_tenth(value: str) -> str:
    decimal_value = Decimal(value)
    if not decimal_value.is_finite() or decimal_value < 0:
        raise ValueError(f"Invalid photon rate: {value}")
    return str(int((decimal_value * 10).to_integral_value(rounding=ROUND_HALF_UP)))


def find_first_window(lines: list[str], source_name: str) -> tuple[list[list[str]], Decimal]:
    rows: list[list[str]] = []
    for line_number, line in enumerate(lines[2:], start=3):
        columns = line.split()
        if len(columns) != 5:
            raise ValueError(f"{source_name}:{line_number}: expected five columns")
        try:
            numeric = [Decimal(value) for value in columns]
        except Exception as error:
            raise ValueError(f"{source_name}:{line_number}: invalid decimal value") from error
        if not all(value.is_finite() for value in numeric):
            raise ValueError(f"{source_name}:{line_number}: non-finite value")
        rows.append(columns)

    run_start = 0
    for index in range(1, len(rows)):
        previous = Decimal(rows[index - 1][0])
        current = Decimal(rows[index][0])
        if abs((current - previous) - CADENCE_SECONDS) > CADENCE_TOLERANCE_SECONDS:
            run_start = index
        if index - run_start + 1 >= SAMPLE_COUNT:
            window = rows[run_start : run_start + SAMPLE_COUNT]
            return window, Decimal(window[0][0])
    raise ValueError(f"{source_name}: no continuous {SAMPLE_COUNT}-sample window")


def serialize_window(window: list[list[str]]) -> bytes:
    # Preserve every released photon-rate band.  Mission time is omitted because
    # it is a constant-step coordinate and would add observation identity rather
    # than signal structure to the compressed object.
    lines = [",".join(quantize_tenth(value) for value in row[1:]) for row in window]
    return ("\n".join(lines) + "\n").encode("ascii")


def build(archive_path: Path, output: Path) -> None:
    if md5_file(archive_path) != ARCHIVE_MD5:
        raise ValueError("Source archive MD5 does not match Figshare file 6886539")

    candidates: dict[str, list[tuple[int, str, bytes, Decimal]]] = defaultdict(list)
    with ZipFile(archive_path) as archive:
        indexed_names: list[tuple[int, str]] = []
        for name in archive.namelist():
            match = SOURCE_FILE_PATTERN.fullmatch(name)
            if match:
                indexed_names.append((int(match.group("index")), name))
        for source_index, source_name in sorted(indexed_names):
            text = archive.read(source_name).decode("ascii")
            lines = text.splitlines()
            if len(lines) < 3:
                raise ValueError(f"{source_name}: truncated light curve")
            header = CLASS_HEADER_PATTERN.fullmatch(lines[0])
            if not header:
                raise ValueError(f"{source_name}: invalid class header")
            class_name = header.group("class")
            if class_name not in TARGET_CLASSES or len(candidates[class_name]) >= RECORDS_PER_CLASS:
                continue
            window, start_time = find_first_window(lines, source_name)
            candidates[class_name].append(
                (source_index, source_name, serialize_window(window), start_time)
            )

    missing = [name for name in TARGET_CLASSES if len(candidates[name]) != RECORDS_PER_CLASS]
    if missing:
        raise ValueError(f"Unable to select four records for: {', '.join(missing)}")

    records_dir = output / "records"
    records_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    expected_assets: set[str] = set()
    for class_name in TARGET_CLASSES:
        for ordinal, (source_index, source_name, content, start_time) in enumerate(
            candidates[class_name], start=1
        ):
            sha256 = hashlib.sha256(content).hexdigest()
            asset = f"{class_name}-{source_index:03d}.{sha256[:16]}.csv"
            expected_assets.add(asset)
            (records_dir / asset).write_bytes(content)
            records.append(
                {
                    "id": f"astronomy:grs1915:{class_name}:{source_index:03d}",
                    "label": f"{CLASS_NAMES[class_name]} {ordinal}",
                    "class": class_name,
                    "classOrdinal": ordinal,
                    "sourceIndex": source_index,
                    "sourceFile": source_name,
                    "startMissionSeconds": str(start_time),
                    "sampleCount": SAMPLE_COUNT,
                    "cadenceSeconds": float(CADENCE_SECONDS),
                    "asset": asset,
                    "sha256": sha256,
                    "utf8Bytes": len(content),
                }
            )

    stale = sorted(path.name for path in records_dir.glob("*.csv") if path.name not in expected_assets)
    if stale:
        raise ValueError(
            "Refusing to leave stale immutable assets in the corpus: " + ", ".join(stale)
        )

    manifest = {
        "schemaVersion": "astronomy-corpus-v1",
        "datasetId": "grs1915-rxte-public-analogue-v1",
        "title": "GRS 1915+105 public RXTE light-curve example",
        "source": {
            "repository": "Figshare",
            "articleId": 4220409,
            "fileId": 6886539,
            "url": "https://figshare.com/articles/dataset/4220409",
            "downloadUrl": ARCHIVE_URL,
            "archiveMd5": ARCHIVE_MD5,
            "published": "2016-11-10",
            "authors": [
                "Daniela Huppenkothen",
                "Lucy M. Heil",
                "David W. Hogg",
                "Andreas Müller",
            ],
            "license": "CC BY 4.0",
        },
        "paperContext": {
            "paper": "Cilibrasi and Vitányi, Clustering by Compression (2005)",
            "figure": 20,
            "exactReproduction": False,
            "note": (
                "The paper's privately supplied 16 intervals are not identified by public "
                "RXTE observation IDs. This corpus is a reproducible public analogue from "
                "the same source object and the same four Belloni classes."
            ),
        },
        "selection": {
            "classes": list(TARGET_CLASSES),
            "recordsPerClass": RECORDS_PER_CLASS,
            "sampleCount": SAMPLE_COUNT,
            "cadenceSeconds": float(CADENCE_SECONDS),
            "durationSeconds": float(CADENCE_SECONDS * SAMPLE_COUNT),
            "rule": (
                "For each class in delta, gamma, phi, theta, sort source files by numeric "
                "index; choose the first four containing a continuous 480-sample run; use "
                "the first such run."
            ),
        },
        "encoding": {
            "format": "headerless CSV",
            "columns": ["total", "low", "mid", "high"],
            "quantization": "photon rates multiplied by 10 and rounded half-up to integers",
            "lineEnding": "LF",
            "metadataExcludedFromCompressedObject": True,
        },
        "records": records,
    }
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    (output / "manifest.json").write_bytes(manifest_bytes)


def main() -> None:
    args = parse_args()
    if args.archive:
        build(args.archive.resolve(), args.output.resolve())
        return
    with tempfile.TemporaryDirectory(prefix="complearn-astronomy-") as temp_dir:
        archive_path = Path(temp_dir) / "classified_lcs.zip"
        download_archive(archive_path)
        build(archive_path, args.output.resolve())


if __name__ == "__main__":
    main()

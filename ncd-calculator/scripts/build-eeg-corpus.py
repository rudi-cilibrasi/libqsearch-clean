#!/usr/bin/env python3
"""Build a small, deterministic P300 corpus from a local BIDS EEG dataset.

The browser never parses raw EEG. This offline builder uses MNE for filtering,
referencing, epoching, artifact rejection, and averaging, then emits a bounded
manifest plus canonical ASCII signal objects suitable for NCD.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np

try:
    import mne
except ImportError as exc:  # pragma: no cover - exercised by CLI users
    raise SystemExit(
        "MNE is required. Install scripts/requirements-eeg.txt in an isolated environment."
    ) from exc


SCHEMA_VERSION = "complearn-eeg-manifest-v1"
ASCII_SCHEMA = "complearn-eeg-ascii-v1"
CREATED_AT = "2026-08-10T00:00:00.000Z"
OUTPUT_SAMPLING_HZ = 128.0
EPOCH_WINDOW = (-0.2, 0.6)
BASELINE_WINDOW = (-0.2, 0.0)
BANDPASS_HZ = (0.5, 10.0)
REJECTION_VOLTS = 200e-6
SEGMENTS_PER_OBJECT = 3
EPOCHS_PER_SEGMENT = 3
CONDITION_REPLICATES = 8
CONDITION_CHANNEL = "Pz"
ELECTRODE_CHANNELS = ("Fz", "FCz", "Cz", "CPz", "Pz", "POz", "C3", "C4")
INTEGER_WIDTH = 5
QUANTIZATION_SCALE = 100
CLIP_ABSOLUTE = 9999
SUPPORTED_EXTENSIONS = (".set", ".edf", ".bdf", ".vhdr", ".fif")
TARGET_VALUES = {"oddball", "oddball_with_reponse", "oddball_with_response", "target"}
STANDARD_VALUES = {"standard"}


@dataclass(frozen=True)
class ConditionEpochs:
    values: np.ndarray
    candidate_count: int
    accepted_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bids-root", required=True, type=Path, help="Local BIDS dataset root")
    parser.add_argument("--output", required=True, type=Path, help="Corpus output directory")
    parser.add_argument("--subject", default="001")
    parser.add_argument("--task", default="P300")
    parser.add_argument("--run", default="1")
    parser.add_argument("--eeg-file", type=Path, help="Explicit BIDS EEG recording, if discovery is ambiguous")
    parser.add_argument("--dataset-id", help="Stable dataset identifier; inferred from an OpenNeuro DOI when possible")
    parser.add_argument("--dataset-version", help="Dataset version; inferred from an OpenNeuro DOI when possible")
    parser.add_argument("--dataset-doi", help="Dataset DOI when dataset_description.json omits it")
    parser.add_argument("--dataset-url", help="Public HTTPS dataset URL; optional for private datasets")
    parser.add_argument("--corpus-id", help="Stable output corpus identifier")
    parser.add_argument("--created-at", default=CREATED_AT, help="Deterministic ISO-8601 derivative release time")
    parser.add_argument("--package", type=Path, help="Also write a self-contained .complearn-eeg.json package")
    parser.add_argument("--force", action="store_true", help="Replace an existing generated corpus directory")
    return parser.parse_args()


def fail(message: str) -> "NoReturn":
    raise SystemExit(message)


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Unable to read {path}: {exc}")
    if not isinstance(value, dict):
        fail(f"Expected a JSON object in {path}.")
    return value


def discover_recording(root: Path, subject: str, task: str, run: str) -> Path:
    eeg_directory = root / f"sub-{subject}" / "eeg"
    prefix = f"sub-{subject}_task-{task}_run-{run}_eeg"
    matches = [eeg_directory / f"{prefix}{extension}" for extension in SUPPORTED_EXTENSIONS]
    existing = [path for path in matches if path.is_file()]
    if len(existing) != 1:
        fail(f"Expected one BIDS EEG recording for {prefix}; found {len(existing)}.")
    return existing[0]


def read_raw(path: Path) -> mne.io.BaseRaw:
    readers = {
        ".set": mne.io.read_raw_eeglab,
        ".edf": mne.io.read_raw_edf,
        ".bdf": mne.io.read_raw_bdf,
        ".vhdr": mne.io.read_raw_brainvision,
        ".fif": mne.io.read_raw_fif,
    }
    reader = readers.get(path.suffix.lower())
    if reader is None:
        fail(f"Unsupported EEG format {path.suffix}; expected one of {SUPPORTED_EXTENSIONS}.")
    try:
        return reader(path, preload=True, verbose="ERROR")
    except Exception as exc:  # MNE exposes format-specific exception types
        fail(f"MNE could not read {path}: {exc}")


def events_path_for(eeg_path: Path) -> Path:
    name = re.sub(r"_eeg\.[^.]+$", "_events.tsv", eeg_path.name)
    path = eeg_path.with_name(name)
    if not path.is_file():
        fail(f"Missing required BIDS events sidecar: {path}")
    return path


def load_event_onsets(path: Path) -> dict[str, list[float]]:
    result = {"target": [], "standard": []}
    try:
        with path.open("r", encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream, delimiter="\t")
            if reader.fieldnames is None or "onset" not in reader.fieldnames:
                fail(f"{path} does not contain a BIDS onset column.")
            label_column = "value" if "value" in reader.fieldnames else "trial_type"
            for row in reader:
                value = (row.get(label_column) or "").strip().lower()
                condition = "target" if value in TARGET_VALUES else "standard" if value in STANDARD_VALUES else None
                if condition is None:
                    continue
                try:
                    onset = float(row["onset"])
                except (TypeError, ValueError):
                    fail(f"Invalid onset in {path}: {row.get('onset')!r}")
                if not math.isfinite(onset) or onset < 0:
                    fail(f"Invalid onset in {path}: {onset!r}")
                result[condition].append(onset)
    except OSError as exc:
        fail(f"Unable to read {path}: {exc}")
    if not result["target"] or not result["standard"]:
        fail("The events sidecar must contain both target/oddball and standard events.")
    return result


def prepare_epochs(raw: mne.io.BaseRaw, event_onsets: dict[str, list[float]]) -> dict[str, ConditionEpochs]:
    required = {CONDITION_CHANNEL, *ELECTRODE_CHANNELS}
    missing = sorted(required.difference(raw.ch_names))
    if missing:
        fail(f"Recording is missing required channels: {', '.join(missing)}")
    source_sampling_hz = float(raw.info["sfreq"])
    if source_sampling_hz <= 2 * BANDPASS_HZ[1]:
        fail("Source sampling rate is too low for the requested 10 Hz low-pass filter.")

    raw.pick(sorted(required))
    raw.set_eeg_reference("average", projection=False, verbose="ERROR")
    raw.filter(*BANDPASS_HZ, method="fir", phase="zero", verbose="ERROR")
    raw.resample(OUTPUT_SAMPLING_HZ, npad="auto", verbose="ERROR")

    output: dict[str, ConditionEpochs] = {}
    event_id = {"target": 1, "standard": 2}
    for condition in ("target", "standard"):
        samples = np.asarray(
            [int(round((onset - float(raw.first_time)) * OUTPUT_SAMPLING_HZ)) for onset in event_onsets[condition]],
            dtype=int,
        )
        samples = samples[(samples >= 0) & (samples < raw.n_times)]
        events = np.column_stack((samples, np.zeros(samples.size, dtype=int), np.full(samples.size, event_id[condition], dtype=int)))
        epochs = mne.Epochs(
            raw,
            events,
            event_id={condition: event_id[condition]},
            tmin=EPOCH_WINDOW[0],
            tmax=EPOCH_WINDOW[1],
            baseline=BASELINE_WINDOW,
            preload=True,
            reject={"eeg": REJECTION_VOLTS},
            event_repeated="drop",
            verbose="ERROR",
        )
        values = epochs.get_data(copy=True) * 1e6
        output[condition] = ConditionEpochs(values=values, candidate_count=len(samples), accepted_count=len(values))
    return output


def standard_positions(channel_names: Sequence[str]) -> dict[str, dict[str, Any]]:
    montage = mne.channels.make_standard_montage("standard_1020")
    positions = montage.get_positions()["ch_pos"]
    coordinates: dict[str, dict[str, Any]] = {}
    max_radius = max(math.hypot(float(positions[name][0]), float(positions[name][1])) for name in channel_names)
    for name in channel_names:
        xyz = positions[name]
        coordinates[name] = {
            "name": name,
            "x": round(float(xyz[0]) / max_radius, 6),
            "y": round(float(xyz[1]) / max_radius, 6),
            "coordinateSource": "MNE standard_1020; visualization only",
        }
    return coordinates


def average_segments(epochs: np.ndarray, channel_index: int, start: int, count: int) -> list[np.ndarray]:
    required = SEGMENTS_PER_OBJECT * EPOCHS_PER_SEGMENT
    if count < required or start + required > len(epochs):
        fail(f"Not enough accepted epochs: need indices {start}..{start + required - 1}, found {len(epochs)}.")
    output: list[np.ndarray] = []
    for segment in range(SEGMENTS_PER_OBJECT):
        first = start + segment * EPOCHS_PER_SEGMENT
        average = epochs[first:first + EPOCHS_PER_SEGMENT, channel_index, :].mean(axis=0)
        standard_deviation = float(average.std())
        if not math.isfinite(standard_deviation) or standard_deviation <= 1e-12:
            fail("An averaged EEG segment has zero or invalid variance.")
        output.append((average - average.mean()) / standard_deviation)
    return output


def round_half_away(value: float) -> int:
    return math.floor(value + 0.5) if value >= 0 else math.ceil(value - 0.5)


def serialize_segments(segments: Sequence[np.ndarray]) -> str:
    rows: list[str] = []
    expected_samples = len(segments[0])
    for segment_index, segment in enumerate(segments):
        if len(segment) != expected_samples:
            fail("EEG segments must have equal sample counts.")
        if segment_index:
            rows.append("--")
        for value in segment:
            if not math.isfinite(float(value)):
                fail("EEG segments contain a non-finite sample.")
            integer = round_half_away(float(value) * QUANTIZATION_SCALE)
            integer = max(-CLIP_ABSOLUTE, min(CLIP_ABSOLUTE, integer))
            rows.append(f"{'-' if integer < 0 else '+'}{abs(integer):0{INTEGER_WIDTH}d}")
    return "\n".join(rows) + "\n"


def qc_for(segments: Sequence[np.ndarray], condition_epochs: ConditionEpochs) -> dict[str, Any]:
    flattened = np.concatenate(segments)
    preview = np.mean(np.stack(segments), axis=0)
    return {
        "candidateEpochs": condition_epochs.candidate_count,
        "acceptedEpochs": condition_epochs.accepted_count,
        "rejectedEpochs": condition_epochs.candidate_count - condition_epochs.accepted_count,
        "minimum": round(float(flattened.min()), 6),
        "maximum": round(float(flattened.max()), 6),
        "rms": round(float(np.sqrt(np.mean(np.square(flattened)))), 6),
        "peakToPeak": round(float(np.ptp(flattened)), 6),
        "preview": [round(float(value), 6) for value in preview],
    }


def build_record(
    *,
    object_id: str,
    label: str,
    revealed_label: str,
    mode: str,
    condition: str,
    replicate: int,
    electrode: dict[str, Any],
    segments: Sequence[np.ndarray],
    condition_epochs: ConditionEpochs,
) -> tuple[dict[str, Any], str]:
    content = serialize_segments(segments)
    digest = hashlib.sha256(content.encode("ascii")).hexdigest()
    asset = f"{object_id.replace(':', '-')}.{digest[:16]}.eeg.txt"
    record = {
        "id": object_id,
        "label": label,
        "revealedLabel": revealed_label,
        "mode": mode,
        "condition": condition,
        "replicate": replicate,
        "electrode": electrode,
        "sampleCount": sum(len(segment) for segment in segments),
        "samplesPerSegment": len(segments[0]),
        "segmentCount": len(segments),
        "asset": asset,
        "sha256": digest,
        "utf8Bytes": len(content.encode("ascii")),
        "qc": qc_for(segments, condition_epochs),
    }
    return record, content


def condition_order_key(record_and_content: tuple[dict[str, Any], str]) -> str:
    return hashlib.sha256(record_and_content[0]["id"].encode("ascii")).hexdigest()


def safe_identifier(value: str, description: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-.")
    if not normalized or len(normalized) > 64:
        fail(f"{description} must contain a safe identifier of at most 64 characters.")
    return normalized


def build_records(raw: mne.io.BaseRaw, epochs: dict[str, ConditionEpochs], dataset_id: str) -> list[tuple[dict[str, Any], str]]:
    positions = standard_positions(ELECTRODE_CHANNELS)
    records: list[tuple[dict[str, Any], str]] = []
    pz_index = raw.ch_names.index(CONDITION_CHANNEL)

    condition_records: list[tuple[dict[str, Any], str]] = []
    required_per_object = SEGMENTS_PER_OBJECT * EPOCHS_PER_SEGMENT
    for condition in ("target", "standard"):
        condition_epochs = epochs[condition]
        required_total = CONDITION_REPLICATES * required_per_object
        if condition_epochs.accepted_count < required_total:
            fail(f"{condition} has {condition_epochs.accepted_count} accepted epochs; {required_total} are required.")
        for replicate in range(1, CONDITION_REPLICATES + 1):
            segments = average_segments(condition_epochs.values, pz_index, (replicate - 1) * required_per_object, required_per_object)
            condition_records.append(build_record(
                object_id=f"eeg:{dataset_id}:condition:{condition}:{replicate:02d}",
                label="pending",
                revealed_label=f"{'Target' if condition == 'target' else 'Standard'} {replicate}",
                mode="condition",
                condition=condition,
                replicate=replicate,
                electrode=positions[CONDITION_CHANNEL],
                segments=segments,
                condition_epochs=condition_epochs,
            ))
    condition_records.sort(key=condition_order_key)
    for ordinal, (record, content) in enumerate(condition_records, start=1):
        record["label"] = f"Condition object {ordinal:02d}"
        records.append((record, content))

    for channel in ELECTRODE_CHANNELS:
        ordered_conditions = sorted(("target", "standard"), key=lambda value: hashlib.sha256(f"{channel}:{value}".encode("ascii")).hexdigest())
        for letter, condition in zip(("A", "B"), ordered_conditions, strict=True):
            condition_epochs = epochs[condition]
            channel_index = raw.ch_names.index(channel)
            segments = average_segments(condition_epochs.values, channel_index, 0, required_per_object)
            records.append(build_record(
                object_id=f"eeg:{dataset_id}:electrode:{channel.lower()}:{condition}",
                label=f"{channel} · object {letter}",
                revealed_label=f"{channel} · {'target' if condition == 'target' else 'standard'}",
                mode="electrode",
                condition=condition,
                replicate=1,
                electrode=positions[channel],
                segments=segments,
                condition_epochs=condition_epochs,
            ))
    return records


def resolve_dataset_identity(dataset: dict[str, Any], root: Path, args: argparse.Namespace) -> dict[str, Any]:
    dataset_doi = str(args.dataset_doi or dataset.get("DatasetDOI") or "").removeprefix("doi:") or None
    openneuro_match = re.fullmatch(r"10\.18112/openneuro\.(ds\d+)\.v(.+)", dataset_doi or "")
    dataset_id = safe_identifier(args.dataset_id or (openneuro_match.group(1) if openneuro_match else root.name), "Dataset ID")
    dataset_version = str(args.dataset_version or (openneuro_match.group(2) if openneuro_match else dataset.get("DatasetVersion") or "unversioned")).strip()
    if not dataset_version or len(dataset_version) > 64:
        fail("Dataset version must contain between 1 and 64 characters.")
    corpus_id = safe_identifier(args.corpus_id or f"{dataset_id}-p300-derived-v1", "Corpus ID")
    dataset_url = args.dataset_url or (
        f"https://openneuro.org/datasets/{dataset_id}/versions/{dataset_version}" if openneuro_match else None
    )
    if dataset_url is not None and not dataset_url.startswith("https://"):
        fail("Dataset URL must use HTTPS.")
    try:
        datetime.fromisoformat(args.created_at.replace("Z", "+00:00"))
    except ValueError:
        fail("--created-at must be a valid ISO-8601 timestamp.")
    return {
        "dataset_id": dataset_id,
        "dataset_version": dataset_version,
        "dataset_doi": dataset_doi,
        "dataset_url": dataset_url,
        "corpus_id": corpus_id,
        "created_at": args.created_at,
    }


def manifest_metadata(dataset: dict[str, Any], raw: mne.io.BaseRaw, subject: str, task: str, run: str, identity: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "corpusId": identity["corpus_id"],
        "createdAt": identity["created_at"],
        "source": {
            "datasetId": identity["dataset_id"],
            "datasetVersion": identity["dataset_version"],
            "name": str(dataset.get("Name") or "EEG data from an auditory oddball task"),
            "doi": identity["dataset_doi"],
            "url": identity["dataset_url"],
            "license": str(dataset.get("License") or "CC0"),
            "subject": subject,
            "task": task,
            "run": run,
            "exactPaperReproduction": False,
        },
        "preprocessing": {
            "software": f"MNE-Python {mne.__version__}; CompLearn EEG builder v1",
            "bandpassHz": list(BANDPASS_HZ),
            "reference": "average of selected EEG channels",
            "sourceSamplingHz": float(raw.info["sfreq"]),
            "outputSamplingHz": OUTPUT_SAMPLING_HZ,
            "epochWindowSeconds": list(EPOCH_WINDOW),
            "baselineWindowSeconds": list(BASELINE_WINDOW),
            "rejectionPeakToPeakMicrovolts": REJECTION_VOLTS * 1e6,
            "averaging": {
                "segmentsPerObject": SEGMENTS_PER_OBJECT,
                "epochsPerSegment": EPOCHS_PER_SEGMENT,
            },
            "normalization": "z-score-each-average",
        },
        "encoding": {
            "schemaVersion": ASCII_SCHEMA,
            "quantizationScale": QUANTIZATION_SCALE,
            "integerWidth": INTEGER_WIDTH,
            "clipAbsolute": CLIP_ABSOLUTE,
            "segmentSeparator": "--",
            "lineEnding": "LF",
        },
    }


def write_outputs(output: Path, package: Path | None, metadata: dict[str, Any], records: list[tuple[dict[str, Any], str]], force: bool) -> None:
    if output.exists() and any(output.iterdir()) and not force:
        fail(f"Output directory {output} is not empty; pass --force to replace generated files.")
    if output.exists() and force:
        for path in output.rglob("*"):
            if path.is_file() and (path.name == "manifest.json" or path.name.endswith(".eeg.txt")):
                path.unlink()
    records_directory = output / "records"
    records_directory.mkdir(parents=True, exist_ok=True)
    for record, content in records:
        (records_directory / record["asset"]).write_text(content, encoding="ascii", newline="\n")
    manifest = {**metadata, "records": [record for record, _content in records]}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="ascii", newline="\n")
    if package is not None:
        package.parent.mkdir(parents=True, exist_ok=True)
        portable_records = [{**record, "content": content} for record, content in records]
        package.write_text(json.dumps({**metadata, "records": portable_records}, indent=2, ensure_ascii=True) + "\n", encoding="ascii", newline="\n")


def main() -> None:
    args = parse_args()
    root = args.bids_root.resolve()
    if not root.is_dir():
        fail(f"BIDS root does not exist: {root}")
    dataset_path = root / "dataset_description.json"
    dataset = read_json(dataset_path)
    identity = resolve_dataset_identity(dataset, root, args)
    eeg_path = args.eeg_file.resolve() if args.eeg_file else discover_recording(root, args.subject, args.task, args.run)
    if root not in eeg_path.parents:
        fail("The selected EEG recording must be inside the BIDS root.")
    raw = read_raw(eeg_path)
    source_sampling_hz = float(raw.info["sfreq"])
    event_onsets = load_event_onsets(events_path_for(eeg_path))
    epochs = prepare_epochs(raw, event_onsets)
    records = build_records(raw, epochs, identity["dataset_id"])
    metadata = manifest_metadata(dataset, raw, args.subject, args.task, args.run, identity)
    metadata["preprocessing"]["sourceSamplingHz"] = source_sampling_hz
    write_outputs(args.output.resolve(), args.package.resolve() if args.package else None, metadata, records, args.force)
    print(f"Wrote {len(records)} verified EEG objects to {args.output}")


if __name__ == "__main__":
    main()

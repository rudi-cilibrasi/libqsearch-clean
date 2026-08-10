# EEG analysis

Updated 2026-08-10 (Asia/Ho_Chi_Minh).

## Scope and scientific claim

CompLearn includes a small auditory-oddball EEG workflow to test whether normalized compression distance can recover useful signal structure without a domain-specific feature extractor. The built-in data are derived from subject 001, run 1 of [OpenNeuro `ds003061` version 1.1.2](https://openneuro.org/datasets/ds003061/versions/1.1.2), an auditory oddball dataset released under CC0 with DOI `10.18112/openneuro.ds003061.v1.1.2`. The committed derivative is a public analogue for studying P300-like condition differences. It is not an exact reproduction of Sarasa et al.'s 2019 experiment, which used different BCI Competition recordings and preprocessing choices.

The feature is exploratory research software. It does not diagnose a person, establish whether an EEG recording is clinically normal, localize a neural source, or measure neural activation. The scalp map displays paired object distances at sensor locations. A larger distance means that the selected compressor found a larger difference between the two serialized sensor waveforms; it does not mean that the underlying cortex was more active.

## Data flow and leakage boundary

Raw BIDS files are handled only by the offline Python builder. The browser receives small derived objects, a typed manifest, and integrity metadata. The pipeline is:

```text
BIDS EEG + events.tsv
        |
        v
offline MNE filtering, reference, epoch rejection, averaging
        |
        v
z-scored fixed-length segments
        |
        v
fixed-width signed ASCII values + constant "--" boundaries
        |
        v
SHA-256 verification -> compression -> NCD -> quartet tree
        |
        v
optional label reveal and baseline evaluation
```

The compressed object contains one signed, zero-padded integer per line and the same `--` separator between averaged segments. It contains no header, condition name, subject identifier, channel name, timestamp, BIDS filename, QC value, or source metadata. Quantization uses a scale of 100, symmetric round-half-away-from-zero, clipping at ±9999, an explicit sign, five magnitude digits, and LF line endings. This gives every object the same syntactic framing and prevents condition labels from becoming an accidental shortcut for the compressor. `src/services/eegSerializer.ts` is the browser reference implementation; the Python builder implements the same contract. The corpus verifier checks every row, shape, byte count, and SHA-256 digest.

The manifest keeps information that must remain inspectable but must not enter compression: dataset/version/DOI/license, subject/task/run, MNE version, filter and reference settings, source and output sampling rates, epoch and baseline windows, rejection threshold, averaging design, electrode display coordinates, blinded and revealed labels, waveform QC, asset name, byte count, and checksum. The NCD experiment export retains this provenance beside the exact ASCII object.

## Built-in corpus construction

The current builder selects `sub-001_task-P300_run-1_eeg.set` and its BIDS events sidecar. It supports EEGLAB `.set`, EDF, BDF, BrainVision `.vhdr`, and MNE FIF recordings. Events named `oddball`, `oddball_with_reponse`, `oddball_with_response`, or `target` enter the target condition; `standard` enters the standard condition. Unsupported event semantics fail rather than being guessed.

The fixed preprocessing recipe is a 0.5–10 Hz zero-phase FIR filter, average reference over the selected channels, resampling to 128 Hz, epochs from −0.2 through 0.6 seconds, baseline correction from −0.2 through 0 seconds, and peak-to-peak rejection at 200 µV. Each serialized segment averages three accepted epochs and is z-scored independently. Each object concatenates three such averages. Condition mode creates eight non-overlapping Pz objects per condition. Electrode mode creates one target and one standard object for each of Fz, FCz, Cz, CPz, Pz, POz, C3, and C4. Standard 10–20 coordinates supplied by MNE are used only to position symbols in the visualization.

The committed snapshot contains 32 objects: 16 condition objects and 16 electrode objects. The source recording supplied 522 standard events, of which 521 passed rejection in this recipe. The builder also records the corresponding target counts in every relevant object. Only 16 objects are loaded for one browser calculation, keeping the unauthenticated interactive path within its object limit.

Create an isolated environment and build from a local BIDS checkout. The requirements pin the exact MNE and NumPy versions used for the committed derivative so a dependency update cannot silently redefine the corpus:

```bash
python3 -m venv .venv-eeg
.venv-eeg/bin/pip install -r scripts/requirements-eeg.txt
.venv-eeg/bin/python scripts/build-eeg-corpus.py \
  --bids-root /path/to/ds003061 \
  --subject 001 --task P300 --run 1 \
  --output public/corpora/eeg/ds003061-p300-v1
npm run eeg:verify
```

The output directory must be empty unless `--force` is given. Even with `--force`, the builder removes only its known `manifest.json` and `*.eeg.txt` generated assets. Missing sidecars, ambiguous recordings, missing required electrodes, invalid event onsets, too-low sampling frequency, insufficient accepted epochs, zero-variance averages, and non-finite samples stop the build before publication.

## Condition mode and label reveal

Condition mode assigns neutral presentation names such as `Condition object 01`. The order is deterministic but does not group the visible items by condition. NCD, the full matrix, and QSearch finish before the EEG analysis control reveals target and standard metadata. The quartet tree remains the first result view. Directly below it, a condition-blind envelope shows the minimum, maximum, and mean waveform across the selected objects, followed by object-shape, rejection, provenance, and checksum summaries.

After label reveal, the interface calculates leave-one-out 1-nearest-neighbor accuracy, balanced accuracy, and macro F1 from the already-computed NCD matrix. It also reports three conventional waveform baselines on exactly the same condition-blind mean previews: root-mean-square Euclidean distance, Pearson correlation distance, and dynamic time warping with absolute-error cost. These baselines answer a necessary research question: does compression distance add useful discrimination beyond simple amplitude/shape comparisons on this particular derivative?

The evaluation is descriptive and uses objects derived from one recording. It is not a subject-independent holdout study. Objects within a condition share a participant, acquisition environment, preprocessing recipe, and source recording, so the numerical score must not be described as population generalization. A research study should repeat the complete object construction across held-out participants and report uncertainty across subjects, compressors, and preprocessing choices.

## Electrode mode and scalp map

Electrode mode loads paired target and standard objects at eight sensors. The analysis view shows the NCD for each pair alongside Euclidean, correlation, and DTW distances. Five discrete, labeled shades avoid implying continuous source localization, and an accessible table provides every value without relying on position or color. Each electrode symbol is keyboard-focusable and exposes its name and NCD to assistive technology.

This mode asks which recorded channels carry a compressor-visible difference under one fixed preprocessing and averaging recipe. It cannot distinguish neural activity from ocular/muscle artifact, reference effects, volume conduction, unequal noise, or preprocessing interactions. Topographic interpolation is intentionally absent because eight distance values do not justify a smooth physiological field.

## Researcher-provided BIDS data

Researcher import is deliberately the final stage, after the same builder, serializer, integrity checks, result context, and evaluation path have been exercised by the pinned example. Pass `--package` to create a self-contained derivative:

```bash
.venv-eeg/bin/python scripts/build-eeg-corpus.py \
  --bids-root /path/to/study \
  --subject 001 --task P300 --run 1 \
  --dataset-id my-study --dataset-version 2026.1 \
  --output /tmp/study-eeg-corpus \
  --package /tmp/study.complearn-eeg.json
```

In the P300 EEG source, expand **Use a researcher-provided BIDS dataset** and import that package. The browser rejects packages larger than 2 MiB, malformed manifests, unsafe or duplicate identifiers, more than 16 records per mode, invalid preprocessing/encoding metadata, non-finite QC, unequal waveform shapes, byte-count mismatches, and checksum failures. This is BIDS-derived import, not arbitrary raw-file upload. Keeping MNE and raw-data parsing offline makes failures reproducible, avoids downloading sensitive recordings into a web page, and gives the researcher a chance to inspect epoch rejection before clustering.

The current builder is intentionally narrow: it requires the oddball/standard event vocabulary and the fixed eight-channel set. A different paradigm, montage, epoch policy, or clinical workflow should introduce a new typed corpus contract rather than silently mapping incompatible data into this one.

## Verification and useful failure scenarios

`npm run eeg:verify` checks the committed manifest and all 32 assets and runs automatically in the production build. Unit tests cover symmetric quantization, LF-only serialization, round trips, ragged/non-finite rejection, built-in and portable-package integrity, a perfect-label-separation matrix, a deterministic tie/weak-separation matrix, malformed matrices, all three waveform baselines, label hiding/reveal, waveform provenance, the accessible scalp-table alternative, and an axe-core WCAG A/AA scan. `npm run build` verifies the corpus before compiling the application.

The most useful negative controls for a paper are label permutation after distance computation, segment-order perturbation, time reversal, alternative compressors, changed averaging depth, and subject-held-out evaluation. If NCD performance collapses under harmless serialization changes, differs substantially across compressors, or does not beat correlation/DTW, that is a result about the empirical compressor and representation—not evidence against the ideal universal similarity metric.

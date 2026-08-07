# Third-party notices

## Unicode UDHR Project corpus

The files under `public/udhr/v2/records/*.txt` and the pinned source index under `public/udhr/v2/source/` are transformed extracts or source metadata from the Unicode UDHR Project data at commit `588b3f4b2d0467aff54842a4b926551b69d5a66a`:

- Project repository: <https://github.com/eric-muller/udhr>
- Upstream authority identified by the source records: United Nations Human Rights (OHCHR)
- OHCHR translations: <https://www.ohchr.org/en/human-rights/universal-declaration/translations>
- License displayed by the Unicode UDHR Project: [Creative Commons Attribution-ShareAlike 2.0](https://creativecommons.org/licenses/by-sa/2.0/)

The extracts contain available article body text. Preambles, notes, and headings are excluded, paragraph boundaries within each article are collapsed, and the result is normalized to Unicode NFC. Five source records with incomplete Articles 1–30 coverage are retained for provenance but marked ineligible for NCD comparison. Exact provenance, transformations, integrity metadata, audit findings, and reproducibility instructions are recorded in `src/generated/udhr-manifest-v2.json`, `src/generated/udhr-audit-v2.json`, and `docs/UDHR_CORPUS.md`.

# UDHR grouped language browser

Updated 2026-08-07 (Asia/Ho_Chi_Minh).

## Purpose

The corpus contains 501 source records but only 431 ISO 639-3 language identifiers. A flat 501-row selector repeats language names and makes variants look like accidental duplicates. A one-record-per-language selector has the opposite problem: it hides scripts, editions, regions, orthographies, and other source distinctions and can silently choose a record that the user did not intend.

The grouped browser presents one concise row for each language identifier and makes record choice explicit only where it is necessary. Stable record identity remains separate from every label shown to the user.

## Group contract

`UDHR_LANGUAGE_GROUPS` is derived deterministically from the versioned manifest. It contains 431 groups and all 501 records exactly once. Forty-six groups contain multiple records: 116 records in total, or 70 records beyond a one-record-per-language view. The other 385 groups contain one record and can be added directly.

Each group has:

```text
id                      ISO 639-3 language-group identifier
name                    concise group label
records                 every source record in source-key order
comparisonReadyRecords  records allowed into aligned NCD computation
```

Concise names use the reviewed compatibility name when one exists, otherwise the record whose source key equals the language ID, otherwise the shortest source name after removing one trailing variant qualifier. This rule is data-driven and deterministic. It produces 431 unique group names in the pinned snapshot.

The `und` group needs special interpretation. Its nine records have an upstream language identifier of `und`, but they are not asserted to be linguistic variants of one language. The interface therefore calls the group **Unclassified records** and requires an explicit source-record choice. This preserves the upstream identity limitation instead of inventing language codes.

## Variant selection

A multi-record group is a disclosure control with `aria-expanded` and `aria-controls`. Opening it shows every source record. The browser never adds a default variant when a multi-record group row is selected, because array order is not a scientific criterion for choosing a canonical text.

Comparison-ineligible records remain visible with an **Unavailable** status and an accessible label explaining that they cannot be compared. Their controls are disabled. This applies to the five audited records without complete Articles 1–30 coverage. Visibility preserves the 501-record provenance trail; disabling prevents accidental use in aligned NCD.

Selections use canonical `udhr:<source-key>` IDs. More than one record from a group may be selected, and only the exact selected record becomes disabled. This supports controlled comparisons between scripts or editions without collapsing their identity.

## Presentation-label contract

The comparison pipeline carries two parallel values:

```text
object ID      stable canonical identity used by caches, compression, and QSearch
display label  human-readable identity used by the selected list, matrix, K-grid, and tree
```

For a single-record group, the display label is the concise group name. For a multi-record group, it is the exact distinguishing source name. If two source records still have the same name, the immutable source key is appended in brackets. In the current snapshot this is required for the Malayalam and Venda pairs, producing labels such as `Malayalam [mal]` and `Malayalam [mal_chillus]`.

The runtime checks the complete 501-record label set and its construction yields 501 distinct display labels. Consequently, two variants cannot become indistinguishable in matrix headers, matrix row labels, K-grid objects, planar or 3D tree leaves, or exported presentation mappings. Internal IDs remain available for reproducibility without being shown as ordinary end-user labels.

## Search behavior

The search index is built once when the module loads. It includes the group name and language ID plus every record's source name, reviewed name, source key, BCP 47 tag, ISO 15924 code, and human-readable script name. Query and index text use Unicode NFKD decomposition, removal of combining marks, and English lowercase conversion. This allows `francoprovencal` to find `Francoprovençal`.

Whitespace separates query tokens and all tokens must match somewhere in the group index. Thus `bosnian cyrillic` narrows the list to the Bosnian group even though the terms come from group and variant metadata. The UI reports the current group count through a live `output` associated with the search field using `aria-describedby`.

## Accessibility and interaction

The results remain in a bounded scroll region that can receive keyboard focus. Language groups and variants use semantic lists and native buttons. Single-record selections expose `aria-pressed`; multi-record disclosures expose expanded state and control ownership; selected and unavailable states are expressed in both text and control state. Focus outlines use the same high-contrast oxide accent as the rest of the workbench, and captions use the normal readable text palette rather than faint placeholder colors.

## Verification

The corpus tests require 431 unique groups, 501 records assigned exactly once, 46 multi-record groups, 501 globally unique display labels, deterministic German variant labels, and source-key disambiguation for identical Malayalam names. Workbench tests cover disclosure semantics, explicit selection of two variants, accent-insensitive and script-aware search, live result counts, and unavailable-record behavior. The display-label protocol test verifies that two records from one group remain distinct across matrix and tree presentation mappings.

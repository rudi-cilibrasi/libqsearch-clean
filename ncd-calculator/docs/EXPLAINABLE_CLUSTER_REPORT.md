# Explainable cluster report

Updated 2026-08-09 (Asia/Ho_Chi_Minh).

## Purpose

The cluster report is the default result view after an NCD computation. It converts the symmetric NCD matrix into explicit, inspectable group memberships without replacing the matrix or the QSearch topology. The report is intended to answer the first questions a non-specialist asks—what is close, what groups are suggested, and whether the partition is clear—while retaining the definitions and limitations a researcher needs to audit the summary.

The distance matrix remains the measurement. Average-linkage groups, silhouette values, the most isolated object, the quartet tree, and the K-grid are derived interpretations of that matrix. The interface therefore uses language such as “suggested,” “relative,” and “exploratory” rather than presenting a partition as ground truth.

## Deterministic grouping contract

`src/services/ClusterAnalysis.ts` validates the stable object identifiers and complete symmetric distance matrix before producing any summary. It then constructs an agglomerative dendrogram with average linkage. If clusters `A` and `B` merge, their distance to another cluster `C` is updated as:

```text
d(A ∪ B, C) = (|A| d(A, C) + |B| d(B, C)) / (|A| + |B|)
```

Equal merge distances are resolved through lexicographically sorted stable object identifiers. Reordering matrix rows and columns therefore preserves the semantic partition. Display labels are presentation only and do not control a tie.

The suggested cluster count maximizes mean silhouette over `k = 2, ..., min(8, n - 1)`. A singleton receives silhouette zero. Silhouette values equal within numerical tolerance prefer the smaller cluster count. Users may inspect any partition from 2 through `n - 1` groups; changing this control cuts the same deterministic dendrogram and does not recompute NCD.

The interface gives silhouette a deliberately modest qualitative description:

| Mean silhouette | Interface description | Interpretation |
| ---: | --- | --- |
| `>= 0.50` | Strong separation | Between-group distances are substantially larger than within-group distances in this matrix. |
| `>= 0.25` and `< 0.50` | Moderate separation | Some structure is present, but overlap remains possible. |
| `< 0.25` | Weak separation | A partition can be constructed, but it should be treated as exploratory. |

These bands are descriptive interface guidance, not confidence intervals, universal NCD thresholds, or evidence that a real-world class exists.

## Evidence shown

The primary report presents the group memberships, closest pair, five closest pairs, mean within-group distance, input provenance, and the object with the highest mean distance to all other objects. “Most isolated” is a relative matrix summary; the application does not call the object an anomaly or assign a statistical outlier probability.

The expandable research section contains every object's nearest neighbor, candidate silhouettes, selected within-group and between-group means, and the selected QSearch topology's recurrence across deterministic restarts. That QSearch percentage is explicitly described as optimization repeatability. It is not bootstrap support, a posterior probability, or confidence in the average-linkage groups. Random seeds, objective values, protocol identifiers, and internal node identifiers remain outside the primary GUI.

The existing clustering experiment JSON remains the reproducibility record. It contains the exact object order, matrix, compressor provenance, and QSearch result needed to regenerate the default report. A manually selected cluster count is presentation state and is not currently added to schema version 1 of the experiment export.

## Scenario coverage

The implementation is exercised against scenarios chosen to produce materially different reports:

| Scenario | Expected report behavior |
| --- | --- |
| Two compact pairs | Suggest two groups, strong separation, and rank the closest pair correctly. |
| Moderately separated pairs | Keep the same semantic groups while using the moderate-overlap explanation. |
| Uniform equal distances | Produce a deterministic partition, zero silhouette, and explicit exploratory language. |
| One distant object | Identify the object as most isolated without declaring a ground-truth anomaly. |
| Three compact pairs | Suggest three groups and allow a manual two-group cut. |
| Permuted matrix order | Preserve semantic group membership and silhouette. |
| Imported matrix | Show imported provenance without inventing a compressor. |
| Invalid asymmetric matrix | Fail before rendering a plausible report. |

`src/__test__/clusterAnalysis.test.ts` verifies the numerical and deterministic contract. `src/__test__/clusterReport.test.tsx` verifies the plain-language, research, imported-provenance, and manual-selection states. `src/__test__/kGridVisualizationLifecycle.test.tsx` verifies that the report is the default result and that returning to it stops optional K-grid work.

## Limits and future work

Average linkage is one interpretation of NCD, not part of the NCD definition or the QSearch objective. Silhouette can favor a convenient partition even when the underlying objects lack scientifically meaningful classes. Input representation and compressor behavior remain experimental decisions. A future robustness mode should compare matrices and partitions across compatible compressors, recording disagreement rather than hiding it.

The current dendrogram implementation uses `O(n²)` distance storage and `O(n³)` worst-case merge selection. This is appropriate for the browser workbench's current comparison sizes and remains small relative to pairwise compression and QSearch. A future large-study backend should use a specialized clustering implementation and preserve this tie-breaking and reporting contract.

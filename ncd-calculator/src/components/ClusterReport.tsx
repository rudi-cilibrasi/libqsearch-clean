import React, {useMemo, useState} from "react";
import {buildClusterAnalysis} from "@/services/ClusterAnalysis";
import {getDisplayLabel} from "@/services/DisplayLabelProtocol";
import type {NCDMatrixResponse} from "@/types/ncd";
import type {QTreeResponse} from "@/types/qsearch";

interface ClusterReportProps {
    readonly ncdMatrixResponse: NCDMatrixResponse;
    readonly labelMap: ReadonlyMap<string, string>;
    readonly qSearchTreeResult?: QTreeResponse;
}

const formatDistance = (value: number | null): string => value === null ? "Not available" : value.toFixed(3);
const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const separationCopy = {
    strong: "These groups are well separated relative to the distances inside each group.",
    moderate: "These groups show some separation, although overlap remains possible.",
    weak: "The objects can be partitioned, but the groups overlap. Treat this structure as exploratory.",
} as const;

export const ClusterReport: React.FC<ClusterReportProps> = ({
    ncdMatrixResponse,
    labelMap,
    qSearchTreeResult,
}) => {
    const [manualClusterCount, setManualClusterCount] = useState<number | undefined>();
    const displayLabels = useMemo(
        () => ncdMatrixResponse.labels.map((id) => getDisplayLabel(labelMap, id)),
        [labelMap, ncdMatrixResponse.labels],
    );
    const result = useMemo(() => {
        try {
            return {
                analysis: buildClusterAnalysis({
                    objectIds: ncdMatrixResponse.labels,
                    displayLabels,
                    ncdMatrix: ncdMatrixResponse.ncdMatrix,
                    clusterCount: manualClusterCount,
                }),
                error: null,
            };
        } catch (error) {
            return {
                analysis: null,
                error: error instanceof Error ? error.message : "Unable to construct the cluster report",
            };
        }
    }, [displayLabels, manualClusterCount, ncdMatrixResponse.labels, ncdMatrixResponse.ncdMatrix]);

    if (!result.analysis) {
        return (
            <div className="cluster-report cluster-report--error" role="alert">
                <strong>Cluster report unavailable</strong>
                <span>{result.error}</span>
            </div>
        );
    }

    const {analysis} = result;
    const closestPair = analysis.closestPairs[0];
    const provenance = ncdMatrixResponse.provenance.source === "computed"
        ? `${ncdMatrixResponse.provenance.algorithm.toUpperCase()} compression`
        : "Imported distance matrix";
    const clusterCountOptions = Array.from(
        {length: analysis.objectCount - 2},
        (_, index) => index + 2,
    );

    return (
        <section className="cluster-report" aria-labelledby="cluster-report-title">
            <header className="cluster-report__header">
                <div>
                    <p className="cluster-report__eyebrow">Explainable cluster report</p>
                    <h3 id="cluster-report-title">Suggested structure</h3>
                    <p>{separationCopy[analysis.separation]}</p>
                </div>
                <div className="cluster-report__group-control">
                    <label htmlFor="cluster-report-count">Number of groups</label>
                    <select
                        id="cluster-report-count"
                        value={analysis.selectedClusterCount}
                        onChange={(event) => setManualClusterCount(Number(event.target.value))}
                    >
                        {clusterCountOptions.map((clusterCount) => (
                            <option key={clusterCount} value={clusterCount}>
                                {clusterCount}{clusterCount === analysis.suggestedClusterCount ? " (suggested)" : ""}
                            </option>
                        ))}
                    </select>
                    {manualClusterCount !== undefined && manualClusterCount !== analysis.suggestedClusterCount && (
                        <button type="button" onClick={() => setManualClusterCount(undefined)}>
                            Use suggested {analysis.suggestedClusterCount}
                        </button>
                    )}
                </div>
            </header>

            <div className={`cluster-report__assessment cluster-report__assessment--${analysis.separation}`} role="status">
                <strong>{analysis.separation[0].toUpperCase() + analysis.separation.slice(1)} separation</strong>
                <span>
                    {analysis.selection === "suggested"
                        ? `${analysis.suggestedClusterCount} groups are suggested by the strongest silhouette in the tested range.`
                        : `${analysis.selectedClusterCount} groups are shown by your selection.`}
                </span>
            </div>

            <div className="cluster-report__highlights" aria-label="Result highlights">
                <article>
                    <span>Closest relationship</span>
                    <strong>{closestPair.firstLabel} + {closestPair.secondLabel}</strong>
                    <small>NCD {formatDistance(closestPair.distance)} · lower means closer</small>
                </article>
                <article>
                    <span>Most isolated object</span>
                    <strong>{analysis.mostIsolatedObject.objectLabel}</strong>
                    <small>Mean distance {formatDistance(analysis.mostIsolatedObject.meanDistance)} to all others</small>
                </article>
                <article>
                    <span>Grouping model</span>
                    <strong>Average linkage</strong>
                    <small>{provenance}</small>
                </article>
            </div>

            <div
                className="cluster-report__groups"
                aria-label={`${analysis.selectedClusterCount} ${analysis.selection === "suggested" ? "suggested" : "selected"} groups`}
            >
                {analysis.groups.map((group) => (
                    <article className="cluster-report__group" key={group.memberIds.join("\u0000")}>
                        <header>
                            <span>Group {group.index + 1}</span>
                            <small>{group.memberIds.length} {group.memberIds.length === 1 ? "object" : "objects"}</small>
                        </header>
                        <ul>
                            {group.memberLabels.map((label, index) => (
                                <li key={group.memberIds[index]}>{label}</li>
                            ))}
                        </ul>
                        <p>
                            {group.meanWithinDistance === null
                                ? "Single-object group; no within-group distance."
                                : `Average within-group NCD ${formatDistance(group.meanWithinDistance)}.`}
                        </p>
                    </article>
                ))}
            </div>

            <section className="cluster-report__pairs" aria-labelledby="cluster-report-pairs-title">
                <header>
                    <h4 id="cluster-report-pairs-title">Closest pairs</h4>
                    <span>Direct evidence from the distance matrix</span>
                </header>
                <ol>
                    {analysis.closestPairs.map((pair) => (
                        <li key={`${pair.firstId}\u0000${pair.secondId}`}>
                            <span>{pair.firstLabel} + {pair.secondLabel}</span>
                            <strong>{formatDistance(pair.distance)}</strong>
                        </li>
                    ))}
                </ol>
            </section>

            <details className="cluster-report__research">
                <summary>Research details and limitations</summary>
                <div className="cluster-report__research-body">
                    <p>
                        Groups use deterministic average-linkage agglomerative clustering over the symmetric NCD matrix.
                        The suggested count maximizes mean silhouette across 2 to {Math.min(analysis.objectCount - 1, 8)} groups.
                        Silhouette describes separation in this dataset; it is not a confidence probability or proof of a real-world class.
                    </p>

                    <dl className="cluster-report__metrics">
                        <div>
                            <dt>Selected silhouette</dt>
                            <dd>{analysis.silhouette.toFixed(3)}</dd>
                        </div>
                        <div>
                            <dt>Mean within-group NCD</dt>
                            <dd>{formatDistance(analysis.meanWithinDistance)}</dd>
                        </div>
                        <div>
                            <dt>Mean between-group NCD</dt>
                            <dd>{formatDistance(analysis.meanBetweenDistance)}</dd>
                        </div>
                    </dl>

                    <div className="cluster-report__candidate-table">
                        <table>
                            <caption>Silhouette evaluated for candidate group counts</caption>
                            <thead>
                            <tr>
                                <th scope="col">Groups</th>
                                <th scope="col">Silhouette</th>
                            </tr>
                            </thead>
                            <tbody>
                            {analysis.candidates.map((candidate) => (
                                <tr key={candidate.clusterCount}>
                                    <th scope="row">{candidate.clusterCount}</th>
                                    <td>{candidate.silhouette.toFixed(3)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="cluster-report__nearest-neighbors">
                        <h4>Nearest neighbor for every object</h4>
                        <ul>
                            {analysis.nearestNeighbors.map((neighbor) => (
                                <li key={neighbor.objectId}>
                                    <span>{neighbor.objectLabel} → {neighbor.neighborLabel}</span>
                                    <strong>{formatDistance(neighbor.distance)}</strong>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {qSearchTreeResult && (
                        <div className="cluster-report__stability">
                            <h4>Quartet-tree search stability</h4>
                            <p>
                                The selected QSearch topology appeared in {qSearchTreeResult.search.selectedTopologyCount} of{" "}
                                {qSearchTreeResult.search.runCount} deterministic restarts ({formatPercent(qSearchTreeResult.search.selectedTopologySupport)}).
                                This measures optimization repeatability, not bootstrap support or scientific confidence in the groups.
                            </p>
                        </div>
                    )}
                </div>
            </details>
        </section>
    );
};

export default ClusterReport;

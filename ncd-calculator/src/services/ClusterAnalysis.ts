import {validateMatrix} from "@/functions/matrix";
import type {
    ClusterAnalysisInput,
    ClusterAnalysisResult,
    ClusterCountCandidate,
    ClusterGroupSummary,
    ClusterPairSummary,
    ClusterSeparation,
    IsolatedObjectSummary,
    NearestNeighborSummary,
} from "@/types/clusterAnalysis";

export const CLUSTER_ANALYSIS_METHOD = "average-linkage-v1" as const;
export const MAX_SUGGESTED_CLUSTER_COUNT = 8;
export const MAX_CLOSEST_PAIR_COUNT = 5;

interface ActiveCluster {
    readonly id: number;
    readonly members: number[];
    readonly signature: string;
}

interface ClusterMerge {
    readonly leftId: number;
    readonly rightId: number;
    readonly mergedId: number;
    readonly members: number[];
}

interface Dendrogram {
    readonly merges: ClusterMerge[];
}

const DISTANCE_TIE_TOLERANCE = 1e-12;
const SILHOUETTE_TIE_TOLERANCE = 1e-12;
const compareText = (left: string, right: string): number => left.localeCompare(right, "en");
const pairKey = (first: number, second: number): string => (
    `${Math.min(first, second)}:${Math.max(first, second)}`
);

const mean = (values: readonly number[]): number | null => {
    if (values.length === 0) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
};

const assertInput = ({objectIds, displayLabels, ncdMatrix}: ClusterAnalysisInput): void => {
    const ids = [...objectIds];
    const matrix = ncdMatrix.map((row) => [...row]);
    const matrixError = validateMatrix(ids, matrix);
    if (matrixError) throw new Error(`Cannot analyze an invalid NCD matrix: ${matrixError}`);
    if (objectIds.length < 3) throw new Error("Cluster analysis requires at least three objects");
    if (displayLabels.length !== objectIds.length) {
        throw new Error("Display labels must match the number of object identifiers");
    }
    if (displayLabels.some((label) => typeof label !== "string" || label.trim().length === 0)) {
        throw new Error("Display labels must be non-empty strings");
    }
};

const makeSignature = (members: readonly number[], objectIds: readonly string[]): string => (
    members.map((index) => objectIds[index]).sort(compareText).join("\u0000")
);

const orderClusterPair = (first: ActiveCluster, second: ActiveCluster): [ActiveCluster, ActiveCluster] => (
    compareText(first.signature, second.signature) <= 0 ? [first, second] : [second, first]
);

const buildDendrogram = (
    objectIds: readonly string[],
    ncdMatrix: readonly (readonly number[])[],
): Dendrogram => {
    const active = new Map<number, ActiveCluster>();
    const distances = new Map<string, number>();
    objectIds.forEach((_, index) => {
        active.set(index, {id: index, members: [index], signature: objectIds[index]});
    });
    for (let first = 0; first < objectIds.length; first += 1) {
        for (let second = first + 1; second < objectIds.length; second += 1) {
            distances.set(pairKey(first, second), ncdMatrix[first][second]);
        }
    }

    const merges: ClusterMerge[] = [];
    let nextClusterId = objectIds.length;
    while (active.size > 1) {
        const clusters = [...active.values()].sort((left, right) => compareText(left.signature, right.signature));
        let selected: {left: ActiveCluster; right: ActiveCluster; distance: number; tieKey: string} | null = null;

        for (let first = 0; first < clusters.length; first += 1) {
            for (let second = first + 1; second < clusters.length; second += 1) {
                const [left, right] = orderClusterPair(clusters[first], clusters[second]);
                const distance = distances.get(pairKey(left.id, right.id));
                if (distance === undefined) throw new Error("Cluster distance state is incomplete");
                const tieKey = `${left.signature}\u0001${right.signature}`;
                if (
                    !selected
                    || distance < selected.distance - DISTANCE_TIE_TOLERANCE
                    || (
                        Math.abs(distance - selected.distance) <= DISTANCE_TIE_TOLERANCE
                        && compareText(tieKey, selected.tieKey) < 0
                    )
                ) {
                    selected = {left, right, distance, tieKey};
                }
            }
        }
        if (!selected) throw new Error("Cluster analysis could not select a merge");

        const members = [...selected.left.members, ...selected.right.members]
            .sort((left, right) => compareText(objectIds[left], objectIds[right]));
        const merged: ActiveCluster = {
            id: nextClusterId,
            members,
            signature: makeSignature(members, objectIds),
        };

        for (const other of active.values()) {
            if (other.id === selected.left.id || other.id === selected.right.id) continue;
            const leftDistance = distances.get(pairKey(selected.left.id, other.id));
            const rightDistance = distances.get(pairKey(selected.right.id, other.id));
            if (leftDistance === undefined || rightDistance === undefined) {
                throw new Error("Cluster distance state is incomplete during merge");
            }
            const mergedDistance = (
                leftDistance * selected.left.members.length
                + rightDistance * selected.right.members.length
            ) / members.length;
            distances.set(pairKey(merged.id, other.id), mergedDistance);
        }

        active.delete(selected.left.id);
        active.delete(selected.right.id);
        active.set(merged.id, merged);
        merges.push({
            leftId: selected.left.id,
            rightId: selected.right.id,
            mergedId: merged.id,
            members,
        });
        nextClusterId += 1;
    }
    return {merges};
};

const cutDendrogram = (
    objectCount: number,
    dendrogram: Dendrogram,
    clusterCount: number,
    objectIds: readonly string[],
): number[][] => {
    const active = new Map<number, number[]>();
    for (let index = 0; index < objectCount; index += 1) active.set(index, [index]);
    for (const merge of dendrogram.merges) {
        if (active.size <= clusterCount) break;
        if (!active.has(merge.leftId) || !active.has(merge.rightId)) {
            throw new Error("Dendrogram contains an invalid merge order");
        }
        active.delete(merge.leftId);
        active.delete(merge.rightId);
        active.set(merge.mergedId, merge.members);
    }
    if (active.size !== clusterCount) throw new Error("Dendrogram could not produce the requested cluster count");
    return [...active.values()]
        .map((members) => [...members].sort((left, right) => compareText(objectIds[left], objectIds[right])))
        .sort((left, right) => compareText(makeSignature(left, objectIds), makeSignature(right, objectIds)));
};

const calculateSilhouette = (
    groups: readonly (readonly number[])[],
    ncdMatrix: readonly (readonly number[])[],
): number => {
    const clusterByObject = new Map<number, number>();
    groups.forEach((members, groupIndex) => {
        members.forEach((member) => clusterByObject.set(member, groupIndex));
    });

    const values = ncdMatrix.map((_, objectIndex) => {
        const groupIndex = clusterByObject.get(objectIndex);
        if (groupIndex === undefined) throw new Error("Cluster partition does not contain every object");
        const ownGroup = groups[groupIndex];
        if (ownGroup.length <= 1) return 0;
        const within = ownGroup
            .filter((member) => member !== objectIndex)
            .map((member) => ncdMatrix[objectIndex][member]);
        const averageWithin = mean(within);
        if (averageWithin === null) return 0;
        const averageOtherGroups = groups
            .filter((_, candidateIndex) => candidateIndex !== groupIndex)
            .map((members) => mean(members.map((member) => ncdMatrix[objectIndex][member])))
            .filter((value): value is number => value !== null);
        const nearestOther = Math.min(...averageOtherGroups);
        const denominator = Math.max(averageWithin, nearestOther);
        return denominator === 0 ? 0 : (nearestOther - averageWithin) / denominator;
    });
    return mean(values) ?? 0;
};

const getSeparation = (silhouette: number): ClusterSeparation => {
    if (silhouette >= 0.5) return "strong";
    if (silhouette >= 0.25) return "moderate";
    return "weak";
};

const getClosestPairs = (
    objectIds: readonly string[],
    displayLabels: readonly string[],
    ncdMatrix: readonly (readonly number[])[],
): ClusterPairSummary[] => {
    const pairs: ClusterPairSummary[] = [];
    for (let firstIndex = 0; firstIndex < objectIds.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < objectIds.length; secondIndex += 1) {
            const orderedIndices = compareText(objectIds[firstIndex], objectIds[secondIndex]) <= 0
                ? [firstIndex, secondIndex]
                : [secondIndex, firstIndex];
            const [orderedFirst, orderedSecond] = orderedIndices;
            pairs.push({
                firstIndex: orderedFirst,
                secondIndex: orderedSecond,
                firstId: objectIds[orderedFirst],
                secondId: objectIds[orderedSecond],
                firstLabel: displayLabels[orderedFirst],
                secondLabel: displayLabels[orderedSecond],
                distance: ncdMatrix[firstIndex][secondIndex],
            });
        }
    }
    return pairs.sort((left, right) => (
        left.distance - right.distance
        || compareText(`${left.firstId}\u0000${left.secondId}`, `${right.firstId}\u0000${right.secondId}`)
    )).slice(0, MAX_CLOSEST_PAIR_COUNT);
};

const getNearestNeighbors = (
    objectIds: readonly string[],
    displayLabels: readonly string[],
    ncdMatrix: readonly (readonly number[])[],
): NearestNeighborSummary[] => objectIds.map((objectId, objectIndex) => {
    const candidates = objectIds
        .map((neighborId, neighborIndex) => ({neighborId, neighborIndex}))
        .filter(({neighborIndex}) => neighborIndex !== objectIndex)
        .sort((left, right) => (
            ncdMatrix[objectIndex][left.neighborIndex] - ncdMatrix[objectIndex][right.neighborIndex]
            || compareText(left.neighborId, right.neighborId)
        ));
    const nearest = candidates[0];
    return {
        objectIndex,
        objectId,
        objectLabel: displayLabels[objectIndex],
        neighborIndex: nearest.neighborIndex,
        neighborId: nearest.neighborId,
        neighborLabel: displayLabels[nearest.neighborIndex],
        distance: ncdMatrix[objectIndex][nearest.neighborIndex],
    };
}).sort((left, right) => compareText(left.objectId, right.objectId));

const getMostIsolatedObject = (
    objectIds: readonly string[],
    displayLabels: readonly string[],
    ncdMatrix: readonly (readonly number[])[],
): IsolatedObjectSummary => {
    const objects = objectIds.map((objectId, objectIndex) => ({
        objectIndex,
        objectId,
        objectLabel: displayLabels[objectIndex],
        meanDistance: mean(ncdMatrix[objectIndex].filter((_, otherIndex) => otherIndex !== objectIndex)) ?? 0,
    }));
    return objects.sort((left, right) => (
        right.meanDistance - left.meanDistance || compareText(left.objectId, right.objectId)
    ))[0];
};

const crossGroupMean = (
    first: readonly number[],
    second: readonly number[],
    ncdMatrix: readonly (readonly number[])[],
): number => mean(first.flatMap((left) => second.map((right) => ncdMatrix[left][right]))) ?? 0;

const buildGroupSummaries = (
    groups: readonly (readonly number[])[],
    objectIds: readonly string[],
    displayLabels: readonly string[],
    ncdMatrix: readonly (readonly number[])[],
): ClusterGroupSummary[] => groups.map((members, groupIndex) => {
    const withinDistances: number[] = [];
    for (let first = 0; first < members.length; first += 1) {
        for (let second = first + 1; second < members.length; second += 1) {
            withinDistances.push(ncdMatrix[members[first]][members[second]]);
        }
    }
    const otherGroups = groups
        .map((candidate, candidateIndex) => ({
            candidateIndex,
            distance: candidateIndex === groupIndex ? Number.POSITIVE_INFINITY : crossGroupMean(members, candidate, ncdMatrix),
        }))
        .filter(({candidateIndex}) => candidateIndex !== groupIndex)
        .sort((left, right) => left.distance - right.distance || left.candidateIndex - right.candidateIndex);
    const nearestGroup = otherGroups[0];
    return {
        index: groupIndex,
        memberIndices: [...members],
        memberIds: members.map((member) => objectIds[member]),
        memberLabels: members.map((member) => displayLabels[member]),
        meanWithinDistance: mean(withinDistances),
        nearestGroupIndex: nearestGroup?.candidateIndex ?? null,
        meanDistanceToNearestGroup: nearestGroup?.distance ?? null,
    };
});

const getOverallDistanceMeans = (
    groups: readonly (readonly number[])[],
    ncdMatrix: readonly (readonly number[])[],
): {meanWithinDistance: number | null; meanBetweenDistance: number | null} => {
    const clusterByObject = new Map<number, number>();
    groups.forEach((members, groupIndex) => members.forEach((member) => clusterByObject.set(member, groupIndex)));
    const within: number[] = [];
    const between: number[] = [];
    for (let first = 0; first < ncdMatrix.length; first += 1) {
        for (let second = first + 1; second < ncdMatrix.length; second += 1) {
            const destination = clusterByObject.get(first) === clusterByObject.get(second) ? within : between;
            destination.push(ncdMatrix[first][second]);
        }
    }
    return {meanWithinDistance: mean(within), meanBetweenDistance: mean(between)};
};

export const buildClusterAnalysis = (input: ClusterAnalysisInput): ClusterAnalysisResult => {
    assertInput(input);
    const {objectIds, displayLabels, ncdMatrix} = input;
    const dendrogram = buildDendrogram(objectIds, ncdMatrix);
    const maximumCandidateCount = Math.min(MAX_SUGGESTED_CLUSTER_COUNT, objectIds.length - 1);
    const candidates: ClusterCountCandidate[] = [];
    for (let clusterCount = 2; clusterCount <= maximumCandidateCount; clusterCount += 1) {
        const groups = cutDendrogram(objectIds.length, dendrogram, clusterCount, objectIds);
        candidates.push({clusterCount, silhouette: calculateSilhouette(groups, ncdMatrix)});
    }
    const suggested = [...candidates].sort((left, right) => {
        const difference = right.silhouette - left.silhouette;
        return Math.abs(difference) > SILHOUETTE_TIE_TOLERANCE
            ? difference
            : left.clusterCount - right.clusterCount;
    })[0];
    if (!suggested) throw new Error("Cluster analysis could not evaluate a suggested partition");

    const selectedClusterCount = input.clusterCount ?? suggested.clusterCount;
    if (
        !Number.isInteger(selectedClusterCount)
        || selectedClusterCount < 2
        || selectedClusterCount >= objectIds.length
    ) {
        throw new Error(`Cluster count must be an integer between 2 and ${objectIds.length - 1}`);
    }
    const groups = cutDendrogram(objectIds.length, dendrogram, selectedClusterCount, objectIds);
    const silhouette = selectedClusterCount === suggested.clusterCount
        ? suggested.silhouette
        : calculateSilhouette(groups, ncdMatrix);
    const groupSummaries = buildGroupSummaries(groups, objectIds, displayLabels, ncdMatrix);
    const distanceMeans = getOverallDistanceMeans(groups, ncdMatrix);

    return {
        method: CLUSTER_ANALYSIS_METHOD,
        objectCount: objectIds.length,
        selectedClusterCount,
        suggestedClusterCount: suggested.clusterCount,
        selection: input.clusterCount === undefined ? "suggested" : "manual",
        silhouette,
        separation: getSeparation(silhouette),
        candidates,
        groups: groupSummaries,
        closestPairs: getClosestPairs(objectIds, displayLabels, ncdMatrix),
        nearestNeighbors: getNearestNeighbors(objectIds, displayLabels, ncdMatrix),
        mostIsolatedObject: getMostIsolatedObject(objectIds, displayLabels, ncdMatrix),
        ...distanceMeans,
    };
};

export type ClusterSeparation = "strong" | "moderate" | "weak";

export interface ClusterCountCandidate {
    readonly clusterCount: number;
    readonly silhouette: number;
}

export interface ClusterPairSummary {
    readonly firstIndex: number;
    readonly secondIndex: number;
    readonly firstId: string;
    readonly secondId: string;
    readonly firstLabel: string;
    readonly secondLabel: string;
    readonly distance: number;
}

export interface NearestNeighborSummary {
    readonly objectIndex: number;
    readonly objectId: string;
    readonly objectLabel: string;
    readonly neighborIndex: number;
    readonly neighborId: string;
    readonly neighborLabel: string;
    readonly distance: number;
}

export interface ClusterGroupSummary {
    readonly index: number;
    readonly memberIndices: number[];
    readonly memberIds: string[];
    readonly memberLabels: string[];
    readonly meanWithinDistance: number | null;
    readonly nearestGroupIndex: number | null;
    readonly meanDistanceToNearestGroup: number | null;
}

export interface IsolatedObjectSummary {
    readonly objectIndex: number;
    readonly objectId: string;
    readonly objectLabel: string;
    readonly meanDistance: number;
}

export interface ClusterAnalysisResult {
    readonly method: "average-linkage-v1";
    readonly objectCount: number;
    readonly selectedClusterCount: number;
    readonly suggestedClusterCount: number;
    readonly selection: "suggested" | "manual";
    readonly silhouette: number;
    readonly separation: ClusterSeparation;
    readonly candidates: ClusterCountCandidate[];
    readonly groups: ClusterGroupSummary[];
    readonly closestPairs: ClusterPairSummary[];
    readonly nearestNeighbors: NearestNeighborSummary[];
    readonly mostIsolatedObject: IsolatedObjectSummary;
    readonly meanWithinDistance: number | null;
    readonly meanBetweenDistance: number | null;
}

export interface ClusterAnalysisInput {
    readonly objectIds: readonly string[];
    readonly displayLabels: readonly string[];
    readonly ncdMatrix: readonly (readonly number[])[];
    readonly clusterCount?: number;
}

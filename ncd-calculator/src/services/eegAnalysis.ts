import type {EegCondition, EegObjectRecord} from "@/types/eeg";

export type EegDistanceName = "NCD" | "Euclidean" | "Correlation" | "DTW";

export interface EegEvaluationMetric {
    readonly name: EegDistanceName;
    readonly accuracy: number;
    readonly balancedAccuracy: number;
    readonly macroF1: number;
    readonly confusion: {
        readonly targetAsTarget: number;
        readonly targetAsStandard: number;
        readonly standardAsTarget: number;
        readonly standardAsStandard: number;
    };
}

export interface EegElectrodeScore {
    readonly electrode: EegObjectRecord["electrode"];
    readonly ncd: number;
    readonly euclidean: number;
    readonly correlation: number;
    readonly dtw: number;
}

const assertWaveforms = (records: readonly EegObjectRecord[]): number => {
    if (records.length < 2) throw new Error("At least two EEG records are required.");
    const length = records[0].qc.preview.length;
    if (length === 0 || records.some(record => record.qc.preview.length !== length || record.qc.preview.some(value => !Number.isFinite(value)))) {
        throw new Error("EEG waveform previews must be finite and equal-length.");
    }
    return length;
};

export const euclideanDistance = (left: readonly number[], right: readonly number[]): number => {
    if (left.length === 0 || left.length !== right.length) throw new Error("Euclidean waveforms must have equal non-zero length.");
    return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length);
};

export const correlationDistance = (left: readonly number[], right: readonly number[]): number => {
    if (left.length === 0 || left.length !== right.length) throw new Error("Correlation waveforms must have equal non-zero length.");
    const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
    const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
    let numerator = 0;
    let leftVariance = 0;
    let rightVariance = 0;
    left.forEach((value, index) => {
        const centeredLeft = value - leftMean;
        const centeredRight = right[index] - rightMean;
        numerator += centeredLeft * centeredRight;
        leftVariance += centeredLeft ** 2;
        rightVariance += centeredRight ** 2;
    });
    const denominator = Math.sqrt(leftVariance * rightVariance);
    return denominator <= Number.EPSILON ? 1 : 1 - Math.max(-1, Math.min(1, numerator / denominator));
};

export const dtwDistance = (left: readonly number[], right: readonly number[]): number => {
    if (left.length === 0 || left.length !== right.length) throw new Error("DTW waveforms must have equal non-zero length.");
    let previous = new Float64Array(right.length + 1).fill(Number.POSITIVE_INFINITY);
    previous[0] = 0;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = new Float64Array(right.length + 1).fill(Number.POSITIVE_INFINITY);
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const cost = Math.abs(left[leftIndex - 1] - right[rightIndex - 1]);
            current[rightIndex] = cost + Math.min(current[rightIndex - 1], previous[rightIndex], previous[rightIndex - 1]);
        }
        previous = current;
    }
    return previous[right.length] / (left.length + right.length);
};

const buildDistanceMatrix = (
    records: readonly EegObjectRecord[],
    distance: (left: readonly number[], right: readonly number[]) => number,
): number[][] => {
    assertWaveforms(records);
    return records.map((left, leftIndex) => records.map((right, rightIndex) => (
        leftIndex === rightIndex ? 0 : distance(left.qc.preview, right.qc.preview)
    )));
};

const safeRate = (numerator: number, denominator: number): number => denominator === 0 ? 0 : numerator / denominator;

export const evaluateNearestNeighbor = (
    name: EegDistanceName,
    matrix: readonly (readonly number[])[],
    records: readonly EegObjectRecord[],
): EegEvaluationMetric => {
    if (matrix.length !== records.length || matrix.some(row => row.length !== records.length)) {
        throw new Error(`${name} matrix shape does not match EEG records.`);
    }
    const predictions: EegCondition[] = records.map((_record, rowIndex) => {
        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        matrix[rowIndex].forEach((distance, columnIndex) => {
            if (rowIndex === columnIndex) return;
            if (!Number.isFinite(distance) || distance < 0) throw new Error(`${name} matrix contains an invalid distance.`);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = columnIndex;
            }
        });
        if (bestIndex < 0) throw new Error(`${name} matrix has no neighbor for row ${rowIndex}.`);
        return records[bestIndex].condition;
    });
    const count = (actual: EegCondition, predicted: EegCondition): number => records.reduce(
        (sum, record, index) => sum + Number(record.condition === actual && predictions[index] === predicted),
        0,
    );
    const tt = count("target", "target");
    const ts = count("target", "standard");
    const st = count("standard", "target");
    const ss = count("standard", "standard");
    const targetRecall = safeRate(tt, tt + ts);
    const standardRecall = safeRate(ss, ss + st);
    const targetPrecision = safeRate(tt, tt + st);
    const standardPrecision = safeRate(ss, ss + ts);
    const f1 = (precision: number, recall: number): number => safeRate(2 * precision * recall, precision + recall);
    return {
        name,
        accuracy: safeRate(tt + ss, records.length),
        balancedAccuracy: (targetRecall + standardRecall) / 2,
        macroF1: (f1(targetPrecision, targetRecall) + f1(standardPrecision, standardRecall)) / 2,
        confusion: {targetAsTarget: tt, targetAsStandard: ts, standardAsTarget: st, standardAsStandard: ss},
    };
};

export const evaluateEegBaselines = (
    ncdMatrix: readonly (readonly number[])[],
    records: readonly EegObjectRecord[],
): EegEvaluationMetric[] => {
    if (new Set(records.map(record => record.condition)).size !== 2) throw new Error("Label evaluation requires target and standard records.");
    return [
        evaluateNearestNeighbor("NCD", ncdMatrix, records),
        evaluateNearestNeighbor("Euclidean", buildDistanceMatrix(records, euclideanDistance), records),
        evaluateNearestNeighbor("Correlation", buildDistanceMatrix(records, correlationDistance), records),
        evaluateNearestNeighbor("DTW", buildDistanceMatrix(records, dtwDistance), records),
    ];
};

export const getElectrodeScores = (
    ncdMatrix: readonly (readonly number[])[],
    records: readonly EegObjectRecord[],
): EegElectrodeScore[] => {
    if (ncdMatrix.length !== records.length || ncdMatrix.some(row => row.length !== records.length)) {
        throw new Error("NCD matrix shape does not match EEG electrode records.");
    }
    const channelNames = [...new Set(records.map(record => record.electrode.name))];
    return channelNames.map(name => {
        const indices = records.map((record, index) => ({record, index})).filter(item => item.record.electrode.name === name);
        const target = indices.find(item => item.record.condition === "target");
        const standard = indices.find(item => item.record.condition === "standard");
        if (!target || !standard || indices.length !== 2) throw new Error(`${name} requires exactly one target and one standard object.`);
        return {
            electrode: target.record.electrode,
            ncd: ncdMatrix[target.index][standard.index],
            euclidean: euclideanDistance(target.record.qc.preview, standard.record.qc.preview),
            correlation: correlationDistance(target.record.qc.preview, standard.record.qc.preview),
            dtw: dtwDistance(target.record.qc.preview, standard.record.qc.preview),
        };
    }).sort((left, right) => left.electrode.name.localeCompare(right.electrode.name));
};

import React, {useEffect, useMemo, useState} from "react";
import {Eye, EyeOff, Info, ShieldCheck} from "lucide-react";
import type {EegExperimentContext, EegObjectRecord} from "@/types/eeg";
import {evaluateEegBaselines, getElectrodeScores, type EegElectrodeScore} from "@/services/eegAnalysis";

interface EegResultProps {
    readonly context: EegExperimentContext;
    readonly ncdMatrix: readonly (readonly number[])[];
}

const pathFor = (values: readonly number[], width: number, height: number, minimum: number, maximum: number): string => {
    const range = maximum - minimum || 1;
    return values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : index * width / (values.length - 1);
        const y = height - (value - minimum) * height / range;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
};

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

export const EegQuartetContext: React.FC<{readonly context: EegExperimentContext}> = ({context}) => {
    const records = context.records;
    const previewLength = records[0]?.qc.preview.length ?? 0;
    const mean = Array.from({length: previewLength}, (_, index) => (
        records.reduce((sum, record) => sum + record.qc.preview[index], 0) / records.length
    ));
    const lower = Array.from({length: previewLength}, (_, index) => Math.min(...records.map(record => record.qc.preview[index])));
    const upper = Array.from({length: previewLength}, (_, index) => Math.max(...records.map(record => record.qc.preview[index])));
    const minimum = Math.min(...lower, -1);
    const maximum = Math.max(...upper, 1);
    const acceptedRange = [Math.min(...records.map(record => record.qc.acceptedEpochs)), Math.max(...records.map(record => record.qc.acceptedEpochs))];
    const rejectedRange = [Math.min(...records.map(record => record.qc.rejectedEpochs)), Math.max(...records.map(record => record.qc.rejectedEpochs))];
    const source = context.manifest.source;
    const preprocessing = context.manifest.preprocessing;

    return (
        <section className="eeg-context" aria-labelledby="eeg-context-title">
            <header>
                <div>
                    <span>Signal context</span>
                    <h3 id="eeg-context-title">Waveform QC and provenance</h3>
                </div>
                <p><ShieldCheck size={15} aria-hidden="true"/> Labels remain hidden from compressed bytes.</p>
            </header>
            <div className="eeg-context__grid">
                <article className="eeg-waveform-card">
                    <h4>Blinded waveform envelope</h4>
                    <svg viewBox="0 0 720 190" role="img" aria-labelledby="eeg-waveform-title eeg-waveform-desc">
                        <title id="eeg-waveform-title">Envelope of all selected EEG waveform previews</title>
                        <desc id="eeg-waveform-desc">Upper and lower traces show the range across objects. The middle trace shows their mean. Conditions are not identified.</desc>
                        <line x1="0" y1="95" x2="720" y2="95" className="eeg-waveform__axis"/>
                        <path d={pathFor(upper, 720, 190, minimum, maximum)} className="eeg-waveform__range"/>
                        <path d={pathFor(lower, 720, 190, minimum, maximum)} className="eeg-waveform__range"/>
                        <path d={pathFor(mean, 720, 190, minimum, maximum)} className="eeg-waveform__mean"/>
                    </svg>
                    <p>{records.length} objects · {previewLength} samples per preview · normalized amplitude</p>
                </article>
                <dl className="eeg-qc-metrics">
                    <div><dt>Epoch window</dt><dd>{preprocessing.epochWindowSeconds[0]} to {preprocessing.epochWindowSeconds[1]} s</dd></div>
                    <div><dt>Accepted epochs</dt><dd>{acceptedRange[0]}–{acceptedRange[1]} per condition</dd></div>
                    <div><dt>Rejected epochs</dt><dd>{rejectedRange[0]}–{rejectedRange[1]} per condition</dd></div>
                    <div><dt>Object shape</dt><dd>{records[0].segmentCount} × {records[0].samplesPerSegment} samples</dd></div>
                </dl>
            </div>
            <div className="eeg-provenance">
                <dl>
                    <div><dt>Dataset</dt><dd>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.datasetId} v{source.datasetVersion}</a> : <span>{source.datasetId} v{source.datasetVersion}</span>} · {source.license}</dd></div>
                    <div><dt>Recording</dt><dd>sub-{source.subject}, task-{source.task}, run-{source.run}</dd></div>
                    <div><dt>Preprocessing</dt><dd>{preprocessing.bandpassHz[0]}–{preprocessing.bandpassHz[1]} Hz; {preprocessing.outputSamplingHz} Hz; {preprocessing.reference}</dd></div>
                    <div><dt>Encoding</dt><dd>{context.manifest.encoding.schemaVersion}; fixed-width signed integers at ×{context.manifest.encoding.quantizationScale}</dd></div>
                </dl>
                <p><Info size={14} aria-hidden="true"/> Exploratory clustering only. These QC summaries do not establish EEG quality for clinical interpretation.</p>
            </div>
            <details className="eeg-object-qc">
                <summary>Inspect object-level QC</summary>
                <div className="eeg-table-scroll">
                    <table>
                        <caption>Condition-blind signal summaries</caption>
                        <thead><tr><th>Object</th><th>Electrode</th><th>RMS</th><th>Peak-to-peak</th><th>SHA-256</th></tr></thead>
                        <tbody>{records.map(record => <tr key={record.id}><th>{record.label}</th><td>{record.electrode.name}</td><td>{record.qc.rms.toFixed(3)}</td><td>{record.qc.peakToPeak.toFixed(3)}</td><td><code>{record.sha256.slice(0, 12)}…</code></td></tr>)}</tbody>
                    </table>
                </div>
            </details>
        </section>
    );
};

const scoreLevel = (value: number, minimum: number, maximum: number): number => {
    if (maximum <= minimum) return 2;
    return Math.min(4, Math.floor((value - minimum) / (maximum - minimum) * 4.999));
};

const ScalpMap: React.FC<{readonly scores: readonly EegElectrodeScore[]}> = ({scores}) => {
    const values = scores.map(score => score.ncd);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return (
        <div className="eeg-scalp-layout">
            <figure className="eeg-scalp-map">
                <svg viewBox="0 0 320 330" role="img" aria-labelledby="scalp-title scalp-desc">
                    <title id="scalp-title">Scalp map of paired NCD distances</title>
                    <desc id="scalp-desc">A top view of eight electrodes. Five discrete symbol shades encode the NCD between the two blinded condition objects at each electrode.</desc>
                    <circle cx="160" cy="165" r="126" className="eeg-scalp-map__head"/>
                    <path d="M145 40 L160 18 L175 40" className="eeg-scalp-map__outline"/>
                    <path d="M34 145 Q10 165 34 185 M286 145 Q310 165 286 185" className="eeg-scalp-map__outline"/>
                    {scores.map(score => {
                        const x = 160 + score.electrode.x * 105;
                        const y = 165 - score.electrode.y * 105;
                        const level = scoreLevel(score.ncd, minimum, maximum);
                        return <g key={score.electrode.name} transform={`translate(${x} ${y})`} tabIndex={0} role="img" aria-label={`${score.electrode.name}, NCD ${score.ncd.toFixed(3)}`}>
                            <circle r="19" className={`eeg-scalp-map__point eeg-scalp-map__point--${level}`}/>
                            <text textAnchor="middle" dominantBaseline="central">{score.electrode.name}</text>
                        </g>;
                    })}
                </svg>
                <figcaption>Higher paired distance means greater compressor-visible difference, not greater neural activation.</figcaption>
            </figure>
            <div className="eeg-table-scroll">
                <table>
                    <caption>Paired condition distances by electrode</caption>
                    <thead><tr><th>Electrode</th><th>NCD</th><th>Euclidean</th><th>Correlation</th><th>DTW</th></tr></thead>
                    <tbody>{scores.map(score => <tr key={score.electrode.name}><th>{score.electrode.name}</th><td>{score.ncd.toFixed(3)}</td><td>{score.euclidean.toFixed(3)}</td><td>{score.correlation.toFixed(3)}</td><td>{score.dtw.toFixed(3)}</td></tr>)}</tbody>
                </table>
            </div>
        </div>
    );
};

const RevealedLabels: React.FC<{readonly records: readonly EegObjectRecord[]}> = ({records}) => (
    <details className="eeg-revealed-labels">
        <summary>Inspect revealed object labels</summary>
        <ul>{records.map(record => <li key={record.id}><span>{record.label}</span><strong>{record.revealedLabel}</strong></li>)}</ul>
    </details>
);

export const EegAnalysisPanel: React.FC<EegResultProps> = ({context, ncdMatrix}) => {
    const [revealed, setRevealed] = useState(false);
    useEffect(() => setRevealed(false), [context.manifest.corpusId, context.mode]);
    const evaluations = useMemo(() => context.mode === "condition" ? evaluateEegBaselines(ncdMatrix, context.records) : [], [context, ncdMatrix]);
    const electrodeScores = useMemo(() => context.mode === "electrode" ? getElectrodeScores(ncdMatrix, context.records) : [], [context, ncdMatrix]);

    return (
        <section className="eeg-analysis" aria-labelledby="eeg-analysis-title">
            <header>
                <div><span>EEG analysis</span><h3 id="eeg-analysis-title">{context.mode === "condition" ? "Blinded label evaluation" : "Electrode comparison"}</h3></div>
                <button type="button" onClick={() => setRevealed(value => !value)} aria-pressed={revealed}>
                    {revealed ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}
                    {revealed ? "Hide labels" : "Reveal labels & evaluate"}
                </button>
            </header>
            <p className="eeg-analysis__intro">Distances and the quartet tree were computed before this control exposes target/standard metadata. Labels are never part of the serialized signal objects.</p>

            {context.mode === "electrode" && <ScalpMap scores={electrodeScores}/>}

            {!revealed ? (
                <div className="eeg-analysis__locked" role="status">
                    <EyeOff size={20} aria-hidden="true"/>
                    <div><strong>Labels are hidden</strong><p>Inspect the unsupervised tree and signal QC first. Reveal only when you are ready to score the result.</p></div>
                </div>
            ) : (
                <div className="eeg-analysis__revealed" aria-live="polite">
                    {context.mode === "condition" ? (
                        <>
                            <div className="eeg-table-scroll">
                                <table>
                                    <caption>Leave-one-out 1-nearest-neighbor evaluation</caption>
                                    <thead><tr><th>Distance</th><th>Balanced accuracy</th><th>Accuracy</th><th>Macro F1</th></tr></thead>
                                    <tbody>{evaluations.map(metric => <tr key={metric.name}><th>{metric.name}</th><td>{percent(metric.balancedAccuracy)}</td><td>{percent(metric.accuracy)}</td><td>{percent(metric.macroF1)}</td></tr>)}</tbody>
                                </table>
                            </div>
                            <p className="eeg-analysis__method">Euclidean, Pearson correlation distance, and dynamic time warping operate on the same blinded mean-waveform previews. This is descriptive resubstitution-style evaluation, not an independent clinical validation set.</p>
                        </>
                    ) : (
                        <p className="eeg-analysis__method">Target and standard membership is now revealed for each electrode pair. The scalp view reports paired distances only; it does not perform source localization or infer activation.</p>
                    )}
                    <RevealedLabels records={context.records}/>
                </div>
            )}
        </section>
    );
};

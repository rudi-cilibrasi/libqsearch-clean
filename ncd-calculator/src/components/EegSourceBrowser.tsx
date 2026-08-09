import React, {useRef, useState} from "react";
import {Activity, Database, FileJson, ShieldCheck} from "lucide-react";
import type {EegAnalysisMode} from "@/types/eeg";

interface EegSourceBrowserProps {
    readonly isLoading: boolean;
    readonly onLoadExample: (mode: EegAnalysisMode) => Promise<void>;
    readonly onImportPackage: (file: File, mode: EegAnalysisMode) => Promise<void>;
}

export const EegSourceBrowser: React.FC<EegSourceBrowserProps> = ({
    isLoading,
    onLoadExample,
    onImportPackage,
}) => {
    const [mode, setMode] = useState<EegAnalysisMode>("condition");
    const packageInput = useRef<HTMLInputElement>(null);

    const importPackage = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        await onImportPackage(file, mode);
    };

    return (
        <div className="source-browser eeg-source">
            <header className="eeg-source__header">
                <div>
                    <span className="eeg-source__eyebrow">Auditory oddball · P300</span>
                    <h2>EEG source</h2>
                    <p>Compare canonical signal objects without putting condition labels into compressed data.</p>
                </div>
                <Activity size={30} aria-hidden="true"/>
            </header>

            <div className="eeg-source__body">
                <fieldset className="eeg-source__modes">
                    <legend>Analysis mode</legend>
                    <label>
                        <input
                            type="radio"
                            name="eeg-analysis-mode"
                            value="condition"
                            checked={mode === "condition"}
                            onChange={() => setMode("condition")}
                        />
                        <span><strong>Condition mode</strong><small>16 blinded Pz objects for label-reveal evaluation.</small></span>
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="eeg-analysis-mode"
                            value="electrode"
                            checked={mode === "electrode"}
                            onChange={() => setMode("electrode")}
                        />
                        <span><strong>Electrode mode</strong><small>Target–standard pairs across eight scalp locations.</small></span>
                    </label>
                </fieldset>

                <section className="eeg-source__dataset" aria-labelledby="p300-example-title">
                    <div>
                        <Database size={18} aria-hidden="true"/>
                        <div>
                            <h3 id="p300-example-title">Small ds003061-derived corpus</h3>
                            <p>Subject 001, run 1 · CC0 · 0.5–10 Hz · 128 Hz · average reference.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="workbench-button workbench-button--primary"
                        disabled={isLoading}
                        onClick={() => void onLoadExample(mode)}
                    >
                        {isLoading ? "Verifying corpus…" : `Load ${mode} example`}
                    </button>
                    <p className="eeg-source__safety"><ShieldCheck size={14} aria-hidden="true"/> Every object is checked against its SHA-256 manifest before use.</p>
                </section>

                <details className="eeg-source__researcher">
                    <summary>Use a researcher-provided BIDS dataset</summary>
                    <div>
                        <p>Run the offline MNE builder on the BIDS recording, inspect its rejection counts, then import the generated self-contained package here. Raw EDF, BDF, BrainVision, or EEGLAB files are never parsed in the browser.</p>
                        <code>python scripts/build-eeg-corpus.py --bids-root … --output … --package study.complearn-eeg.json</code>
                        <input
                            ref={packageInput}
                            type="file"
                            className="sr-only"
                            accept=".json,.complearn-eeg.json,application/json"
                            onChange={(event) => void importPackage(event)}
                            aria-label="Import BIDS-derived EEG package"
                        />
                        <button
                            type="button"
                            className="workbench-button"
                            disabled={isLoading}
                            onClick={() => packageInput.current?.click()}
                        >
                            <FileJson size={16} aria-hidden="true"/> Import prepared package
                        </button>
                    </div>
                </details>
            </div>
        </div>
    );
};

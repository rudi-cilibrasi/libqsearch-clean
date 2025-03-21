import React, { useState, useEffect, useRef } from "react";
import MatrixTable from "./MatrixTable";
import { QSearchTree3D } from "./QSearchTree3D";
import { KGridVisualizer } from "@/components/KGridVisualizer.tsx";
import { LabelManager } from "@/functions/labelUtils.ts";

// Visualization types enum for better type safety
const VisualizationType = {
    KGRID: "kgrid",
    QUARTET: "quartet"
};

interface MatrixTreeProps {
    hasMatrix: boolean;
    labels: string[];
    ncdMatrix: number[][];
    errorMsg?: string;
    qSearchTreeResult?: any;
    labelManager: LabelManager;
}

export const MatrixTree: React.FC<MatrixTreeProps> = ({
                                                          hasMatrix,
                                                          labels,
                                                          ncdMatrix,
                                                          errorMsg,
                                                          qSearchTreeResult,
                                                          labelManager
                                                      }) => {
    // State for tracking which visualization to display
    const [activeViz, setActiveViz] = useState(
        qSearchTreeResult?.nodes?.length > 0 ? VisualizationType.QUARTET : VisualizationType.KGRID
    );

    // State for tracking optimization metrics
    const [optimizationStartTime, setOptimizationStartTime] = useState<number | null>(null);
    const [optimizationEndTime, setOptimizationEndTime] = useState<number | null>(null);
    const [totalExecutionTime, setTotalExecutionTime] = useState<number | null>(null);
    const [iterationsPerSecond, setIterationsPerSecond] = useState<number | null>(null);

    // Iteration counter and last update time for calculating iterations per second
    const iterationCountRef = useRef(0);
    const lastUpdateTimeRef = useRef(Date.now());
    const ipsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Container ref for measuring and adjusting height
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset timer state when visualization changes
    useEffect(() => {
        setOptimizationStartTime(null);
        setOptimizationEndTime(null);
        setTotalExecutionTime(null);
        setIterationsPerSecond(null);
        iterationCountRef.current = 0;

        // Clear any existing interval
        if (ipsIntervalRef.current) {
            clearInterval(ipsIntervalRef.current);
            ipsIntervalRef.current = null;
        }
    }, [activeViz]);

    const handleOptimizationStart = () => {
        const startTime = Date.now();
        setOptimizationStartTime(startTime);
        setOptimizationEndTime(null);
        iterationCountRef.current = 0;
        lastUpdateTimeRef.current = startTime;


        // Set up interval to calculate iterations per second
        // This is just for metrics display, not the actual optimization speed
        ipsIntervalRef.current = setInterval(() => {
            const currentTime = Date.now();
            const elapsedSecs = (currentTime - lastUpdateTimeRef.current) / 1000;

            if (elapsedSecs > 0) {
                const ips = iterationCountRef.current / elapsedSecs;
                setIterationsPerSecond(ips);
                iterationCountRef.current = 0;
                lastUpdateTimeRef.current = currentTime;
            }
        }, 1000); // Update metrics display every second
    };

    // Handle iteration update for IPS calculation
    const handleIterationUpdate = (iteration: number) => {
        iterationCountRef.current++;
    };

    // Handle optimization end
    const handleOptimizationEnd = () => {
        if (optimizationStartTime) {
            const endTime = Date.now();
            setOptimizationEndTime(endTime);
            setTotalExecutionTime(endTime - optimizationStartTime);

            // Clear the IPS update interval
            if (ipsIntervalRef.current) {
                clearInterval(ipsIntervalRef.current);
                ipsIntervalRef.current = null;
            }
        }
    };

    // Clean up intervals on unmount
    useEffect(() => {
        return () => {
            if (ipsIntervalRef.current) {
                clearInterval(ipsIntervalRef.current);
            }
        };
    }, []);



    return (
        <div style={{ marginTop: "10px", textAlign: "left" }}>
            {/* Matrix display section */}
            {hasMatrix && labels.length > 0 && (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                    <MatrixTable
                        ncdMatrix={ncdMatrix}
                        labels={labels}
                    />
                </div>
            )}

            {/* Error message display */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {errorMsg && errorMsg.includes("no result") && (
                    <p style={{ fontSize: "18px" }}>There is no result for the input</p>
                )}
            </div>

            {/* Visualization toggle buttons */}
            {(labels.length > 0 && ncdMatrix.length > 0) && (
                <div style={{ marginBottom: "20px", marginTop: "20px" }}>
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #ddd",
                        paddingBottom: "10px"
                    }}>
                        <div>
                            <button
                                onClick={() => setActiveViz(VisualizationType.KGRID)}
                                style={{
                                    padding: "8px 16px",
                                    marginRight: "10px",
                                    backgroundColor: activeViz === VisualizationType.KGRID ? "#4A90E2" : "#e0e0e0",
                                    color: activeViz === VisualizationType.KGRID ? "white" : "black",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: activeViz === VisualizationType.KGRID ? "bold" : "normal"
                                }}
                            >
                                K-Grid Visualization
                            </button>

                            <button
                                onClick={() => setActiveViz(VisualizationType.QUARTET)}
                                disabled={!qSearchTreeResult || !qSearchTreeResult.nodes || qSearchTreeResult.nodes.length === 0}
                                style={{
                                    padding: "8px 16px",
                                    backgroundColor: activeViz === VisualizationType.QUARTET ? "#4A90E2" : "#e0e0e0",
                                    color: activeViz === VisualizationType.QUARTET ? "white" : "black",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: (!qSearchTreeResult || !qSearchTreeResult.nodes || qSearchTreeResult.nodes.length === 0) ? "not-allowed" : "pointer",
                                    fontWeight: activeViz === VisualizationType.QUARTET ? "bold" : "normal",
                                    opacity: (!qSearchTreeResult || !qSearchTreeResult.nodes || qSearchTreeResult.nodes.length === 0) ? 0.5 : 1
                                }}
                            >
                                Quartet Tree Visualization
                            </button>
                        </div>

                        {activeViz === VisualizationType.KGRID && (
                            <div style={{ display: "flex", alignItems: "center", fontSize: "14px" }}>

                            </div>
                        )}
                    </div>
                </div>
            )}

            <div ref={containerRef} style={{ position: "relative", minHeight: "500px" }}>
                {activeViz === VisualizationType.KGRID && labels.length > 0 && ncdMatrix.length > 0 && (
                    <div style={{
                        height: "100%",
                        width: "100%",
                        position: "relative"
                    }}>
                        <KGridVisualizer
                            optimizationEndTime={optimizationEndTime || undefined}
                            totalExecutionTime={totalExecutionTime || undefined}
                            iterationsPerSecond={iterationsPerSecond || undefined}
                            optimizationStartTime={optimizationStartTime || undefined}
                            labels={labels}
                            ncdMatrix={ncdMatrix}
                            labelManager={labelManager}
                            onOptimizationStart={handleOptimizationStart}
                            onOptimizationEnd={handleOptimizationEnd}
                            onIterationUpdate={handleIterationUpdate}
                            autoStart={true} /* Automatically start optimization */
                        />
                    </div>
                )}

                {activeViz === VisualizationType.QUARTET && qSearchTreeResult && qSearchTreeResult.nodes && qSearchTreeResult.nodes.length > 0 && (
                    <div style={{ height: "100%", width: "100%" }}>
                        <QSearchTree3D data={qSearchTreeResult} />
                    </div>
                )}
            </div>
        </div>
    );
};

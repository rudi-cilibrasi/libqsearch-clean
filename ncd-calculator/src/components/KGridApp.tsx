import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {KGridDualOptimization} from './KGridDualOptimization';
import {GridObject} from '@/services/kgrid.ts';
import {
    Dna,
    AlertTriangle,
    HelpCircle,
    Maximize2,
    Minimize2,
    Timer,
    Zap
} from 'lucide-react';

interface KGridAppProps {
    width?: number;
    height?: number;
    objects?: GridObject[];
    maxIterations?: number;
    ncdMatrixOverride?: number[][];
    labels?: string[];
    onOptimizationStart?: () => void;
    onOptimizationEnd?: () => void;
    onIterationUpdate?: (iteration: number) => void;
    autoStart?: boolean;
    optimizationEndTime?: number;
    totalExecutionTime?: number;
    iterationsPerSecond?: number
    optimizationStartTime?: number;
    intervalMs?: number;
}

/**
 * KGridApp component that visualizes clustering based on NCD values
 * This can either use objects with their own content for NCD calculation
 * or take pre-computed NCD matrix values
 */
const KGridApp: React.FC<KGridAppProps> = ({
                                               width = 3,
                                               height = 3,
                                               objects = [],
                                               maxIterations = 50000,
                                               ncdMatrixOverride,
                                               labels,
                                               onOptimizationStart,
                                               onOptimizationEnd,
                                               onIterationUpdate,
                                               autoStart = false,
                                               optimizationEndTime,
                                           totalExecutionTime,
                                           iterationsPerSecond,
                                            optimizationStartTime,
    intervalMs = 50
}) =>
{
    const [gridObjects, setGridObjects] = useState<GridObject[]>([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [runningOptimization, setRunningOptimization] = useState(false);
    const [iterationCount, setIterationCount] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gridContainerRef = useRef<HTMLDivElement | null>(null);
    const autoStartRef = useRef(autoStart);
    const hasTriggeredAutoStartRef = useRef(false);
    const intervalMsRef = useRef(intervalMs);


    // Function to resize grid container based on content
    const resizeGridContainer = useCallback(() => {
        if (gridContainerRef.current && containerRef.current) {
            // Get the actual height of the grid content
            const gridContent = gridContainerRef.current.querySelector('.k-grid-content');
            if (gridContent) {
                const contentHeight = gridContent.getBoundingClientRect().height;
                const minHeight = 500; // Minimum height

                // Set container height to content height or minimum, whichever is larger
                containerRef.current.style.height = `${Math.max(contentHeight, minHeight)}px`;
            }
        }
    }, []);

    // Set up resize observer to handle responsive sizing
    useEffect(() => {
        if (gridContainerRef.current) {
            const resizeObserver = new ResizeObserver(() => {
                resizeGridContainer();
            });

            resizeObserver.observe(gridContainerRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        }
    }, [resizeGridContainer]);

    useEffect(() => {
        // If we have both NCD matrix and labels, prepare the data
        if (ncdMatrixOverride && labels && labels.length > 0) {
            prepareDataFromMatrix(labels, ncdMatrixOverride);
        } else if (objects && objects.length > 0) {
            // Ensure all objects have string IDs
            const processedObjects = objects.map(obj => ({
                ...obj,
                id: String(obj.id)
            }));

            // Ensure unique objects by ID
            const uniqueIdsMap = new Map();
            processedObjects.forEach(obj => {
                if (!uniqueIdsMap.has(obj.id)) {
                    uniqueIdsMap.set(obj.id, obj);
                }
            });

            // Convert map back to array
            const uniqueObjects = Array.from(uniqueIdsMap.values());

            setGridObjects(uniqueObjects);
            setIsDataReady(true);

            // Reset auto-start tracking when data changes
            hasTriggeredAutoStartRef.current = false;
        }
    }, [ncdMatrixOverride, labels, objects]);

    /**
     * Prepare data from provided NCD matrix and labels
     */
    const prepareDataFromMatrix = useCallback((labelList: string[], matrix: number[][]) => {
        try {
            // Create GridObjects from the labels
            const generatedObjects: GridObject[] = labelList.map((label, index) => ({
                id: String(index),
                label: label,
                // Include minimal content to satisfy the interface
                content: `Data for ${label}`
            }));

            // Create a mapping for the NCD matrix
            const ncdMatrixMapping: Record<string, Record<string, number>> = {};

            // Initialize the structure
            labelList.forEach((_, i) => {
                ncdMatrixMapping[String(i)] = {};
            });

            labelList.forEach((_, i) => {
                labelList.forEach((_, j) => {
                    ncdMatrixMapping[String(i)][String(j)] = matrix[i][j];
                });
            });

            // Update state
            setGridObjects(generatedObjects);
            setIsDataReady(true);

            // Reset auto-start tracking when data changes
            hasTriggeredAutoStartRef.current = false;

            console.log('Data prepared for KGridApp from matrix:', {
                objects: generatedObjects,
                matrixSize: `${matrix.length}x${matrix[0]?.length}`
            });
        } catch (error) {
            console.error('Error preparing data from matrix:', error);
            setIsDataReady(false);
        }
    }, []);

    // Calculate optimal dimensions if not specified
    const getOptimalDimensions = () => {
        if (width !== 3 || height !== 3) {
            return {width, height};
        }

        const itemCount = gridObjects.length;
        const optimalWidth = Math.ceil(Math.sqrt(itemCount));
        const optimalHeight = Math.ceil(itemCount / optimalWidth);

        return {width: optimalWidth, height: optimalHeight};
    };

    const {width: displayWidth, height: displayHeight} = getOptimalDimensions();

    // Toggle fullscreen mode for better visualization
    const toggleExpanded = () => {
        setExpanded(!expanded);
        // After toggle, resize the container to fit content
        setTimeout(resizeGridContainer, 100);
    };

    // Handle optimization start
    const handleOptimizationStart = useCallback(() => {
        console.log("Optimization started with swap interval of 20ms");
        setRunningOptimization(true);
        setIterationCount(0);

        // Override the interval to 20ms for faster block swapping
        intervalMsRef.current = 20;

        // Call parent handler if provided
        if (onOptimizationStart) {
            onOptimizationStart();
        }
    }, [onOptimizationStart]);

    // Handle optimization end
    const handleOptimizationEnd = useCallback(() => {
        console.log("Optimization ended");
        setRunningOptimization(false);

        // Call parent handler if provided
        if (onOptimizationEnd) {
            onOptimizationEnd();
        }
    }, [onOptimizationEnd]);

    // Handle iteration updates
    const handleIterationUpdate = useCallback((iteration: number) => {
        setIterationCount(iteration);

        // Call parent handler if provided
        if (onIterationUpdate) {
            onIterationUpdate(iteration);
        }
    }, [onIterationUpdate]);

    // Handle auto-start if enabled
    useEffect(() => {
        if (autoStartRef.current && isDataReady && !hasTriggeredAutoStartRef.current && !runningOptimization) {
            // Set a small timeout to ensure the component is fully rendered
            const timer = setTimeout(() => {
                console.log("Auto-starting optimization");
                hasTriggeredAutoStartRef.current = true;
                handleOptimizationStart();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isDataReady, runningOptimization, handleOptimizationStart]);

    if (!isDataReady) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '64px',
                color: 'black'
            }}>
                <div style={{textAlign: 'center'}}>
                    <div style={{
                        animation: 'spin 1s linear infinite',
                        borderRadius: '50%',
                        height: '48px',
                        width: '48px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: '#e5e7eb',
                        borderTopColor: '#3b82f6',
                        margin: '0 auto 16px auto'
                    }}></div>
                    <p style={{color: '#6b7280'}}>Preparing visualization data...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: expanded ? 'fixed' : 'relative',
                inset: expanded ? 0 : 'auto',
                zIndex: expanded ? 50 : 'auto',
                backgroundColor: expanded ? 'white' : 'transparent',
                padding: expanded ? '24px' : 0,
                overflow: expanded ? 'auto' : 'visible',
                height: expanded ? '100vh' : 'auto',
                minHeight: '500px', // Minimum height to prevent layout jumps
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0
                }}>
                    <Dna size={20} style={{color: '#2563eb'}}/>
                    K-Grid Clustering Visualization
                </h2>
            </div>

            <div
                ref={gridContainerRef}
                style={{
                    flex: '1',
                    minHeight: '500px',
                    position: 'relative',
                    className: 'k-grid-content'
                }}
            >
                <KGridDualOptimization
                    width={displayWidth}
                    height={displayHeight}
                    objects={gridObjects}
                    maxIterations={maxIterations}
                    onOptimizationStart={handleOptimizationStart}
                    onOptimizationEnd={handleOptimizationEnd}
                    onIterationUpdate={handleIterationUpdate}
                    autoStart={autoStart && !hasTriggeredAutoStartRef.current}
                    iterationsPerSecond={iterationsPerSecond}
                    totalExecutionTime={totalExecutionTime}
                    optimizationStartTime={optimizationStartTime}
                    optimizationEndTime={optimizationEndTime}
                />
            </div>

            <div style={{
                marginTop: '16px',
                textAlign: 'center',
                fontSize: '14px',
                color: '#6b7280'
            }}>
                <p style={{margin: 0}}>
                    Using {displayWidth}×{displayHeight} grid to visualize {gridObjects.length} items.
                    Max iterations: {maxIterations.toLocaleString()}.
                </p>
            </div>
        </div>
    );
}
;

export default KGridApp;
